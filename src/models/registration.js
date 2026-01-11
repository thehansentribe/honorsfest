const { db } = require('../config/db');
const Class = require('./class');
const User = require('./user');

class Registration {
  static async register(userId, classId) {
    return db.transaction(() => {
      // Get class details
      const classData = Class.findById(classId);
      if (!classData) {
        throw new Error('Class not found');
      }

      if (!classData.Active) {
        throw new Error('Class is not active');
      }

      // Check if this is a multi-session class
      const isMultiSession = classData.ClassGroupID != null;
      const groupClasses = isMultiSession ? Class.findByGroup(classData.ClassGroupID) : [classData];

      // Check if already registered for any class in the group
      for (const cls of groupClasses) {
        const existing = db.prepare('SELECT * FROM Registrations WHERE UserID = ? AND ClassID = ?').get(userId, cls.ID);
        if (existing) {
          throw new Error(isMultiSession ? 'Already registered for this multi-session class' : 'Already registered for this class');
        }
      }

      // Get user's role for student priority logic
      const user = User.findById(userId);
      if (!user) {
        throw new Error('User not found');
      }
      const userRole = user.Role;

      // For multi-session classes, check capacity across ALL sessions
      // If ANY session is full, the whole registration goes to waitlist
      let allSessionsHaveSpace = true;
      for (const cls of groupClasses) {
        const enrolledCount = Class.getEnrolledCount(cls.ID);
        let maxCapacity;
        if (cls.LocationMaxCapacity != null) {
          maxCapacity = Math.min(cls.LocationMaxCapacity, cls.TeacherMaxStudents);
        } else {
          maxCapacity = cls.TeacherMaxStudents;
        }
        if (enrolledCount >= maxCapacity) {
          allSessionsHaveSpace = false;
          break;
        }
      }
      
      const stmt = db.prepare(`
        INSERT INTO Registrations (UserID, ClassID, Status, WaitlistOrder)
        VALUES (?, ?, ?, ?)
      `);

      if (allSessionsHaveSpace) {
        // Enroll in all sessions
        const results = [];
        for (const cls of groupClasses) {
          const result = stmt.run(userId, cls.ID, 'Enrolled', null);
          // Create attendance record
          db.prepare('INSERT INTO Attendance (ClassID, UserID) VALUES (?, ?)').run(cls.ID, userId);
          results.push({ id: result.lastInsertRowid, classId: cls.ID });
        }
        return { 
          id: results[0].id, 
          status: 'Enrolled', 
          sessionsEnrolled: results.length,
          isMultiSession 
        };
      } else {
        // At least one session is full - implement student priority logic
        const isStudent = userRole === 'Student';
        
        if (isStudent) {
          // Students go to waitlist when any session is full
          const results = [];
          for (const cls of groupClasses) {
            const waitlistCount = Class.getWaitlistCount(cls.ID);
            const result = stmt.run(userId, cls.ID, 'Waitlisted', waitlistCount + 1);
            results.push({ id: result.lastInsertRowid, classId: cls.ID, position: waitlistCount + 1 });
          }
          return { 
            id: results[0].id, 
            status: 'Waitlisted', 
            position: results[0].position,
            sessionsWaitlisted: results.length,
            isMultiSession 
          };
        } else {
          // Non-students (Teacher, ClubDirector, Staff) - try to bump non-students from all sessions
          // For simplicity with multi-session, we'll just waitlist non-students too if any session is full
          // This avoids complex cascading bumps across multiple sessions
          const results = [];
          for (const cls of groupClasses) {
            const enrolledCount = Class.getEnrolledCount(cls.ID);
            let maxCapacity;
            if (cls.LocationMaxCapacity != null) {
              maxCapacity = Math.min(cls.LocationMaxCapacity, cls.TeacherMaxStudents);
            } else {
              maxCapacity = cls.TeacherMaxStudents;
            }
            
            if (enrolledCount < maxCapacity) {
              const result = stmt.run(userId, cls.ID, 'Enrolled', null);
              db.prepare('INSERT INTO Attendance (ClassID, UserID) VALUES (?, ?)').run(cls.ID, userId);
              results.push({ id: result.lastInsertRowid, classId: cls.ID, status: 'Enrolled' });
            } else {
              const waitlistCount = Class.getWaitlistCount(cls.ID);
              const result = stmt.run(userId, cls.ID, 'Waitlisted', waitlistCount + 1);
              results.push({ id: result.lastInsertRowid, classId: cls.ID, status: 'Waitlisted', position: waitlistCount + 1 });
            }
          }
          
          // Determine overall status - if any session is waitlisted, report as waitlisted
          const anyWaitlisted = results.some(r => r.status === 'Waitlisted');
          return { 
            id: results[0].id, 
            status: anyWaitlisted ? 'Waitlisted' : 'Enrolled',
            sessionsEnrolled: results.filter(r => r.status === 'Enrolled').length,
            sessionsWaitlisted: results.filter(r => r.status === 'Waitlisted').length,
            isMultiSession 
          };
        }
      }
    })();
  }

