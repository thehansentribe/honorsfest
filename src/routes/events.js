const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const Event = require('../models/event');
const Location = require('../models/location');
const Club = require('../models/club');
const Timeslot = require('../models/timeslot');

const router = express.Router();

// GET /api/events/current/status - Get current event status (for banners) - Public route
router.get('/current/status', (req, res) => {
  try {
    // Only get active events
    const events = Event.getAll({ active: true });
    // Find the first Live event, or the most recent active event if none are Live
    const liveEvent = events.find(e => e.Status === 'Live' && e.Active);
    const currentEvent = liveEvent || events.sort((a, b) => new Date(b.StartDate) - new Date(a.StartDate))[0];
    
    if (currentEvent) {
      res.json({ status: currentEvent.Status, eventId: currentEvent.ID, eventName: currentEvent.Name });
    } else {
      res.json({ status: null, eventId: null, eventName: null });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Apply auth middleware to all routes after this
router.use(verifyToken);

// GET /api/events - List all events (admins see all, others see only active)
router.get('/', (req, res) => {
  try {
    // Admins, AdminViewOnly, and EventAdmins see all events, others only see active ones
    const userRole = req.user?.role;
    const showAll = userRole === 'Admin' || userRole === 'AdminViewOnly' || userRole === 'EventAdmin';
    
    const events = showAll ? Event.getAll() : Event.getAll({ active: true });
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/events/my - Get events where user's club participates
router.get('/my', (req, res) => {
  try {
    const User = require('../models/user');
    const user = User.findById(req.user.id);
    
    if (!user || !user.ClubID) {
      return res.json([]); // User has no club, return empty array
    }
    
    // Get ALL events for club (not just active ones) so Club Directors can see all
    const events = Event.getEventsForClub(user.ClubID, false);
    res.json(events);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/events/system-stats - Get system-wide statistics (must come before parameterized routes)
router.get('/system-stats', (req, res) => {
  try {
    const { db } = require('../config/db');
    
    // Count users by role across all events
    const adminCount = db.prepare(`
      SELECT COUNT(*) as count FROM Users 
      WHERE Role IN ('Admin', 'AdminViewOnly') AND Active = 1
    `).get().count;
    
    const eventAdminCount = db.prepare(`
      SELECT COUNT(*) as count FROM Users 
      WHERE Role = 'EventAdmin' AND Active = 1
    `).get().count;
    
    const clubDirectorCount = db.prepare(`
      SELECT COUNT(*) as count FROM Users 
      WHERE Role = 'ClubDirector' AND Active = 1
    `).get().count;
    
    const teacherCount = db.prepare(`
      SELECT COUNT(*) as count FROM Users 
      WHERE Role = 'Teacher' AND Active = 1
    `).get().count;
    
    const staffCount = db.prepare(`
      SELECT COUNT(*) as count FROM Users 
      WHERE Role = 'Staff' AND Active = 1
    `).get().count;
    
    const studentCount = db.prepare(`
      SELECT COUNT(*) as count FROM Users 
      WHERE Role = 'Student' AND Active = 1
    `).get().count;
    
    const totalUsersCount = db.prepare(`
      SELECT COUNT(*) as count FROM Users WHERE Active = 1
    `).get().count;
    
    // Count all active classes across all events
    const totalClassesCount = db.prepare(`
      SELECT COUNT(*) as count FROM Classes WHERE Active = 1
    `).get().count;
    
    // Count all enrolled registrations across all events
    const totalEnrolledCount = db.prepare(`
      SELECT COUNT(*) as count 
      FROM Registrations r
      JOIN Classes c ON r.ClassID = c.ID
      WHERE c.Active = 1 AND r.Status = 'Enrolled'
    `).get().count;
    
    // Count all waitlisted registrations across all events
    const totalWaitlistedCount = db.prepare(`
      SELECT COUNT(*) as count 
      FROM Registrations r
      JOIN Classes c ON r.ClassID = c.ID
      WHERE c.Active = 1 AND r.Status = 'Waitlisted'
    `).get().count;
    
    // Calculate total offered seats across all events
    const offeredSeatsResult = db.prepare(`
      SELECT COALESCE(SUM(
        CASE 
          WHEN l.MaxCapacity IS NOT NULL THEN MIN(l.MaxCapacity, c.TeacherMaxStudents)
          ELSE c.TeacherMaxStudents
        END
      ), 0) as totalSeats
      FROM Classes c
      LEFT JOIN Locations l ON c.LocationID = l.ID
      WHERE c.Active = 1
    `).get();
    const offeredSeats = offeredSeatsResult.totalSeats || 0;
    
    res.json({
      users: {
        admin: adminCount,
        eventAdmin: eventAdminCount,
        clubDirector: clubDirectorCount,
        teacher: teacherCount,
        staff: staffCount,
        student: studentCount,
        total: totalUsersCount
      },
      classes: totalClassesCount,
      enrolled: totalEnrolledCount,
      waitlisted: totalWaitlistedCount,
      offeredSeats: offeredSeats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/events/:eventId/system-stats - Get system statistics filtered to a specific event
router.get('/:eventId/system-stats', (req, res) => {
  try {
    const { db } = require('../config/db');
    const eventId = parseInt(req.params.eventId);
    const event = Event.findById(eventId);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Count users by role for this event only (users in clubs linked to this event)
    const adminCount = db.prepare(`
      SELECT COUNT(*) as count FROM Users 
      WHERE Role IN ('Admin', 'AdminViewOnly') AND Active = 1
    `).get().count;
    
    const eventAdminCount = db.prepare(`
      SELECT COUNT(*) as count FROM Users 
      WHERE Role = 'EventAdmin' AND EventID = ? AND Active = 1
    `).get(eventId).count;
    
    const clubDirectorCount = db.prepare(`
      SELECT COUNT(DISTINCT u.ID) as count FROM Users u
      INNER JOIN ClubEvents ce ON u.ClubID = ce.ClubID
      WHERE ce.EventID = ? AND u.Role = 'ClubDirector' AND u.Active = 1
    `).get(eventId).count;
    
    const teacherCount = db.prepare(`
      SELECT COUNT(DISTINCT u.ID) as count FROM Users u
      INNER JOIN ClubEvents ce ON u.ClubID = ce.ClubID
      WHERE ce.EventID = ? AND u.Role = 'Teacher' AND u.Active = 1
    `).get(eventId).count;
    
    const staffCount = db.prepare(`
      SELECT COUNT(DISTINCT u.ID) as count FROM Users u
      INNER JOIN ClubEvents ce ON u.ClubID = ce.ClubID
      WHERE ce.EventID = ? AND u.Role = 'Staff' AND u.Active = 1
    `).get(eventId).count;
    
    const studentCount = db.prepare(`
      SELECT COUNT(DISTINCT u.ID) as count FROM Users u
      INNER JOIN ClubEvents ce ON u.ClubID = ce.ClubID
      WHERE ce.EventID = ? AND u.Role = 'Student' AND u.Active = 1
    `).get(eventId).count;
    
    const totalUsersCount = db.prepare(`
      SELECT COUNT(DISTINCT u.ID) as count FROM Users u
      INNER JOIN ClubEvents ce ON u.ClubID = ce.ClubID
      WHERE ce.EventID = ? AND u.Role IN ('Student', 'Teacher', 'Staff', 'ClubDirector', 'EventAdmin') AND u.Active = 1
    `).get(eventId).count;
    
    // Count active classes for this event
    const totalClassesCount = db.prepare(`
      SELECT COUNT(*) as count FROM Classes WHERE EventID = ? AND Active = 1
    `).get(eventId).count;
    
    // Count enrolled registrations for this event
    const totalEnrolledCount = db.prepare(`
      SELECT COUNT(*) as count 
      FROM Registrations r
      JOIN Classes c ON r.ClassID = c.ID
      WHERE c.EventID = ? AND c.Active = 1 AND r.Status = 'Enrolled'
    `).get(eventId).count;
    
    // Count waitlisted registrations for this event
    const totalWaitlistedCount = db.prepare(`
      SELECT COUNT(*) as count 
      FROM Registrations r
      JOIN Classes c ON r.ClassID = c.ID
      WHERE c.EventID = ? AND c.Active = 1 AND r.Status = 'Waitlisted'
    `).get(eventId).count;
    
    // Calculate total offered seats for this event
    const offeredSeatsResult = db.prepare(`
      SELECT COALESCE(SUM(
        CASE 
          WHEN l.MaxCapacity IS NOT NULL THEN MIN(l.MaxCapacity, c.TeacherMaxStudents)
          ELSE c.TeacherMaxStudents
        END
      ), 0) as totalSeats
      FROM Classes c
      LEFT JOIN Locations l ON c.LocationID = l.ID
      WHERE c.EventID = ? AND c.Active = 1
    `).get(eventId);
    const offeredSeats = offeredSeatsResult.totalSeats || 0;
    
    res.json({
      users: {
        admin: adminCount,
        eventAdmin: eventAdminCount,
        clubDirector: clubDirectorCount,
        teacher: teacherCount,
        staff: staffCount,
        student: studentCount,
        total: totalUsersCount
      },
      classes: totalClassesCount,
      enrolled: totalEnrolledCount,
      waitlisted: totalWaitlistedCount,
      offeredSeats: offeredSeats
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/events/:id - Get event by ID
router.get('/:id', (req, res) => {
  try {
    const event = Event.findById(parseInt(req.params.id));
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(event);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/events/:id/dashboard - Get event dashboard with statistics
router.get('/:id/dashboard', (req, res) => {
  try {
    const { db } = require('../config/db');
    const eventId = parseInt(req.params.id);
    const event = Event.findById(eventId);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Get statistics
    const classCount = db.prepare('SELECT COUNT(*) as count FROM Classes WHERE EventID = ? AND Active = 1').get(eventId);
    const registrationCount = db.prepare(`
      SELECT COUNT(*) as count 
      FROM Registrations r
      JOIN Classes c ON r.ClassID = c.ID
      WHERE c.EventID = ? AND c.Active = 1
    `).get(eventId);
    const enrolledCount = db.prepare(`
      SELECT COUNT(*) as count 
      FROM Registrations r
      JOIN Classes c ON r.ClassID = c.ID
      WHERE c.EventID = ? AND c.Active = 1 AND r.Status = 'Enrolled'
    `).get(eventId);
    const waitlistCount = db.prepare(`
      SELECT COUNT(*) as count 
      FROM Registrations r
      JOIN Classes c ON r.ClassID = c.ID
      WHERE c.EventID = ? AND c.Active = 1 AND r.Status = 'Waitlisted'
    `).get(eventId);
    const clubCount = db.prepare('SELECT COUNT(DISTINCT ClubID) as count FROM ClubEvents WHERE EventID = ?').get(eventId);
    const locationCount = db.prepare('SELECT COUNT(*) as count FROM Locations WHERE EventID = ?').get(eventId);
    const timeslotCount = db.prepare('SELECT COUNT(*) as count FROM Timeslots WHERE EventID = ?').get(eventId);
    // Count all users in clubs linked to this event (not just those with registrations)
    const userCount = db.prepare(`
      SELECT COUNT(DISTINCT u.ID) as count
      FROM Users u
      INNER JOIN ClubEvents ce ON u.ClubID = ce.ClubID
      WHERE ce.EventID = ? AND u.Role IN ('Student', 'Teacher', 'Staff', 'ClubDirector') AND u.Active = 1
    `).get(eventId);
    
    // Calculate total offered seats (sum of ActualMaxCapacity)
    // ActualMaxCapacity = MIN(LocationMaxCapacity, TeacherMaxStudents) OR TeacherMaxStudents if no location
    const offeredSeatsResult = db.prepare(`
      SELECT COALESCE(SUM(
        CASE 
          WHEN l.MaxCapacity IS NOT NULL THEN MIN(l.MaxCapacity, c.TeacherMaxStudents)
          ELSE c.TeacherMaxStudents
        END
      ), 0) as totalSeats
      FROM Classes c
      LEFT JOIN Locations l ON c.LocationID = l.ID
      WHERE c.EventID = ? AND c.Active = 1
    `).get(eventId);
    const offeredSeats = offeredSeatsResult.totalSeats || 0;
    
    // Get clubs linked to this event
    const clubs = Club.findByEvent(eventId);
    
    // Enhance clubs with user counts for this event
    const clubsWithCounts = clubs.map(club => {
      const teacherCount = db.prepare(`
        SELECT COUNT(*) as count FROM Users 
        WHERE ClubID = ? AND Role = 'Teacher' AND EventID = ? AND Active = 1
      `).get(club.ID, eventId).count;
      
      const staffCount = db.prepare(`
        SELECT COUNT(*) as count FROM Users 
        WHERE ClubID = ? AND Role = 'Staff' AND EventID = ? AND Active = 1
      `).get(club.ID, eventId).count;
      
      const studentCount = db.prepare(`
        SELECT COUNT(*) as count FROM Users 
        WHERE ClubID = ? AND Role = 'Student' AND EventID = ? AND Active = 1
      `).get(club.ID, eventId).count;
      
      return {
        ...club,
        TeacherCount: teacherCount,
        StaffCount: staffCount,
        StudentCount: studentCount
      };
    });
    
    // Get locations for this event
    const locations = Location.findByEvent(eventId);
    
    // Get timeslots for this event
    const timeslots = Timeslot.findByEvent(eventId);
    
    res.json({
      event,
      statistics: {
        classes: classCount.count,
        registrations: registrationCount.count,
        enrolled: enrolledCount.count,
        waitlisted: waitlistCount.count,
        clubs: clubCount.count,
        locations: locationCount.count,
        timeslots: timeslotCount.count,
        users: userCount.count,
        offeredSeats: offeredSeats
      },
      clubs: clubsWithCounts,
      locations,
      timeslots
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/events - Create event (Admin only)
router.post('/', requireRole('Admin'), (req, res) => {
  try {
    
    // Validate required fields
    if (!req.body.Name || !req.body.StartDate || !req.body.EndDate || !req.body.CoordinatorName) {
      return res.status(400).json({ 
        error: 'Missing required fields. Name, StartDate, EndDate, and CoordinatorName are required.' 
      });
    }
    
    const event = Event.create(req.body);
    res.status(201).json(event);
  } catch (error) {
    console.error('Error creating event:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/events/:id - Update event
router.put('/:id', requireRole('Admin'), (req, res) => {
  try {
    const event = Event.update(parseInt(req.params.id), req.body);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    res.json(event);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/events/:eventId/locations - Get locations for event
router.get('/:eventId/locations', (req, res) => {
  try {
    const locations = Location.findByEvent(parseInt(req.params.eventId));
    res.json(locations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/events/:eventId/locations - Create location (Admin, EventAdmin)
router.post('/:eventId/locations', requireRole('Admin', 'EventAdmin'), (req, res) => {
  try {
    const location = Location.create({ EventID: parseInt(req.params.eventId), ...req.body });
    res.status(201).json(location);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// GET /api/events/:eventId/clubs - Get clubs for event
router.get('/:eventId/clubs', (req, res) => {
  try {
    const clubs = Club.findByEvent(parseInt(req.params.eventId));
    res.json(clubs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/events/:eventId/clubs - Create club and link to event (Admin, EventAdmin)
router.post('/:eventId/clubs', requireRole('Admin', 'EventAdmin'), (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const { Name, Church, DirectorID } = req.body;
    const User = require('../models/user');
    
    if (!Name) {
      return res.status(400).json({ error: 'Name is required' });
    }
    
    // Create club
    const club = Club.create({ Name, Church, DirectorID });
    
    // Link club to event
    Club.addToEvent(club.ID, eventId);
    
    // If a director was assigned, automatically add them to the club
    if (DirectorID && club.ID) {
      User.update(parseInt(DirectorID), { ClubID: club.ID });
    }
    
    res.status(201).json(club);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/events/:eventId/timeslots - Get timeslots for event
router.get('/:eventId/timeslots', (req, res) => {
  try {
    const timeslots = Timeslot.findByEvent(parseInt(req.params.eventId));
    res.json(timeslots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/events/:eventId/timeslots - Create timeslot (Admin, EventAdmin)
router.post('/:eventId/timeslots', requireRole('Admin', 'EventAdmin'), (req, res) => {
  try {
    const timeslot = Timeslot.create({ EventID: parseInt(req.params.eventId), ...req.body });
    res.status(201).json(timeslot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

