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

    // Disable foreign key constraints temporarily
    db.pragma('foreign_keys = OFF');

    // Clear ALL existing data in correct order (children first, then parents)
    // Delete child records first
    db.exec(`
      DELETE FROM Attendance;
      DELETE FROM Registrations;
      DELETE FROM Classes;
      DELETE FROM RegistrationCodes;
    `);
    
    // Delete ALL users (including admins) - fresh start
    db.exec(`DELETE FROM Users`);
    
    // Delete clubs (references events and users)
    db.exec(`DELETE FROM Clubs`);
    
    // Delete timeslots and locations (references events)
    db.exec(`
      DELETE FROM Timeslots;
      DELETE FROM Locations;
    `);
    
    // Delete events (last, since everything references them)
    db.exec(`DELETE FROM Events`);
    
    // Delete honors - will be re-seeded fresh
    db.exec(`DELETE FROM Honors`);

    // Re-enable foreign key constraints
    db.pragma('foreign_keys = ON');

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