  static drop(userId, classId) {
    return db.transaction(() => {
      const registration = db.prepare('SELECT * FROM Registrations WHERE UserID = ? AND ClassID = ?').get(userId, classId);
      
      if (!registration) {
        throw new Error('Registration not found');
      }

      // Check if this is a multi-session class
      const classData = db.prepare('SELECT ClassGroupID FROM Classes WHERE ID = ?').get(classId);
      const isMultiSession = classData && classData.ClassGroupID != null;
      
      if (isMultiSession) {
        // Get all classes in the group
        const groupClasses = db.prepare('SELECT ID FROM Classes WHERE ClassGroupID = ?').all(classData.ClassGroupID);
        const droppedSessions = [];
        
        for (const cls of groupClasses) {
          const reg = db.prepare('SELECT * FROM Registrations WHERE UserID = ? AND ClassID = ?').get(userId, cls.ID);
          if (reg) {
            // Delete registration
            db.prepare('DELETE FROM Registrations WHERE UserID = ? AND ClassID = ?').run(userId, cls.ID);
            // Delete attendance record
            db.prepare('DELETE FROM Attendance WHERE UserID = ? AND ClassID = ?').run(userId, cls.ID);
            
            // Process waitlist if user was enrolled
            if (reg.Status === 'Enrolled') {
              this.processWaitlist(cls.ID);
            }
            droppedSessions.push(cls.ID);
          }
        }
        
        return { success: true, droppedSessions: droppedSessions.length, isMultiSession: true };
      } else {
        // Single-session class - original behavior
        db.prepare('DELETE FROM Registrations WHERE UserID = ? AND ClassID = ?').run(userId, classId);
        db.prepare('DELETE FROM Attendance WHERE UserID = ? AND ClassID = ?').run(userId, classId);

        if (registration.Status === 'Enrolled') {
          this.processWaitlist(classId);
        }

        return { success: true, isMultiSession: false };
      }
    })();
  }

