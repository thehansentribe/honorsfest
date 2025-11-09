const express = require('express');
const { verifyToken, requireSuperAdmin } = require('../middleware/auth');
const { seedDatabase } = require('../config/seed');
const { db, initializeDatabase } = require('../config/db');
const Setting = require('../models/setting');

const router = express.Router();
router.use(verifyToken);

// POST /api/admin/reseed - Reset and reseed database (Super Admin only)
router.post('/reseed', requireSuperAdmin, async (req, res) => {
  try {
    // Confirm action
    if (!req.body.confirm) {
      return res.status(400).json({ error: 'Confirmation required. Send { confirm: true }' });
    }


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
    
    // Delete ClubEvents junction table entries
    db.exec(`DELETE FROM ClubEvents`);
    
    // Delete ALL users (including admins) - fresh start
    db.exec(`DELETE FROM Users`);
    
    // Delete clubs (references users via DirectorID)
    db.exec(`DELETE FROM Clubs`);
    
    // Delete timeslots and locations (references events)
    db.exec(`
      DELETE FROM Timeslots;
      DELETE FROM Locations;
    `);
    
    // Delete events (last, since everything references them)
    db.exec(`DELETE FROM Events`);
    
    // Delete honors and settings - will be re-seeded fresh
    db.exec(`DELETE FROM Honors`);
    db.exec(`DELETE FROM Settings`);

    // Re-enable foreign key constraints
    db.pragma('foreign_keys = ON');

    
    // Re-initialize database schema (creates tables with latest schema if needed)
    initializeDatabase();
    
    // Run migrations to ensure all columns exist (handles existing tables)
    try {
      const { migrateEventActive } = require('../config/migrate-event-active');
      migrateEventActive();
      
      const { migrateClubEvents } = require('../config/migrate-club-events');
      migrateClubEvents();
      
    } catch (migrateError) {
      console.warn('Migration warning (may be safe to ignore):', migrateError.message);
      // Continue with seeding - migrations may have already run
    }

    // Run the seed script - wrap in try/catch to handle any seed errors
    try {
      seedDatabase();

      res.json({ 
        message: 'Database reset and reseeded successfully',
        timestamp: new Date().toISOString()
      });
    } catch (seedError) {
      console.error('Error during seeding:', seedError);
      throw seedError; // Re-throw to be caught by outer catch
    }
  } catch (error) {
    console.error('Error reseeding database:', error);
    // Ensure we always return JSON, never HTML
    res.status(500).json({ 
      error: error.message || 'Unknown error occurred',
      details: error.stack 
    });
  }
});

// POST /api/admin/clear - Clear operational data for production launch (Super Admin only)
router.post('/clear', requireSuperAdmin, async (req, res) => {
  try {
    if (!req.body.confirm) {
      return res.status(400).json({ error: 'Confirmation required. Send { confirm: true }' });
    }

    db.pragma('foreign_keys = OFF');

    db.exec(`
      DELETE FROM Attendance;
      DELETE FROM Registrations;
      DELETE FROM RegistrationCodes;
      DELETE FROM Classes;
      DELETE FROM ClubEvents;
      DELETE FROM Timeslots;
      DELETE FROM Locations;
      DELETE FROM Events;
      DELETE FROM Clubs;
    `);

    db.prepare(`DELETE FROM Users WHERE Username != 'admin'`).run();

    db.pragma('foreign_keys = ON');

    initializeDatabase();

    Setting.delete('logoData');

    res.json({
      message: 'Database cleared for launch. Super admin account retained.',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error clearing database:', error);
    res.status(500).json({
      error: error.message || 'Unknown error occurred',
      details: error.stack
    });
  }
});

module.exports = router;

