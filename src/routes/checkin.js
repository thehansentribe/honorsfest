const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const User = require('../models/user');
const { db } = require('../config/db');

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

/**
 * GET /api/checkin/participants/:eventId
 * Get all participants for an event
 * Admin/EventAdmin: all participants
 * ClubDirector: only their club's students
 */
router.get('/participants/:eventId', requireRole('Admin', 'EventAdmin', 'ClubDirector'), (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const clubId = req.query.clubId ? parseInt(req.query.clubId) : null;
    const user = req.user;
    
    // Build query to get all users for this event
    let query = `
      SELECT 
        u.ID, u.FirstName, u.LastName, u.Username, u.DateOfBirth, u.Email, u.Phone,
        u.Role, u.InvestitureLevel, u.CheckInNumber, u.CheckedIn, u.BackgroundCheck,
        u.ClubID, u.EventID,
        c.Name as ClubName
      FROM Users u
      LEFT JOIN Clubs c ON u.ClubID = c.ID
      WHERE u.Active = 1
        AND (
          u.EventID = ?
          OR EXISTS (
            SELECT 1
            FROM ClubEvents ce
            WHERE ce.ClubID = u.ClubID
              AND ce.EventID = ?
          )
        )
    `;
    
    const params = [eventId, eventId];
    
    // ClubDirector can only see their club's students
    if (user.role === 'ClubDirector') {
      if (!user.clubId) {
        return res.status(403).json({ error: 'Club Director must be assigned to a club' });
      }
      query += ' AND u.ClubID = ? AND u.Role = ?';
      params.push(user.clubId);
      params.push('Student');
    } else if (clubId) {
      // Admin/EventAdmin can filter by clubId if provided
      query += ' AND u.ClubID = ?';
      params.push(clubId);
    }
    
    query += ' ORDER BY u.CheckInNumber ASC, u.LastName ASC, u.FirstName ASC';
    
    const participants = db.prepare(query).all(...params);
    
    res.json(participants);
  } catch (error) {
    console.error('Error fetching participants:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

