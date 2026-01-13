const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const Club = require('../models/club');
const { allowMultipleClubDirectors } = require('../config/features');

const router = express.Router();
router.use(verifyToken);

// GET /api/clubs - Get all clubs (must come before /:id routes)
router.get('/', (req, res) => {
  try {
    const includeEvents = req.query.includeEvents === 'true';
    const clubs = includeEvents ? Club.getAllWithEvents() : Club.getAll();
    res.json(clubs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/clubs/event/:eventId - Get clubs for event
router.get('/event/:eventId', (req, res) => {
  try {
    const clubs = Club.findByEvent(parseInt(req.params.eventId));
    res.json(clubs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/clubs/:id/summary - Get club summary with user counts and classes being taught
router.get('/:id/summary', requireRole('ClubDirector', 'Admin', 'AdminViewOnly'), (req, res) => {
  try {
    const { db } = require('../config/db');
    const clubId = parseInt(req.params.id);
    const eventId = req.query.eventId ? parseInt(req.query.eventId) : null;
    const user = req.user;

    // Verify club exists
    const club = Club.findById(clubId);
    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }

    // ClubDirectors can only view their own club's summary
    if (user.role === 'ClubDirector' && user.clubId !== clubId) {
      return res.status(403).json({ error: 'You can only view your own club\'s summary' });
    }

    if (!eventId) {
      return res.status(400).json({ error: 'eventId query parameter is required' });
    }

    // Verify event exists and club is linked to it
    const Event = require('../models/event');
    const event = Event.findById(eventId);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if club is linked to event (for ClubDirectors)
    if (user.role === 'ClubDirector' && !Club.isInEvent(clubId, eventId)) {
      return res.status(403).json({ error: 'Your club is not participating in this event' });
    }

    // Get user counts by role for this club
    const userCounts = {
      ClubDirector: 0,
      Teacher: 0,
      Staff: 0,
      Student: 0
    };

    const users = db.prepare(`
      SELECT Role, COUNT(*) as count
      FROM Users
      WHERE ClubID = ? AND Active = 1
      GROUP BY Role
    `).all(clubId);

    users.forEach(row => {
      if (userCounts.hasOwnProperty(row.Role)) {
        userCounts[row.Role] = row.count;
      }
    });

    // Get classes belonging to this club
    const Class = require('../models/class');
    const classesQuery = `
      SELECT DISTINCT
        c.ID,
        c.HonorID,
        c.TeacherID,
        c.LocationID,
        c.TimeslotID,
        c.MaxCapacity,
        c.TeacherMaxStudents,
        c.Active,
        h.Name as HonorName,
        h.Category as HonorCategory,
        u.FirstName as TeacherFirstName,
        u.LastName as TeacherLastName,
        l.Name as LocationName,
        l.MaxCapacity as LocationMaxCapacity,
        t.Date as TimeslotDate,
        t.StartTime as TimeslotStartTime,
        t.EndTime as TimeslotEndTime
      FROM Classes c
      JOIN Honors h ON c.HonorID = h.ID
      LEFT JOIN Users u ON c.TeacherID = u.ID
      LEFT JOIN Locations l ON c.LocationID = l.ID
      LEFT JOIN Timeslots t ON c.TimeslotID = t.ID
      WHERE c.EventID = ? 
        AND c.Active = 1 
        AND c.ClubID = ?
      ORDER BY t.Date, t.StartTime, h.Name
    `;

    const classes = db.prepare(classesQuery).all(eventId, clubId);

    // Add enrollment and waitlist counts, and calculate actual capacity for each class
    const classesWithCounts = classes.map(cls => {
      // Handle null LocationMaxCapacity (when LocationID is null)
      let actualMaxCapacity;
      if (cls.LocationMaxCapacity != null) {
        actualMaxCapacity = Math.min(cls.LocationMaxCapacity, cls.TeacherMaxStudents);
      } else {
        actualMaxCapacity = cls.TeacherMaxStudents;
      }

      const enrolledCount = Class.getEnrolledCount(cls.ID);
      const waitlistCount = Class.getWaitlistCount(cls.ID);

      return {
        ID: cls.ID,
        HonorName: cls.HonorName,
        HonorCategory: cls.HonorCategory,
        TeacherFirstName: cls.TeacherFirstName,
        TeacherLastName: cls.TeacherLastName,
        LocationName: cls.LocationName,
        TimeslotDate: cls.TimeslotDate,
        TimeslotStartTime: cls.TimeslotStartTime,
        TimeslotEndTime: cls.TimeslotEndTime,
        EnrolledCount: enrolledCount,
        WaitlistCount: waitlistCount,
        ActualMaxCapacity: actualMaxCapacity,
        MaxCapacity: cls.MaxCapacity,
        TeacherMaxStudents: cls.TeacherMaxStudents
      };
    });

    // Calculate total seats (sum of ActualMaxCapacity)
    const totalSeats = classesWithCounts.reduce((sum, cls) => sum + (cls.ActualMaxCapacity || 0), 0);

    res.json({
      userCounts,
      classes: classesWithCounts,
      totalClasses: classesWithCounts.length,
      totalSeats
    });
  } catch (error) {
    console.error('Error fetching club summary:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/clubs/:id/events - Get all events for a club (must come before /:id)
router.get('/:id/events', (req, res) => {
  try {
    const club = Club.findById(parseInt(req.params.id));
    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }
    
    const events = Club.getEvents(parseInt(req.params.id));
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/clubs/details/:id - Get club by ID
router.get('/details/:id', (req, res) => {
  try {
    const club = Club.findById(parseInt(req.params.id));
    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }
    res.json(club);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/clubs - Create club (Admin, EventAdmin)
router.post('/', requireRole('Admin', 'EventAdmin'), (req, res) => {
  try {
    const { Name, Church, DirectorID, EventID } = req.body;
    const User = require('../models/user');
    const directorIdInt = DirectorID ? parseInt(DirectorID, 10) : null;
    
    if (!Name) {
      return res.status(400).json({ error: 'Name is required' });
    }

    if (DirectorID && Number.isNaN(directorIdInt)) {
      return res.status(400).json({ error: 'Invalid DirectorID' });
    }
    
    const club = Club.create({ Name, Church, DirectorID: directorIdInt });
    
    // If a director was assigned, automatically add them to the club
    if (directorIdInt && club.ID) {
      if (!allowMultipleClubDirectors && User.hasDirectorConflict(club.ID, directorIdInt)) {
        return res.status(409).json({ error: 'This club already has a director assigned.' });
      }
      User.update(directorIdInt, { ClubID: club.ID });
    }
    
    // Optionally link to event if provided
    if (EventID && club.ID) {
      Club.addToEvent(club.ID, parseInt(EventID));
    }
    
    res.status(201).json(club);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/clubs/:id - Update club
router.put('/:id', requireRole('Admin', 'EventAdmin'), (req, res) => {
  try {
    const updates = req.body;
    const clubId = parseInt(req.params.id);
    if (Number.isNaN(clubId)) {
      return res.status(400).json({ error: 'Invalid club ID' });
    }

    const existingClub = Club.findById(clubId);

    const User = require('../models/user');
    let directorIdInt = null;
    if (updates.DirectorID !== undefined) {
      directorIdInt = updates.DirectorID ? parseInt(updates.DirectorID, 10) : null;
      if (updates.DirectorID && Number.isNaN(directorIdInt)) {
        return res.status(400).json({ error: 'Invalid DirectorID' });
      }
      updates.DirectorID = directorIdInt;
    }

    if (!allowMultipleClubDirectors && directorIdInt) {
      if (User.hasDirectorConflict(clubId, directorIdInt)) {
        return res.status(409).json({ error: 'This club already has a director assigned.' });
      }
    }

    const club = Club.update(clubId, updates);
    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }
    
    // If DirectorID explicitly provided
    if (updates.DirectorID !== undefined) {
      if (directorIdInt) {
        User.update(directorIdInt, { ClubID: club.ID, Role: 'ClubDirector' });
      }
      
      if (existingClub?.DirectorID && existingClub.DirectorID !== directorIdInt) {
        User.update(existingClub.DirectorID, { ClubID: null });
      }
    }
    
    res.json(club);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/clubs/:id/events - Link club to event
router.post('/:id/events', requireRole('Admin', 'EventAdmin'), (req, res) => {
  try {
    const { EventID } = req.body;
    if (!EventID) {
      return res.status(400).json({ error: 'EventID is required' });
    }
    
    const club = Club.findById(parseInt(req.params.id));
    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }
    
    Club.addToEvent(club.ID, parseInt(EventID));
    const events = Club.getEvents(club.ID);
    res.json({ club, events });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/clubs/:id/events/:eventId - Unlink club from event
router.delete('/:id/events/:eventId', requireRole('Admin', 'EventAdmin'), (req, res) => {
  try {
    const club = Club.findById(parseInt(req.params.id));
    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }
    
    const removed = Club.removeFromEvent(club.ID, parseInt(req.params.eventId));
    if (!removed) {
      return res.status(404).json({ error: 'Club is not linked to this event' });
    }
    
    res.json({ message: 'Club unlinked from event', club });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

