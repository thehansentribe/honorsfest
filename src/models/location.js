const { db } = require('../config/db');

class Location {
  static create(locationData) {
    const { EventID, Name, Description, MaxCapacity } = locationData;
    
    const stmt = db.prepare(`
      INSERT INTO Locations (EventID, Name, Description, MaxCapacity)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(EventID, Name, Description || null, MaxCapacity);

    return this.findById(result.lastInsertRowid);
  }

  static findById(id) {
    return db.prepare('SELECT * FROM Locations WHERE ID = ?').get(id);
  }

  static findByEvent(eventId) {
    return db.prepare('SELECT * FROM Locations WHERE EventID = ? ORDER BY Name').all(eventId);
  }

  static update(id, updates) {
    const allowedUpdates = ['Name', 'Description', 'MaxCapacity'];
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
    const stmt = db.prepare(`UPDATE Locations SET ${setClause.join(', ')} WHERE ID = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  static delete(id) {
    // Check if any classes use this location
    const classCount = db.prepare('SELECT COUNT(*) as count FROM Classes WHERE LocationID = ?').get(id);
    if (classCount.count > 0) {
      throw new Error('Cannot delete location: Classes are still using this location');
    }
    
    const stmt = db.prepare('DELETE FROM Locations WHERE ID = ?');
    const result = stmt.run(id);
    return result.changes > 0;
  }
}

module.exports = Location;


