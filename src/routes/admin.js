const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const { seedDatabase } = require('../config/seed-new');
const { db } = require('../config/db');

const router = express.Router();
router.use(verifyToken);

// POST /api/admin/reseed - Reset and reseed database (Admin only)
router.post('/reseed', requireRole('Admin'), async (req, res) => {
  try {
    // Confirm action
    if (!req.body.confirm) {
      return res.status(400).json({ error: 'Confirmation required. Send { confirm: true }' });
    }

    console.log('Admin initiated database reset and reseed...');

    // Clear existing data (except honors)
    db.exec(`
      DELETE FROM Registrations;
      DELETE FROM Attendance;
      DELETE FROM Classes;
      DELETE FROM Timeslots;
      DELETE FROM Locations;
      DELETE FROM RegistrationCodes;
      DELETE FROM Users WHERE Role != 'Admin';
      DELETE FROM Clubs;
      DELETE FROM Events;
    `);

    console.log('Database cleared, starting seed...');

    // Run the seed script
    seedDatabase();

    console.log('Database reseeded successfully');

    res.json({ 
      message: 'Database reset and reseeded successfully',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error reseeding database:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

