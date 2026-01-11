const { db } = require('../config/db');
const crypto = require('crypto');

class Class {
  static create(classData) {
    const { EventID, HonorID, TeacherID, LocationID, TimeslotID, MaxCapacity, TeacherMaxStudents, CreatedBy, ClassGroupID, SessionNumber } = classData;
    
    // Validate no duplicate honor in same timeslot
    // If TeacherID is provided, check for duplicate with same teacher
    // If TeacherID is null, check for duplicate without teacher (same honor, same timeslot, no teacher)
    let duplicate;
    if (TeacherID) {
      duplicate = db.prepare(`
        SELECT ID FROM Classes 
        WHERE EventID = ? AND HonorID = ? AND TeacherID = ? AND TimeslotID = ? AND Active = 1
      `).get(EventID, HonorID, TeacherID, TimeslotID);
      
      if (duplicate) {
        throw new Error('This honor is already being taught by this teacher in this timeslot.');
      }
    } else {
      // Check for duplicate honor without teacher in same timeslot
      duplicate = db.prepare(`
        SELECT ID FROM Classes 
        WHERE EventID = ? AND HonorID = ? AND TeacherID IS NULL AND TimeslotID = ? AND Active = 1
      `).get(EventID, HonorID, TimeslotID);
      
      if (duplicate) {
        throw new Error('This honor is already being offered without a teacher in this timeslot.');
      }
    }

    // Get location capacity (if location is assigned)
    let actualCapacity;
    if (LocationID) {
      const location = db.prepare('SELECT MaxCapacity FROM Locations WHERE ID = ?').get(LocationID);
      actualCapacity = Math.min(location.MaxCapacity, TeacherMaxStudents);
    } else {
      // No location assigned yet (Club Director case) - use TeacherMaxStudents
      actualCapacity = TeacherMaxStudents;
    }

    const stmt = db.prepare(`
      INSERT INTO Classes (EventID, HonorID, TeacherID, LocationID, TimeslotID, MaxCapacity, TeacherMaxStudents, CreatedBy, ClassGroupID, SessionNumber)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      EventID,
      HonorID,
      TeacherID || null,
      LocationID,
      TimeslotID,
      actualCapacity,
      TeacherMaxStudents,
      CreatedBy || null,
      ClassGroupID || null,
      SessionNumber || 1
    );

    return this.findById(result.lastInsertRowid);
  }

  /**
   * Create a multi-session class with linked sessions
   * @param {Object} classData - Base class data (EventID, HonorID, TeacherID, LocationID, TeacherMaxStudents, CreatedBy)
   * @param {Array<number>} timeslotIds - Array of timeslot IDs for each session
   * @returns {Array<Object>} Array of created class records
   */
  static createMultiSession(classData, timeslotIds) {
    if (!timeslotIds || timeslotIds.length === 0) {
      throw new Error('At least one timeslot is required');
    }

    // Generate a unique group ID for this multi-session class
    const classGroupId = crypto.randomUUID();
    
    // Sort timeslots by date/time to ensure proper session ordering
    const timeslots = timeslotIds.map(id => {
      const ts = db.prepare('SELECT * FROM Timeslots WHERE ID = ?').get(id);
      if (!ts) throw new Error(`Timeslot ${id} not found`);
      return ts;
    }).sort((a, b) => {
      if (a.Date !== b.Date) return a.Date.localeCompare(b.Date);
      return a.StartTime.localeCompare(b.StartTime);
    });

    // Create all sessions in a transaction
    const createdClasses = db.transaction(() => {
      const results = [];
      for (let i = 0; i < timeslots.length; i++) {
        const sessionData = {
          ...classData,
          TimeslotID: timeslots[i].ID,
          ClassGroupID: classGroupId,
          SessionNumber: i + 1
        };
        const created = this.create(sessionData);
        results.push(created);
      }
      return results;
    })();

    return createdClasses;
  }

  /**
   * Find all classes in a group by ClassGroupID
   * @param {string} classGroupId - The group identifier
   * @returns {Array<Object>} Array of class records in the group, ordered by session number
   */
  static findByGroup(classGroupId) {
    if (!classGroupId) return [];
    
    const classes = db.prepare(`
      SELECT c.*, 
             h.Name as HonorName, h.Category as HonorCategory,
             u.FirstName as TeacherFirstName, u.LastName as TeacherLastName,
             l.Name as LocationName, l.MaxCapacity as LocationMaxCapacity,
             t.Date as TimeslotDate, t.StartTime as TimeslotStartTime, t.EndTime as TimeslotEndTime,
             COALESCE(creatorClub.Name, teacherClub.Name) as ClubName
      FROM Classes c
      LEFT JOIN Honors h ON c.HonorID = h.ID
      LEFT JOIN Users u ON c.TeacherID = u.ID
      LEFT JOIN Locations l ON c.LocationID = l.ID
      LEFT JOIN Timeslots t ON c.TimeslotID = t.ID
      LEFT JOIN Users creator ON c.CreatedBy = creator.ID
      LEFT JOIN Clubs creatorClub ON creator.ClubID = creatorClub.ID
      LEFT JOIN Clubs teacherClub ON u.ClubID = teacherClub.ID
      WHERE c.ClassGroupID = ?
      ORDER BY c.SessionNumber ASC
    `).all(classGroupId);

    return classes.map(cls => {
      if (cls.LocationMaxCapacity != null) {
        cls.ActualMaxCapacity = Math.min(cls.LocationMaxCapacity, cls.TeacherMaxStudents);
      } else {
        cls.ActualMaxCapacity = cls.TeacherMaxStudents;
      }
      cls.EnrolledCount = this.getEnrolledCount(cls.ID);
      cls.WaitlistCount = this.getWaitlistCount(cls.ID);
      cls.RemainingSpots = Math.max(0, cls.ActualMaxCapacity - cls.EnrolledCount);
      return cls;
    });
  }

  /**
   * Get all classes in the same group as the given class
   * @param {number} classId - Any class ID in the group
   * @returns {Array<Object>} Array of all class records in the group (including the given class)
   */
  static getGroupClasses(classId) {
    const cls = db.prepare('SELECT ClassGroupID FROM Classes WHERE ID = ?').get(classId);
    if (!cls || !cls.ClassGroupID) {
      // Single-session class - return just this class
      const singleClass = this.findById(classId);
      return singleClass ? [singleClass] : [];
    }
    return this.findByGroup(cls.ClassGroupID);
  }

  /**
   * Get the total session count for a class (1 for single-session, N for multi-session)
   * @param {number} classId - The class ID
   * @returns {number} Number of sessions in the class group
   */
  static getSessionCount(classId) {
    const cls = db.prepare('SELECT ClassGroupID FROM Classes WHERE ID = ?').get(classId);
    if (!cls || !cls.ClassGroupID) return 1;
    
    const result = db.prepare('SELECT COUNT(*) as count FROM Classes WHERE ClassGroupID = ?').get(cls.ClassGroupID);
    return result.count;
  }

  /**
   * Check if a class is part of a multi-session group
   * @param {number} classId - The class ID
   * @returns {boolean} True if the class is part of a multi-session group
   */
  static isMultiSession(classId) {
    const cls = db.prepare('SELECT ClassGroupID FROM Classes WHERE ID = ?').get(classId);
    return cls && cls.ClassGroupID != null;
  }

  /**
   * Get the primary (first) session of a multi-session class
   * @param {number} classId - Any class ID in the group
   * @returns {Object|null} The first session (SessionNumber = 1) or the class itself if single-session
   */
  static getPrimarySession(classId) {
    const cls = db.prepare('SELECT ClassGroupID FROM Classes WHERE ID = ?').get(classId);
    if (!cls) return null;
    
    if (!cls.ClassGroupID) {
      return this.findById(classId);
    }
    
    const primary = db.prepare(`
      SELECT ID FROM Classes WHERE ClassGroupID = ? AND SessionNumber = 1
    `).get(cls.ClassGroupID);
    
    return primary ? this.findById(primary.ID) : this.findById(classId);
  }

  static findById(id) {
    const classData = db.prepare(`
      SELECT c.*, 
             h.Name as HonorName, h.Category as HonorCategory,
             u.FirstName as TeacherFirstName, u.LastName as TeacherLastName,
             l.Name as LocationName, l.MaxCapacity as LocationMaxCapacity,
             t.Date as TimeslotDate, t.StartTime as TimeslotStartTime, t.EndTime as TimeslotEndTime,
             COALESCE(creatorClub.Name, teacherClub.Name) as ClubName
      FROM Classes c
      LEFT JOIN Honors h ON c.HonorID = h.ID
      LEFT JOIN Users u ON c.TeacherID = u.ID
      LEFT JOIN Locations l ON c.LocationID = l.ID
      LEFT JOIN Timeslots t ON c.TimeslotID = t.ID
      LEFT JOIN Users creator ON c.CreatedBy = creator.ID
      LEFT JOIN Clubs creatorClub ON creator.ClubID = creatorClub.ID
      LEFT JOIN Clubs teacherClub ON u.ClubID = teacherClub.ID
      WHERE c.ID = ?
    `).get(id);

    if (classData) {
      // Handle null LocationMaxCapacity (when LocationID is null)
      if (classData.LocationMaxCapacity != null) {
        classData.ActualMaxCapacity = Math.min(classData.LocationMaxCapacity, classData.TeacherMaxStudents);
      } else {
        classData.ActualMaxCapacity = classData.TeacherMaxStudents;
      }
      classData.EnrolledCount = this.getEnrolledCount(id);
      classData.WaitlistCount = this.getWaitlistCount(id);
      classData.RemainingSpots = Math.max(0, classData.ActualMaxCapacity - classData.EnrolledCount);
      
      // Add multi-session info
      if (classData.ClassGroupID) {
        const sessionCount = db.prepare('SELECT COUNT(*) as count FROM Classes WHERE ClassGroupID = ?').get(classData.ClassGroupID);
        classData.TotalSessions = sessionCount.count;
        classData.IsMultiSession = true;
      } else {
        classData.TotalSessions = 1;
        classData.IsMultiSession = false;
      }
    }

    return classData;
  }

  static findByEvent(eventId, filters = {}) {
    let query = `
      SELECT c.*, 
             h.Name as HonorName, h.Category as HonorCategory,
             u.FirstName as TeacherFirstName, u.LastName as TeacherLastName,
             l.Name as LocationName, l.MaxCapacity as LocationMaxCapacity,
             t.Date as TimeslotDate, t.StartTime as TimeslotStartTime, t.EndTime as TimeslotEndTime,
             COALESCE(creatorClub.Name, teacherClub.Name) as ClubName
      FROM Classes c
      LEFT JOIN Honors h ON c.HonorID = h.ID
      LEFT JOIN Users u ON c.TeacherID = u.ID
      LEFT JOIN Locations l ON c.LocationID = l.ID
      LEFT JOIN Timeslots t ON c.TimeslotID = t.ID
      LEFT JOIN Users creator ON c.CreatedBy = creator.ID
      LEFT JOIN Clubs creatorClub ON creator.ClubID = creatorClub.ID
      LEFT JOIN Clubs teacherClub ON u.ClubID = teacherClub.ID
      WHERE c.EventID = ?
    `;
    const params = [eventId];
    
    // Filter by active status if specified
    if (filters.active !== undefined) {
      query += ' AND c.Active = ?';
      params.push(filters.active ? 1 : 0);
    }
    
    // Filter by honor active status if specified
    if (filters.honorActive !== undefined) {
      query += ' AND h.Active = ?';
      params.push(filters.honorActive ? 1 : 0);
    }

    if (filters.locationId) {
      query += ' AND c.LocationID = ?';
      params.push(filters.locationId);
    }

    if (filters.timeslotId) {
      query += ' AND c.TimeslotID = ?';
      params.push(filters.timeslotId);
    }

    if (filters.honorId) {
      query += ' AND c.HonorID = ?';
      params.push(filters.honorId);
    }

    if (filters.category) {
      query += ' AND h.Category = ?';
      params.push(filters.category);
    }

    if (filters.teacherId) {
      query += ' AND c.TeacherID = ?';
      params.push(filters.teacherId);
    }

    query += ' ORDER BY t.Date, t.StartTime, h.Name';

    const classes = db.prepare(query).all(...params);
    
    // Cache session counts for groups to avoid repeated queries
    const sessionCountCache = {};
    
    return classes.map(cls => {
      // Handle null LocationMaxCapacity (when LocationID is null)
      if (cls.LocationMaxCapacity != null) {
        cls.ActualMaxCapacity = Math.min(cls.LocationMaxCapacity, cls.TeacherMaxStudents);
      } else {
        cls.ActualMaxCapacity = cls.TeacherMaxStudents;
      }
      cls.EnrolledCount = this.getEnrolledCount(cls.ID);
      cls.WaitlistCount = this.getWaitlistCount(cls.ID);
      cls.RemainingSpots = Math.max(0, cls.ActualMaxCapacity - cls.EnrolledCount);
      
      // Add multi-session info
      if (cls.ClassGroupID) {
        if (!sessionCountCache[cls.ClassGroupID]) {
          const sessionCount = db.prepare('SELECT COUNT(*) as count FROM Classes WHERE ClassGroupID = ?').get(cls.ClassGroupID);
          sessionCountCache[cls.ClassGroupID] = sessionCount.count;
        }
        cls.TotalSessions = sessionCountCache[cls.ClassGroupID];
        cls.IsMultiSession = true;
      } else {
        cls.TotalSessions = 1;
        cls.IsMultiSession = false;
      }
      
      return cls;
    });
  }

  static getEnrolledCount(classId) {
    const result = db.prepare('SELECT COUNT(*) as count FROM Registrations WHERE ClassID = ? AND Status = ?').get(classId, 'Enrolled');
    return result.count;
  }

  static getWaitlistCount(classId) {
    const result = db.prepare('SELECT COUNT(*) as count FROM Registrations WHERE ClassID = ? AND Status = ?').get(classId, 'Waitlisted');
    return result.count;
  }

  static update(id, updates) {
    const allowedUpdates = ['TeacherID', 'LocationID', 'MaxCapacity', 'TeacherMaxStudents', 'Active'];
    const setClause = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key)) {
        // Convert boolean values to integers for SQLite
        let dbValue = value;
        if (typeof value === 'boolean') {
          dbValue = value ? 1 : 0;
        } else if (value === null || value === undefined) {
          dbValue = null;
        }
        
        setClause.push(`${key} = ?`);
        values.push(dbValue);
      }
    }

    if (setClause.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const stmt = db.prepare(`UPDATE Classes SET ${setClause.join(', ')} WHERE ID = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  static deactivate(id) {
    const cls = db.prepare('SELECT ClassGroupID FROM Classes WHERE ID = ?').get(id);
    
    if (cls && cls.ClassGroupID) {
      // Multi-session class - deactivate all sessions in the group
      return db.transaction(() => {
        const groupClasses = db.prepare('SELECT ID FROM Classes WHERE ClassGroupID = ?').all(cls.ClassGroupID);
        for (const groupCls of groupClasses) {
          db.prepare('DELETE FROM Registrations WHERE ClassID = ?').run(groupCls.ID);
          db.prepare('UPDATE Classes SET Active = 0 WHERE ID = ?').run(groupCls.ID);
        }
        return this.findById(id);
      })();
    } else {
      // Single-session class
      db.prepare('DELETE FROM Registrations WHERE ClassID = ?').run(id);
      return this.update(id, { Active: 0 });
    }
  }

  static activate(id) {
    const cls = db.prepare('SELECT ClassGroupID FROM Classes WHERE ID = ?').get(id);
    
    if (cls && cls.ClassGroupID) {
      // Multi-session class - activate all sessions in the group
      return db.transaction(() => {
        db.prepare('UPDATE Classes SET Active = 1 WHERE ClassGroupID = ?').run(cls.ClassGroupID);
        return this.findById(id);
      })();
    } else {
      // Single-session class
      return this.update(id, { Active: 1 });
    }
  }

  static getTeacherlessClasses(eventId) {
    return db.prepare(`
      SELECT c.*, h.Name as HonorName
      FROM Classes c
      LEFT JOIN Honors h ON c.HonorID = h.ID
      WHERE c.EventID = ? AND c.TeacherID IS NULL AND c.Active = 1
    `).all(eventId);
  }
}

module.exports = Class;


