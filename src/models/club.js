const { db } = require('../config/db');

class Club {
  static create(clubData) {
    const { Name, Church, DirectorID } = clubData;
    
    const stmt = db.prepare(`
      INSERT INTO Clubs (Name, Church, DirectorID)
      VALUES (?, ?, ?)
    `);

    const result = stmt.run(Name, Church || null, DirectorID || null);

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
      INNER JOIN ClubEvents ce ON c.ID = ce.ClubID
      LEFT JOIN Users u ON c.DirectorID = u.ID
      WHERE ce.EventID = ?
      ORDER BY c.Name
    `).all(eventId);
  }

  static findByEvents(eventIds) {
    if (!eventIds || eventIds.length === 0) {
      return [];
    }
    
    const placeholders = eventIds.map(() => '?').join(',');
    return db.prepare(`
      SELECT DISTINCT c.*, u.FirstName as DirectorFirstName, u.LastName as DirectorLastName
      FROM Clubs c
      INNER JOIN ClubEvents ce ON c.ID = ce.ClubID
      LEFT JOIN Users u ON c.DirectorID = u.ID
      WHERE ce.EventID IN (${placeholders})
      ORDER BY c.Name
    `).all(...eventIds);
  }

  static getEvents(clubId) {
    return db.prepare(`
      SELECT e.*, ce.CreatedAt as LinkedAt
      FROM Events e
      INNER JOIN ClubEvents ce ON e.ID = ce.EventID
      WHERE ce.ClubID = ?
      ORDER BY e.StartDate DESC
    `).all(clubId);
  }

  static addToEvent(clubId, eventId) {
    try {
      const stmt = db.prepare(`
        INSERT INTO ClubEvents (ClubID, EventID)
        VALUES (?, ?)
      `);
      stmt.run(clubId, eventId);
      return true;
    } catch (error) {
      if (error.message.includes('UNIQUE constraint')) {
        // Already linked, return true
        return true;
      }
      throw error;
    }
  }

  static removeFromEvent(clubId, eventId) {
    const stmt = db.prepare(`
      DELETE FROM ClubEvents
      WHERE ClubID = ? AND EventID = ?
    `);
    const result = stmt.run(clubId, eventId);
    return result.changes > 0;
  }

  static isInEvent(clubId, eventId) {
    const result = db.prepare(`
      SELECT 1
      FROM ClubEvents
      WHERE ClubID = ? AND EventID = ?
    `).get(clubId, eventId);
    return !!result;
  }

  static getAll() {
    return db.prepare(`
      SELECT c.*, u.FirstName as DirectorFirstName, u.LastName as DirectorLastName
      FROM Clubs c
      LEFT JOIN Users u ON c.DirectorID = u.ID
      ORDER BY c.Name
    `).all();
  }

  static getAllWithEvents() {
    const rows = db.prepare(`
      SELECT 
        c.*,
        u.FirstName as DirectorFirstName,
        u.LastName as DirectorLastName,
        GROUP_CONCAT(e.ID || '|' || e.Name, ';') as EventList
      FROM Clubs c
      LEFT JOIN Users u ON c.DirectorID = u.ID
      LEFT JOIN ClubEvents ce ON c.ID = ce.ClubID
      LEFT JOIN Events e ON ce.EventID = e.ID
      GROUP BY c.ID
      ORDER BY c.Name
    `).all();

    return rows.map(row => {
      const events = row.EventList
        ? row.EventList.split(';').filter(Boolean).map(eventEntry => {
            const [id, name] = eventEntry.split('|');
            return {
              ID: id ? parseInt(id, 10) : null,
              Name: name || ''
            };
          })
        : [];

      const { EventList, ...club } = row;
      return {
        ...club,
        Events: events
      };
    });
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


