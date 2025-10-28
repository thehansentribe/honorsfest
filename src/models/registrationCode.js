const { db } = require('../config/db');
const crypto = require('crypto');

class RegistrationCode {
  static generate(clubId, eventId, createdBy, expiresInDays = 30) {
    // Generate a random 8-character alphanumeric code
    const code = crypto.randomBytes(4).toString('hex').toUpperCase();
    
    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    
    const result = db.prepare(`
      INSERT INTO RegistrationCodes (Code, ClubID, EventID, CreatedBy, ExpiresAt)
      VALUES (?, ?, ?, ?, ?)
    `).run(code, clubId, eventId, createdBy, expiresAt.toISOString());
    
    const record = db.prepare('SELECT * FROM RegistrationCodes WHERE ID = ?').get(result.lastInsertRowid);
    return record;
  }

  static findByCode(code) {
    return db.prepare('SELECT * FROM RegistrationCodes WHERE Code = ?').get(code);
  }

  static validate(code) {
    const record = db.prepare('SELECT * FROM RegistrationCodes WHERE Code = ?').get(code);
    
    if (!record) {
      return { valid: false, error: 'Invalid registration code' };
    }
    
    // Check expiration date only - codes can be reused multiple times until expired
    const expiresAt = new Date(record.ExpiresAt);
    const now = new Date();
    
    if (now > expiresAt) {
      return { valid: false, error: 'This code has expired' };
    }
    
    return { valid: true, code: record };
  }

  static markUsed(code) {
    db.prepare(`
      UPDATE RegistrationCodes 
      SET Used = 1, UsedAt = datetime('now')
      WHERE Code = ?
    `).run(code);
  }

  static findByClub(clubId) {
    return db.prepare(`
      SELECT c.*, u.FirstName as CreatorFirstName, u.LastName as CreatorLastName
      FROM RegistrationCodes c
      JOIN Users u ON c.CreatedBy = u.ID
      WHERE c.ClubID = ?
      ORDER BY c.CreatedAt DESC
    `).all(clubId);
  }
}

module.exports = RegistrationCode;

