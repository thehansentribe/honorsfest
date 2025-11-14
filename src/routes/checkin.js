const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const User = require('../models/user');
const Registration = require('../models/registration');
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

/**
 * POST /api/checkin/confirm-attendance/:eventId
 * Remove all unchecked-in students from their registered classes
 * ClubDirector: only their club's students
 * Admin/EventAdmin: all students (or filtered by clubId in body)
 */
router.post('/confirm-attendance/:eventId', requireRole('Admin', 'EventAdmin', 'ClubDirector'), (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const { clubId } = req.body;
    const user = req.user;
    
    // Determine which club to process
    let targetClubId = null;
    if (user.role === 'ClubDirector') {
      if (!user.clubId) {
        return res.status(403).json({ error: 'Club Director must be assigned to a club' });
      }
      targetClubId = user.clubId;
    } else if (clubId) {
      // Admin/EventAdmin can specify clubId in request body
      targetClubId = parseInt(clubId);
    }
    
    // Get all students who are NOT checked in for this event
    let uncheckedInQuery = `
      SELECT DISTINCT u.ID, u.FirstName, u.LastName
      FROM Users u
      WHERE u.Active = 1
        AND u.Role = 'Student'
        AND (u.CheckedIn = 0 OR u.CheckedIn IS NULL)
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
    
    const uncheckedInParams = [eventId, eventId];
    
    if (targetClubId) {
      uncheckedInQuery += ' AND u.ClubID = ?';
      uncheckedInParams.push(targetClubId);
    }
    
    const uncheckedInStudents = db.prepare(uncheckedInQuery).all(...uncheckedInParams);
    
    if (uncheckedInStudents.length === 0) {
      return res.json({ 
        message: 'No unchecked-in students found',
        removedCount: 0,
        affectedClasses: []
      });
    }
    
    // Get all registrations for these students in classes for this event
    const studentIds = uncheckedInStudents.map(s => s.ID);
    const placeholders = studentIds.map(() => '?').join(',');
    
    const registrationsQuery = `
      SELECT r.ID, r.UserID, r.ClassID, r.Status, c.EventID
      FROM Registrations r
      JOIN Classes c ON r.ClassID = c.ID
      WHERE r.UserID IN (${placeholders})
        AND c.EventID = ?
        AND c.Active = 1
    `;
    
    const registrations = db.prepare(registrationsQuery).all(...studentIds, eventId);
    
    if (registrations.length === 0) {
      return res.json({ 
        message: 'No registrations found for unchecked-in students',
        removedCount: 0,
        affectedClasses: []
      });
    }
    
    // Track removed registrations and affected classes
    let removedCount = 0;
    const affectedClasses = new Set();
    const errors = [];
    
    // Process all registrations in a single transaction for atomicity
    db.transaction(() => {
      for (const registration of registrations) {
        try {
          // Delete registration
          db.prepare('DELETE FROM Registrations WHERE ID = ?').run(registration.ID);
          
          // Delete attendance record
          db.prepare('DELETE FROM Attendance WHERE ClassID = ? AND UserID = ?')
            .run(registration.ClassID, registration.UserID);
          
          removedCount++;
          affectedClasses.add(registration.ClassID);
        } catch (error) {
          console.error(`Error removing registration ${registration.ID}:`, error);
          errors.push(`Registration ${registration.ID}: ${error.message}`);
          // Continue with other registrations even if one fails
        }
      }
    })();
    
    // Process waitlists for all affected classes after removing all registrations
    // This ensures waitlists are processed after all spots are freed
    const classArray = Array.from(affectedClasses);
    for (const classId of classArray) {
      try {
        Registration.processWaitlist(classId);
      } catch (error) {
        console.error(`Error processing waitlist for class ${classId}:`, error);
        errors.push(`Waitlist processing for class ${classId}: ${error.message}`);
      }
    }
    
    // Build response message that clarifies club scope
    let message = `Successfully removed ${removedCount} registration(s) for unchecked-in students`;
    if (targetClubId) {
      // Get club name for better context
      const club = db.prepare('SELECT Name FROM Clubs WHERE ID = ?').get(targetClubId);
      const clubName = club ? club.Name : 'your club';
      message = `Successfully removed ${removedCount} registration(s) for unchecked-in students from ${clubName}. Students from other clubs were not affected.`;
    }
    
    res.json({
      message: message,
      removedCount: removedCount,
      affectedClasses: classArray,
      studentsRemoved: uncheckedInStudents.length,
      errors: errors.length > 0 ? errors : undefined
    });
  } catch (error) {
    console.error('Error confirming attendance:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

