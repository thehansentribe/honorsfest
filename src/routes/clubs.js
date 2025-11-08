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
    
    // If a director was assigned, automatically add them to the club
    if (directorIdInt) {
      User.update(directorIdInt, { ClubID: club.ID });
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

