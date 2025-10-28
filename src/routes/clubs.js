const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const Club = require('../models/club');

const router = express.Router();
router.use(verifyToken);

// GET /api/clubs/:eventId - Get clubs for event
router.get('/:eventId', (req, res) => {
  try {
    const clubs = Club.findByEvent(parseInt(req.params.eventId));
    res.json(clubs);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/clubs/:id - Get club by ID
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
    const { EventID, Name, Church, DirectorID } = req.body;
    const db = require('../config/db').db;
    const User = require('../models/user');
    
    if (!EventID || !Name) {
      return res.status(400).json({ error: 'EventID and Name are required' });
    }
    
    const club = Club.create(req.body);
    
    // If a director was assigned, automatically add them to the club
    if (DirectorID && club.ID) {
      User.update(parseInt(DirectorID), { ClubID: club.ID });
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
    const club = Club.update(parseInt(req.params.id), updates);
    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }
    
    // If a director was assigned, automatically add them to the club
    const User = require('../models/user');
    if (updates.DirectorID) {
      User.update(parseInt(updates.DirectorID), { ClubID: club.ID });
    }
    
    res.json(club);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/clubs/:id/move - Move club to different event
router.put('/:id/move', requireRole('Admin', 'EventAdmin'), (req, res) => {
  try {
    const { EventID } = req.body;
    if (!EventID) {
      return res.status(400).json({ error: 'EventID is required' });
    }
    
    // Update EventID
    const club = Club.update(parseInt(req.params.id), { EventID });
    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }
    res.json(club);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

