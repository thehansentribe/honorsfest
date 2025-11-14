const { db } = require('../config/db');

class Class {
  static create(classData) {
    const { EventID, HonorID, TeacherID, LocationID, TimeslotID, MaxCapacity, TeacherMaxStudents, CreatedBy } = classData;
    
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
      INSERT INTO Classes (EventID, HonorID, TeacherID, LocationID, TimeslotID, MaxCapacity, TeacherMaxStudents, CreatedBy)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      EventID,
      HonorID,
      TeacherID || null,
      LocationID,
      TimeslotID,
      actualCapacity,
      TeacherMaxStudents,
      CreatedBy || null
    );

    return this.findById(result.lastInsertRowid);
  }

  static findById(id) {
    const classData = db.prepare(`
      SELECT c.*, 
             h.Name as HonorName, h.Category as HonorCategory,
             u.FirstName as TeacherFirstName, u.LastName as TeacherLastName,
             l.Name as LocationName, l.MaxCapacity as LocationMaxCapacity,
             t.Date as TimeslotDate, t.StartTime as TimeslotStartTime, t.EndTime as TimeslotEndTime
      FROM Classes c
      LEFT JOIN Honors h ON c.HonorID = h.ID
      LEFT JOIN Users u ON c.TeacherID = u.ID
      LEFT JOIN Locations l ON c.LocationID = l.ID
      LEFT JOIN Timeslots t ON c.TimeslotID = t.ID
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
    }

    return classData;
  }

  static findByEvent(eventId, filters = {}) {
    let query = `
      SELECT c.*, 
             h.Name as HonorName, h.Category as HonorCategory,
             u.FirstName as TeacherFirstName, u.LastName as TeacherLastName,
             l.Name as LocationName, l.MaxCapacity as LocationMaxCapacity,
             t.Date as TimeslotDate, t.StartTime as TimeslotStartTime, t.EndTime as TimeslotEndTime
      FROM Classes c
      LEFT JOIN Honors h ON c.HonorID = h.ID
      LEFT JOIN Users u ON c.TeacherID = u.ID
      LEFT JOIN Locations l ON c.LocationID = l.ID
      LEFT JOIN Timeslots t ON c.TimeslotID = t.ID
      WHERE c.EventID = ?
    `;
    const params = [eventId];
    
    // Filter by active status if specified
    if (filters.active !== undefined) {
      query += ' AND c.Active = ?';
      params.push(filters.active ? 1 : 0);
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
    // Remove all registrations
    db.prepare('DELETE FROM Registrations WHERE ClassID = ?').run(id);
    
    // Deactivate class
    return this.update(id, { Active: 0 });
  }

  static activate(id) {
    // Reactivate class (no students will be registered)
    return this.update(id, { Active: 1 });
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


