const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const Location = require('../models/location');

const router = express.Router();
router.use(verifyToken);

// GET /api/locations/:id - Get location by ID
router.get('/:id', (req, res) => {
  try {
    const location = Location.findById(parseInt(req.params.id));
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json(location);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/locations/:id - Update location
router.put('/:id', requireRole('Admin', 'EventAdmin'), (req, res) => {
  try {
    const location = Location.update(parseInt(req.params.id), req.body);
    if (!location) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json(location);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/locations/:id - Delete location
router.delete('/:id', requireRole('Admin', 'EventAdmin'), (req, res) => {
  try {
    const deleted = Location.delete(parseInt(req.params.id));
    if (!deleted) {
      return res.status(404).json({ error: 'Location not found' });
    }
    res.json({ message: 'Location deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

