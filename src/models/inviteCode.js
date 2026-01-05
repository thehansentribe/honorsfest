const { db } = require('../config/db');
const crypto = require('crypto');

class InviteCode {
  static generate(inviteData, createdBy, expiresInDays = 30) {
    const { FirstName, LastName, Email, Role, ClubID, EventID } = inviteData;
    
    // Generate a random 10-character alphanumeric code
    const code = crypto.randomBytes(5).toString('hex').toUpperCase();
    
    // Calculate expiration date
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    
    const result = db.prepare(`
      INSERT INTO InviteCodes (Code, FirstName, LastName, Email, Role, ClubID, EventID, CreatedBy, ExpiresAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(code, FirstName, LastName, Email, Role, ClubID || null, EventID || null, createdBy, expiresAt.toISOString());
    
    const record = db.prepare('SELECT * FROM InviteCodes WHERE ID = ?').get(result.lastInsertRowid);
    return record;
  }

  static findByCode(code) {
    return db.prepare('SELECT * FROM InviteCodes WHERE Code = ?').get(code.toUpperCase());
  }

  static validate(code) {
    const record = db.prepare('SELECT * FROM InviteCodes WHERE Code = ?').get(code.toUpperCase());
    
    if (!record) {
      return { valid: false, error: 'Invalid invite code' };
    }
    
    // Check if already used
    if (record.Used === 1) {
      return { valid: false, error: 'This invite code has already been used' };
    }
    
    // Check expiration date
    const expiresAt = new Date(record.ExpiresAt);
    const now = new Date();
    
    if (now > expiresAt) {
      return { valid: false, error: 'This invite code has expired' };
    }
    
    return { valid: true, code: record };
  }

  static markUsed(code) {
    db.prepare(`
      UPDATE InviteCodes 
      SET Used = 1, UsedAt = datetime('now')
      WHERE Code = ?
    `).run(code.toUpperCase());
  }

  static findByCreatedBy(createdBy) {
    return db.prepare(`
      SELECT * FROM InviteCodes 
      WHERE CreatedBy = ?
      ORDER BY CreatedAt DESC
    `).all(createdBy);
  }

  static delete(code) {
    return db.prepare('DELETE FROM InviteCodes WHERE Code = ?').run(code.toUpperCase());
  }

  static resetTime(code, expiresInDays = 30) {
    const now = new Date();
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + expiresInDays);
    
    db.prepare(`
      UPDATE InviteCodes 
      SET CreatedAt = ?,
          ExpiresAt = ?
      WHERE Code = ? AND Used = 0
    `).run(now.toISOString(), expiresAt.toISOString(), code.toUpperCase());
    
    return db.prepare('SELECT * FROM InviteCodes WHERE Code = ?').get(code.toUpperCase());
  }
}

module.exports = InviteCode;

