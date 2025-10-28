const { db } = require('../config/db');

class Club {
  static create(clubData) {
    const { EventID, Name, Church, DirectorID } = clubData;
    
    const stmt = db.prepare(`
      INSERT INTO Clubs (EventID, Name, Church, DirectorID)
      VALUES (?, ?, ?, ?)
    `);

    const result = stmt.run(EventID, Name, Church || null, DirectorID || null);

    return this.findById(result.lastInsertRowid);
  }

  static findById(id) {
    return db.prepare(`
      SELECT c.*, u.FirstName as DirectorFirstName, u.LastName as DirectorLastName
      FROM Clubs c
      LEFT JOIN Users u ON c.DirectorID = u.ID
      WHERE c.ID = ?
    `).get(id);
  }

  static findByEvent(eventId) {
    return db.prepare(`
      SELECT c.*, u.FirstName as DirectorFirstName, u.LastName as DirectorLastName
      FROM Clubs c
      LEFT JOIN Users u ON c.DirectorID = u.ID
      WHERE c.EventID = ?
      ORDER BY c.Name
    `).all(eventId);
  }

  static update(id, updates) {
    const allowedUpdates = ['Name', 'Church', 'DirectorID'];
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
    const stmt = db.prepare(`UPDATE Clubs SET ${setClause.join(', ')} WHERE ID = ?`);
    stmt.run(...values);

    return this.findById(id);
  }
}

module.exports = Club;


