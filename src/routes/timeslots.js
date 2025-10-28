const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const Timeslot = require('../models/timeslot');

const router = express.Router();
router.use(verifyToken);

// GET /api/timeslots/event/:eventId - Get timeslots for event (must be before /:id route)
router.get('/event/:eventId', (req, res) => {
  try {
    const timeslots = Timeslot.findByEvent(parseInt(req.params.eventId));
    res.json(timeslots);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/timeslots/:id - Get timeslot by ID
router.get('/:id', (req, res) => {
  try {
    const timeslot = Timeslot.findById(parseInt(req.params.id));
    if (!timeslot) {
      return res.status(404).json({ error: 'Timeslot not found' });
    }
    res.json(timeslot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/timeslots/:id - Update timeslot
router.put('/:id', requireRole('Admin', 'EventAdmin'), (req, res) => {
  try {
    const updates = req.body;
    const timeslot = Timeslot.update(parseInt(req.params.id), updates);
    if (!timeslot) {
      return res.status(404).json({ error: 'Timeslot not found' });
    }
    res.json(timeslot);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/timeslots/:id - Delete timeslot
router.delete('/:id', requireRole('Admin', 'EventAdmin'), (req, res) => {
  try {
    const timeslot = Timeslot.findById(parseInt(req.params.id));
    if (!timeslot) {
      return res.status(404).json({ error: 'Timeslot not found' });
    }
    
    // Check if any classes are using this timeslot
    const { db } = require('../config/db');
    const classCount = db.prepare('SELECT COUNT(*) as count FROM Classes WHERE TimeslotID = ?').get(timeslot.ID);
    
    if (classCount.count > 0) {
      return res.status(400).json({ error: 'Cannot delete timeslot: Classes are still using this timeslot' });
    }
    
    const deleteStmt = db.prepare('DELETE FROM Timeslots WHERE ID = ?');
    deleteStmt.run(timeslot.ID);
    
    res.json({ message: 'Timeslot deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