  static processWaitlist(classId) {
    const classData = Class.findById(classId);
    if (!classData || !classData.Active) {
      return;
    }

    // Handle null LocationMaxCapacity (when LocationID is null)
    let maxCapacity;
    if (classData.LocationMaxCapacity != null) {
      maxCapacity = Math.min(classData.LocationMaxCapacity, classData.TeacherMaxStudents);
    } else {
      maxCapacity = classData.TeacherMaxStudents;
    }
    const enrolledCount = Class.getEnrolledCount(classId);

    if (enrolledCount >= maxCapacity) {
      return; // Class is full
    }

    // Get waitlisted users in order
    const waitlistedUsers = db.prepare(`
      SELECT UserID FROM Registrations
      WHERE ClassID = ? AND Status = 'Waitlisted'
      ORDER BY WaitlistOrder ASC
    `).all(classId);

    for (const waitlistedUser of waitlistedUsers) {
      // Check if user has timeslot conflict
      const hasConflict = this.checkTimeslotConflict(waitlistedUser.UserID, classData.TimeslotID, classData.EventID);
      
      if (hasConflict) {
        // If there's a conflict, we need to drop the enrolled class first, then enroll in this one
        // This enforces the "one enrolled class per timeslot" rule
        const conflictingRegistration = db.prepare(`
          SELECT r.ID, r.ClassID
          FROM Registrations r
          JOIN Classes c ON r.ClassID = c.ID
          WHERE r.UserID = ? AND r.Status = 'Enrolled' AND c.TimeslotID = ? AND c.EventID = ?
        `).get(waitlistedUser.UserID, classData.TimeslotID, classData.EventID);
        
        if (conflictingRegistration) {
          // Drop the conflicting enrolled class
          db.prepare('DELETE FROM Registrations WHERE ID = ?').run(conflictingRegistration.ID);
          db.prepare('DELETE FROM Attendance WHERE ClassID = ? AND UserID = ?').run(conflictingRegistration.ClassID, waitlistedUser.UserID);
          
          // Process the waitlist for the dropped class (FIFO)
          this.processWaitlist(conflictingRegistration.ClassID);
        }
      }
      
      // Now enroll from waitlist
      db.prepare(`
        UPDATE Registrations
        SET Status = 'Enrolled', WaitlistOrder = NULL
        WHERE UserID = ? AND ClassID = ?
      `).run(waitlistedUser.UserID, classId);

      // Create attendance record
      db.prepare('INSERT INTO Attendance (ClassID, UserID) VALUES (?, ?)').run(classId, waitlistedUser.UserID);

      // Recalculate waitlist positions
      this.recalculateWaitlistPositions(classId);

      return waitlistedUser.UserID;
    }

    // Recalculate waitlist positions even if no one was enrolled
    this.recalculateWaitlistPositions(classId);
  }

  static checkTimeslotConflict(userId, timeslotId, eventId) {
    // Get all enrolled classes for this user in this event
    const enrolledClasses = db.prepare(`
      SELECT c.ID, c.TimeslotID
      FROM Classes c
      JOIN Registrations r ON c.ID = r.ClassID
      WHERE r.UserID = ? AND r.Status = 'Enrolled' AND c.EventID = ? AND c.Active = 1
    `).all(userId, eventId);

    // Get the target timeslot
    const targetTimeslot = db.prepare('SELECT * FROM Timeslots WHERE ID = ?').get(timeslotId);

    // Check each enrolled class for conflict
    for (const enrolledClass of enrolledClasses) {
      const enrolledTimeslot = db.prepare('SELECT * FROM Timeslots WHERE ID = ?').get(enrolledClass.TimeslotID);
      
      // Check if timeslots overlap (same date)
      if (enrolledTimeslot.Date === targetTimeslot.Date) {
        return true; // Conflict found
      }
    }

    return false; // No conflict
  }

  static recalculateWaitlistPositions(classId) {
    const waitlisted = db.prepare(`
      SELECT ID FROM Registrations
      WHERE ClassID = ? AND Status = 'Waitlisted'
      ORDER BY WaitlistOrder ASC
    `).all(classId);

    const updateStmt = db.prepare('UPDATE Registrations SET WaitlistOrder = ? WHERE ID = ?');
    
    waitlisted.forEach((reg, index) => {
      updateStmt.run(index + 1, reg.ID);
    });
  }

