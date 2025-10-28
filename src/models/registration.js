const { db } = require('../config/db');
const Class = require('./class');

class Registration {
  static async register(userId, classId) {
    return db.transaction(() => {
      // Check if already registered
      const existing = db.prepare('SELECT * FROM Registrations WHERE UserID = ? AND ClassID = ?').get(userId, classId);
      if (existing) {
        throw new Error('Already registered for this class');
      }

      // Get class details
      const classData = Class.findById(classId);
      if (!classData) {
        throw new Error('Class not found');
      }

      if (!classData.Active) {
        throw new Error('Class is not active');
      }

      // Check capacity - handle null LocationMaxCapacity (when LocationID is null)
      const enrolledCount = Class.getEnrolledCount(classId);
      let maxCapacity;
      if (classData.LocationMaxCapacity != null) {
        maxCapacity = Math.min(classData.LocationMaxCapacity, classData.TeacherMaxStudents);
      } else {
        maxCapacity = classData.TeacherMaxStudents;
      }
      
      const stmt = db.prepare(`
        INSERT INTO Registrations (UserID, ClassID, Status, WaitlistOrder)
        VALUES (?, ?, ?, ?)
      `);

      if (enrolledCount < maxCapacity) {
        // Enroll directly
        const result = stmt.run(userId, classId, 'Enrolled', null);
        // Create attendance record
        db.prepare('INSERT INTO Attendance (ClassID, UserID) VALUES (?, ?)').run(classId, userId);
        return { id: result.lastInsertRowid, status: 'Enrolled' };
      } else {
        // Add to waitlist
        const waitlistCount = Class.getWaitlistCount(classId);
        const result = stmt.run(userId, classId, 'Waitlisted', waitlistCount + 1);
        return { id: result.lastInsertRowid, status: 'Waitlisted', position: waitlistCount + 1 };
      }
    })();
  }

  static drop(userId, classId) {
    return db.transaction(() => {
      const registration = db.prepare('SELECT * FROM Registrations WHERE UserID = ? AND ClassID = ?').get(userId, classId);
      
      if (!registration) {
        throw new Error('Registration not found');
      }

      // Delete registration
      db.prepare('DELETE FROM Registrations WHERE UserID = ? AND ClassID = ?').run(userId, classId);
      
      // Delete attendance record
      db.prepare('DELETE FROM Attendance WHERE UserID = ? AND ClassID = ?').run(userId, classId);

      // Process waitlist if user was enrolled
      if (registration.Status === 'Enrolled') {
        this.processWaitlist(classId);
      }

      return { success: true };
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

    query += ' ORDER BY r.Status, ts.Date, ts.StartTime';

    return db.prepare(query).all(...params);
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
    
    // Delete registration
    db.prepare('DELETE FROM Registrations WHERE ID = ?').run(id);
    
    // Delete attendance record
    db.prepare('DELETE FROM Attendance WHERE ClassID = ? AND UserID = ?').run(registration.ClassID, registration.UserID);
    
    // If user was enrolled (not waitlisted), process waitlist
    if (registration.Status === 'Enrolled') {
      this.processWaitlist(registration.ClassID);
    }
    
    return { success: true };
  }
}

module.exports = Registration;


