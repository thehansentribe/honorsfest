const { db } = require('../config/db');

class Timeslot {
  static create(timeslotData) {
    const { EventID, Date, StartTime, EndTime } = timeslotData;
    
    const stmt = db.prepare(`
      INSERT INTO Timeslots (EventID, Date, StartTime, EndTime)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(EventID, Date, StartTime, EndTime);

    return this.findById(result.lastInsertRowid);
  }

  static findById(id) {
    return db.prepare('SELECT * FROM Timeslots WHERE ID = ?').get(id);
  }

  static findByEvent(eventId) {
    return db.prepare('SELECT * FROM Timeslots WHERE EventID = ? ORDER BY Date, StartTime').all(eventId);
  }

  static update(id, updates) {
    const allowedUpdates = ['Date', 'StartTime', 'EndTime'];
    const setClause = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key)) {
        // Convert boolean values to integers for SQLite
        let dbValue = value;
        if (typeof value === 'boolean') {
          dbValue = value ? 1 : 0;
        }
        
        setClause.push(`${key} = ?`);
        values.push(dbValue);
      }
    }

    if (setClause.length === 0) {
      return this.findById(id);
    }

    values.push(id);
    const stmt = db.prepare(`UPDATE Timeslots SET ${setClause.join(', ')} WHERE ID = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  static hasConflict(newDate, newStartTime, newEndTime, excludeId = null) {
    let query = `
      SELECT * FROM Timeslots
      WHERE Date = ? AND (
        (StartTime <= ? AND EndTime > ?) OR
        (StartTime < ? AND EndTime >= ?) OR
        (StartTime >= ? AND EndTime <= ?)
      )
    `;
    const params = [newDate, newStartTime, newStartTime, newEndTime, newEndTime, newStartTime, newEndTime];

    if (excludeId) {
      query += ' AND ID != ?';
      params.push(excludeId);
    }

    const result = db.prepare(query).get(...params);
    return !!result;
  }
}

module.exports = Timeslot;