  static findByUser(userId, filters = {}) {
    let query = `
      SELECT r.*,
             c.HonorID, c.LocationID, c.TimeslotID, c.MaxCapacity as ClassMaxCapacity,
             c.ClassGroupID, c.SessionNumber,
             h.Name as HonorName, h.Category as HonorCategory,
             t.FirstName as TeacherFirstName, t.LastName as TeacherLastName,
             l.Name as LocationName,
             ts.Date as TimeslotDate, ts.StartTime as TimeslotStartTime, ts.EndTime as TimeslotEndTime
      FROM Registrations r
      JOIN Classes c ON r.ClassID = c.ID
      LEFT JOIN Honors h ON c.HonorID = h.ID
      LEFT JOIN Users t ON c.TeacherID = t.ID
      LEFT JOIN Locations l ON c.LocationID = l.ID
      LEFT JOIN Timeslots ts ON c.TimeslotID = ts.ID
      WHERE r.UserID = ? AND c.Active = 1
    `;
    const params = [userId];

    if (filters.status) {
      query += ' AND r.Status = ?';
      params.push(filters.status);
    }

    if (filters.eventId) {
      query += ' AND c.EventID = ?';
      params.push(filters.eventId);
    }

    query += ' ORDER BY r.Status, c.ClassGroupID, c.SessionNumber, ts.Date, ts.StartTime';

    const registrations = db.prepare(query).all(...params);
    
    // Add session count info for multi-session classes
    const sessionCountCache = {};
    return registrations.map(reg => {
      if (reg.ClassGroupID) {
        if (!sessionCountCache[reg.ClassGroupID]) {
          const count = db.prepare('SELECT COUNT(*) as count FROM Classes WHERE ClassGroupID = ?').get(reg.ClassGroupID);
          sessionCountCache[reg.ClassGroupID] = count.count;
        }
        reg.TotalSessions = sessionCountCache[reg.ClassGroupID];
        reg.IsMultiSession = true;
      } else {
        reg.TotalSessions = 1;
        reg.IsMultiSession = false;
      }
      return reg;
    });
  }

  static getClassRoster(classId) {
    return db.prepare(`
      SELECT r.ID as RegistrationID, u.ID as UserID, u.FirstName, u.LastName, u.InvestitureLevel,
             a.Attended, a.Completed, c.Name as ClubName, u.ClubID, r.Status, r.WaitlistOrder
      FROM Registrations r
      JOIN Users u ON r.UserID = u.ID
      LEFT JOIN Attendance a ON r.ClassID = a.ClassID AND r.UserID = a.UserID
      LEFT JOIN Clubs c ON u.ClubID = c.ID
      WHERE r.ClassID = ?
      ORDER BY CASE WHEN r.Status = 'Enrolled' THEN 0 ELSE 1 END, r.WaitlistOrder ASC, u.LastName, u.FirstName
    `).all(classId);
  }
  
  static findById(id) {
    return db.prepare(`
      SELECT r.*, u.FirstName, u.LastName
      FROM Registrations r
      JOIN Users u ON r.UserID = u.ID
      WHERE r.ID = ?
    `).get(id);
  }
  
  static remove(id, userId = null) {
    const registration = db.prepare('SELECT * FROM Registrations WHERE ID = ?').get(id);
    if (!registration) {
      throw new Error('Registration not found');
    }
    
    // If userId is provided, verify the registration belongs to this user
    if (userId && registration.UserID !== userId) {
      throw new Error('You can only drop your own registrations');
    }
    
    // Use the drop method which handles multi-session classes
    return this.drop(registration.UserID, registration.ClassID);
  }

  /**
   * Check if a user is registered for any session in a multi-session class group
   * @param {number} userId - The user ID
   * @param {string} classGroupId - The class group ID
   * @returns {boolean} True if registered for any session in the group
   */
  static isRegisteredForGroup(userId, classGroupId) {
    if (!classGroupId) return false;
    
    const result = db.prepare(`
      SELECT COUNT(*) as count 
      FROM Registrations r
      JOIN Classes c ON r.ClassID = c.ID
      WHERE r.UserID = ? AND c.ClassGroupID = ?
    `).get(userId, classGroupId);
    
    return result.count > 0;
  }

  /**
   * Get all registrations for a user in a specific class group
   * @param {number} userId - The user ID
   * @param {string} classGroupId - The class group ID
   * @returns {Array} Array of registration records
   */
  static getGroupRegistrations(userId, classGroupId) {
    if (!classGroupId) return [];
    
    return db.prepare(`
      SELECT r.*, c.SessionNumber, c.TimeslotID,
             ts.Date as TimeslotDate, ts.StartTime as TimeslotStartTime, ts.EndTime as TimeslotEndTime
      FROM Registrations r
      JOIN Classes c ON r.ClassID = c.ID
      LEFT JOIN Timeslots ts ON c.TimeslotID = ts.ID
      WHERE r.UserID = ? AND c.ClassGroupID = ?
      ORDER BY c.SessionNumber
    `).all(userId, classGroupId);
  }
}

module.exports = Registration;


