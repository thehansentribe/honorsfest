const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const { db } = require('../config/db');
const Registration = require('../models/registration');
const Class = require('../models/class');

const router = express.Router();
router.use(verifyToken);

// POST /api/registrations - Register for class
router.post('/', (req, res) => {
  try {
    const { UserID, ClassID } = req.body;
    const userId = UserID || req.user.id;

    // Check if user has a club (required for registration)
    const User = require('../models/user');
    const user = User.findById(userId);
    if (!user || !user.ClubID) {
      return res.status(400).json({ error: 'You must be assigned to a club before registering for classes. Please contact your club director.' });
    }

    // Get class details
    const classData = Class.findById(ClassID);
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }

    // Check if event exists and is active
    const Event = require('../models/event');
    const event = Event.findById(classData.EventID);
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Check if event is active (inactive events are hidden)
    if (!event.Active) {
      return res.status(403).json({ error: 'This event is not currently active.' });
    }

    // Check if event is Live (only Live events allow registration)
    if (event.Status !== 'Live') {
      return res.status(403).json({ error: 'Registration is not open for this event. The event must be Live to register for classes.' });
    }

    // Check if user's club participates in this event
    const Club = require('../models/club');
    if (!Club.isInEvent(user.ClubID, classData.EventID)) {
      return res.status(403).json({ error: 'Your club is not participating in this event. Please contact your club director.' });
    }

    // Check if user meets the class level requirement
    if (!Class.meetsLevelRequirement(user.InvestitureLevel, classData.MinimumLevel)) {
      const userLevelDisplay = user.InvestitureLevel || 'None';
      const minLevelDisplay = classData.MinimumLevel || 'Unknown';
      return res.status(403).json({ 
        error: `This class requires ${minLevelDisplay} level or above. Your current level is ${userLevelDisplay}.` 
      });
    }

    // Check if user already registered for this specific class
    const alreadyRegistered = db.prepare(`
      SELECT COUNT(*) as count FROM Registrations r
      WHERE r.UserID = ? AND r.ClassID = ?
    `).get(userId, ClassID);
    
    if (alreadyRegistered.count > 0) {
      return res.status(400).json({ error: 'You are already registered for this class.' });
    }

    // Check if class is full and user wants to waitlist
    const enrolledCount = Class.getEnrolledCount(ClassID);
    let maxCapacity;
    if (classData.LocationMaxCapacity != null) {
      maxCapacity = Math.min(classData.LocationMaxCapacity, classData.TeacherMaxStudents);
    } else {
      maxCapacity = classData.TeacherMaxStudents;
    }
    const isFull = enrolledCount >= maxCapacity;

    // Check if this is a multi-session class and get all timeslots to check for conflicts
    const isMultiSession = classData.ClassGroupID != null;
    let timeslotsToCheck = [classData.TimeslotID];
    
    if (isMultiSession) {
      // Get all timeslots for the multi-session class
      const groupClasses = Class.findByGroup(classData.ClassGroupID);
      timeslotsToCheck = groupClasses.map(c => c.TimeslotID);
    }

    // If trying to register when full, check timeslot conflicts
    if (!isFull) {
      // Trying to enroll: check if already enrolled in ANY of the timeslots (for multi-session)
      const conflicts = db.prepare(`
        SELECT r.ID as RegistrationID, c.ID as ClassID, h.Name as HonorName, c.TimeslotID,
               t.Date as TimeslotDate, t.StartTime, t.EndTime
        FROM Registrations r
        JOIN Classes c ON r.ClassID = c.ID
        LEFT JOIN Honors h ON c.HonorID = h.ID
        LEFT JOIN Timeslots t ON c.TimeslotID = t.ID
        WHERE r.UserID = ? AND c.TimeslotID IN (${timeslotsToCheck.map(() => '?').join(',')}) AND c.EventID = ? AND r.Status = 'Enrolled'
      `).all(userId, ...timeslotsToCheck, classData.EventID);
      
      if (conflicts.length > 0) {
        // Return ALL conflict details for multi-session classes
        if (isMultiSession && conflicts.length > 0) {
          return res.status(409).json({ 
            conflict: true,
            isMultiSession: true,
            totalSessions: timeslotsToCheck.length,
            conflicts: conflicts.map(c => ({
              conflictClassId: c.ClassID,
              conflictClassName: c.HonorName || 'Unknown Class',
              conflictRegistrationId: c.RegistrationID,
              timeslotDate: c.TimeslotDate,
              startTime: c.StartTime,
              endTime: c.EndTime
            })),
            // For backward compatibility, also include first conflict as primary
            conflictClassId: conflicts[0].ClassID,
            conflictClassName: conflicts[0].HonorName || 'Unknown Class',
            conflictRegistrationId: conflicts[0].RegistrationID
          });
        } else {
          // Single class conflict (original behavior)
          return res.status(409).json({ 
            conflict: true,
            conflictClassId: conflicts[0].ClassID,
            conflictClassName: conflicts[0].HonorName || 'Unknown Class',
            conflictRegistrationId: conflicts[0].RegistrationID
          });
        }
      }
    } else {
      // Trying to waitlist when full: check if already waitlisted in any of the timeslots
      const existingWaitlisted = db.prepare(`
        SELECT COUNT(*) as count FROM Registrations r
        JOIN Classes c ON r.ClassID = c.ID
        WHERE r.UserID = ? AND c.TimeslotID IN (${timeslotsToCheck.map(() => '?').join(',')}) AND c.EventID = ? AND r.Status = 'Waitlisted'
      `).get(userId, ...timeslotsToCheck, classData.EventID);
      
      if (existingWaitlisted.count > 0) {
        return res.status(400).json({ error: 'You already have a waitlist spot for another class during one of these timeslots. You can only waitlist for one class per timeslot.' });
      }
    }

    const result = Registration.register(userId, ClassID);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/registrations/user/:userId - Get user's registrations
router.get('/user/:userId', (req, res) => {
  try {
    const filters = {
      status: req.query.status,
      eventId: req.query.eventId
    };
    const registrations = Registration.findByUser(parseInt(req.params.userId), filters);
    res.json(registrations);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/registrations/:id - Drop class
router.delete('/:id', (req, res) => {
  try {
    const userId = req.user.id;
    
    // Check if event is closed before allowing students to drop
    const registration = Registration.findById(parseInt(req.params.id));
    if (registration) {
      const Class = require('../models/class');
      const classData = Class.findById(registration.ClassID);
      if (classData) {
        const Event = require('../models/event');
        const event = Event.findById(classData.EventID);
        if (event && event.Status === 'Closed') {
          return res.status(403).json({ error: 'Registration is closed for this event.' });
        }
      }
    }
    
    // Use remove method which takes registration ID directly and verify ownership
    const result = Registration.remove(parseInt(req.params.id), userId);
    res.json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/registrations/class/:classId/roster - Get class roster (Teacher, Admin, AdminViewOnly, ClubDirector)
router.get('/class/:classId/roster', requireRole('Teacher', 'Admin', 'AdminViewOnly', 'EventAdmin', 'ClubDirector'), (req, res) => {
  try {
    const roster = Registration.getClassRoster(parseInt(req.params.classId));
    res.json(roster);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/registrations/:registrationId/admin - Remove student from class (Admin, EventAdmin, ClubDirector)
router.delete('/admin/:registrationId', requireRole('Admin', 'EventAdmin', 'ClubDirector'), (req, res) => {
  try {
    const registration = Registration.findById(parseInt(req.params.registrationId));
    if (!registration) {
      return res.status(404).json({ error: 'Registration not found' });
    }
    
    // Check if Club Director is trying to remove a student not from their club
    if (req.user.role === 'ClubDirector') {
      const User = require('../models/user');
      const student = User.findById(registration.UserID);
      
      if (!student || !student.ClubID || student.ClubID !== req.user.clubId) {
        return res.status(403).json({ error: 'You can only remove students from your own club' });
      }
    }
    
    // Check if Event Admin is managing a class from their assigned event
    if (req.user.role === 'EventAdmin') {
      const Class = require('../models/class');
      const classData = Class.findById(registration.ClassID);
      
      if (!classData || classData.EventID !== req.user.eventId) {
        return res.status(403).json({ error: 'You can only manage classes from your assigned event' });
      }
    }

    // Check if event is closed (prevent directors and admins from removing students when closed)
    const Class = require('../models/class');
    const classData = Class.findById(registration.ClassID);
    if (classData) {
      const Event = require('../models/event');
      const event = Event.findById(classData.EventID);
      if (event && event.Status === 'Closed') {
        return res.status(403).json({ error: 'Registration is closed for this event. You cannot modify class rosters.' });
      }
    }
    
    // Remove the registration
    Registration.remove(parseInt(req.params.registrationId));
    res.json({ message: 'Student removed from class successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/registrations/admin - Add student to class (Admin, EventAdmin, ClubDirector)
router.post('/admin', requireRole('Admin', 'EventAdmin', 'ClubDirector'), async (req, res) => {
  try {
    const { UserID, ClassID } = req.body;
    
    if (!UserID || !ClassID) {
      return res.status(400).json({ error: 'UserID and ClassID are required' });
    }
    
    // Get student details
    const User = require('../models/user');
    const student = User.findById(parseInt(UserID));
    
    if (!student) {
      return res.status(404).json({ error: 'Student not found' });
    }
    
    if (!student.ClubID) {
      return res.status(400).json({ error: 'Student must be assigned to a club before being added to a class' });
    }
    
    // Check if Club Director is trying to add a student not from their club
    if (req.user.role === 'ClubDirector') {
      if (student.ClubID !== req.user.clubId) {
        return res.status(403).json({ error: 'You can only add students from your own club' });
      }
    }
    
    // Get class details
    const Class = require('../models/class');
    const classData = Class.findById(ClassID);
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Check if Event Admin is managing a class from their assigned event
    if (req.user.role === 'EventAdmin' && classData.EventID !== req.user.eventId) {
      return res.status(403).json({ error: 'You can only manage classes from your assigned event' });
    }
    
    // CRITICAL: Check if student's club is participating in the event that the class belongs to
    // This validation applies to ALL roles (Admin, EventAdmin, ClubDirector)
    const Club = require('../models/club');
    if (!Club.isInEvent(student.ClubID, classData.EventID)) {
      return res.status(403).json({ 
        error: `Student's club is not participating in this event. Students can only be added to classes for events their club is associated with.` 
      });
    }

    // Check if student meets the class level requirement
    if (!Class.meetsLevelRequirement(student.InvestitureLevel, classData.MinimumLevel)) {
      const studentLevelDisplay = student.InvestitureLevel || 'None';
      const minLevelDisplay = classData.MinimumLevel || 'Unknown';
      return res.status(403).json({ 
        error: `This class requires ${minLevelDisplay} level or above. Student's current level is ${studentLevelDisplay}.` 
      });
    }

    // Check if event is closed (prevent directors and admins from adding students when closed)
    const Event = require('../models/event');
    const event = Event.findById(classData.EventID);
    if (event && event.Status === 'Closed') {
      return res.status(403).json({ error: 'Registration is closed for this event.' });
    }
    
    // Check timeslot conflict and return details if conflict exists
    const { db } = require('../config/db');
    const conflictCheck = db.prepare(`
      SELECT r.ID as RegistrationID, c.ID as ClassID, h.Name as HonorName, c.TimeslotID
      FROM Registrations r
      JOIN Classes c ON r.ClassID = c.ID
      LEFT JOIN Honors h ON c.HonorID = h.ID
      WHERE r.UserID = ? AND c.TimeslotID = ? AND c.EventID = ? AND r.Status = 'Enrolled'
    `).get(UserID, classData.TimeslotID, classData.EventID);
    
    if (conflictCheck) {
      // Return conflict details instead of error immediately
      return res.status(409).json({ 
        conflict: true,
        conflictClassId: conflictCheck.ClassID,
        conflictClassName: conflictCheck.HonorName || 'Unknown Class',
        conflictRegistrationId: conflictCheck.RegistrationID
      });
    }
    
    // Register the student
    const result = await Registration.register(UserID, ClassID);
    res.status(201).json(result);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/registrations/available/:classId - Get students available to add to class
router.get('/available/:classId', requireRole('Admin', 'AdminViewOnly', 'EventAdmin', 'ClubDirector'), (req, res) => {
  try {
    const { db } = require('../config/db');
    const Class = require('../models/class');
    
    const classData = Class.findById(parseInt(req.params.classId));
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Check if Event Admin is managing a class from their assigned event
    if (req.user.role === 'EventAdmin' && classData.EventID !== req.user.eventId) {
      return res.status(403).json({ error: 'You can only manage classes from your assigned event' });
    }
    
    // Get club filter from query parameter (for Club Directors)
    // Enforce club scoping for Club Directors
    const clubIdFilter = req.user.role === 'ClubDirector'
      ? req.user.clubId
      : (req.query.clubId ? parseInt(req.query.clubId) : null);
    
    // Build query with optional club filter
    let query = `
      SELECT u.ID, u.FirstName, u.LastName, u.Role, cl.Name as ClubName, u.ClubID
      FROM Users u
      LEFT JOIN Clubs cl ON u.ClubID = cl.ID
      WHERE u.Role IN ('Student', 'Teacher', 'ClubDirector', 'Staff') AND u.Active = 1
    `;
    
    const params = [];
    if (clubIdFilter) {
      query += ' AND u.ClubID = ?';
      params.push(clubIdFilter);
    }
    
    query += ' ORDER BY u.LastName, u.FirstName';
    
    const students = db.prepare(query).all(...params);
    
    // Filter out students already registered in this class
    const enrolledStudentIds = db.prepare('SELECT UserID FROM Registrations WHERE ClassID = ?').all(parseInt(req.params.classId)).map(r => r.UserID);
    
    // CRITICAL: Filter to only include students whose clubs are participating in the event
    // This ensures admins can only see/add students from clubs associated with the event
    const Club = require('../models/club');
    const availableStudents = students
      .filter(s => {
        // Skip if already enrolled
        if (enrolledStudentIds.includes(s.ID)) {
          return false;
        }
        // Skip if no club assigned
        if (!s.ClubID) {
          return false;
        }
        // Only include if student's club is participating in the event
        return Club.isInEvent(s.ClubID, classData.EventID);
      })
      .map(s => ({
        id: s.ID,
        firstName: s.FirstName,
        lastName: s.LastName,
        clubName: s.ClubName || 'No Club',
        role: s.Role
      }));
    
    res.json(availableStudents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

