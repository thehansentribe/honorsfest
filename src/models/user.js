const { db } = require('../config/db');

class User {
  static generateUsername(firstName, lastName) {
    // Force lowercase for consistency
    const normalizedFirst = firstName.toLowerCase();
    const normalizedLast = lastName.toLowerCase();
    
    const baseUsername = `${normalizedFirst}.${normalizedLast}`;
    let username = baseUsername;
    let counter = 1;

    while (this.usernameExists(username)) {
      username = `${baseUsername}${counter}`;
      counter++;
    }

    return username;
  }

  static usernameExists(username) {
    const result = db.prepare('SELECT ID FROM Users WHERE Username = ?').get(username);
    return !!result;
  }

  static calculateAge(dateOfBirth) {
    if (!dateOfBirth) return null;
    const today = new Date();
    const birthDate = new Date(dateOfBirth);
    let age = today.getFullYear() - birthDate.getFullYear();
    const monthDiff = today.getMonth() - birthDate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  static isAdult(dateOfBirth) {
    const age = this.calculateAge(dateOfBirth);
    return age !== null && age >= 18;
  }

  static create(userData) {
    const { FirstName, LastName, DateOfBirth, Email, Phone, PasswordHash, Role, InvestitureLevel, ClubID, EventID, Active, BackgroundCheck } = userData;
    
    const Username = this.generateUsername(FirstName, LastName);
    
    const stmt = db.prepare(`
      INSERT INTO Users (FirstName, LastName, Username, DateOfBirth, Email, Phone, PasswordHash, Role, InvestitureLevel, ClubID, EventID, Active, BackgroundCheck)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      FirstName,
      LastName,
      Username,
      DateOfBirth || null,
      Email || null,
      Phone || null,
      PasswordHash,
      Role,
      InvestitureLevel || 'None',
      ClubID || null,
      EventID || null,
      Active !== undefined ? (Active ? 1 : 0) : 1,
      BackgroundCheck !== undefined ? (BackgroundCheck ? 1 : 0) : 0
    );

    return this.findById(result.lastInsertRowid);
  }

  static bulkCreate(users) {
    const insertStmt = db.prepare(`
      INSERT INTO Users (FirstName, LastName, Username, DateOfBirth, Email, Phone, PasswordHash, Role, InvestitureLevel, ClubID, EventID, Active, BackgroundCheck)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const usersCreated = [];
    const insertMany = db.transaction((userList) => {
      for (const userData of userList) {
        const { FirstName, LastName, DateOfBirth, Email, Phone, Role, InvestitureLevel, ClubID, EventID, Active, BackgroundCheck, PasswordHash } = userData;
        
        const Username = this.generateUsername(FirstName, LastName);
        
        const result = insertStmt.run(
          FirstName,
          LastName,
          Username,
          DateOfBirth || null,
          Email || null,
          Phone || null,
          PasswordHash,
          Role,
          InvestitureLevel || 'None',
          ClubID || null,
          EventID || null,
          Active !== undefined ? (Active ? 1 : 0) : 1,
          BackgroundCheck !== undefined ? (BackgroundCheck ? 1 : 0) : 0
        );

        const user = this.findById(result.lastInsertRowid);
        usersCreated.push(user);
      }
    });

    insertMany(users);
    return usersCreated;
  }

  static findById(id) {
    const user = db.prepare('SELECT * FROM Users WHERE ID = ?').get(id);
    if (user) {
      // Calculate age from DateOfBirth
      user.Age = user.DateOfBirth ? this.calculateAge(user.DateOfBirth) : null;
      user.IsAdult = user.DateOfBirth ? this.isAdult(user.DateOfBirth) : false;
    }
    return user;
  }

  static findByUsername(username) {
    const user = db.prepare('SELECT * FROM Users WHERE Username = ?').get(username);
    if (user) {
      user.Age = user.DateOfBirth ? this.calculateAge(user.DateOfBirth) : null;
      user.IsAdult = user.DateOfBirth ? this.isAdult(user.DateOfBirth) : false;
    }
    return user;
  }

  static findByEmail(email) {
    return db.prepare('SELECT * FROM Users WHERE Email = ?').get(email);
  }

  static findByIdWithClub(id) {
    return db.prepare(`
      SELECT u.*, c.Name as ClubName, c.EventID
      FROM Users u
      LEFT JOIN Clubs c ON u.ClubID = c.ID
      WHERE u.ID = ?
    `).get(id);
  }

  static getAll(filters = {}) {
    let query = 'SELECT u.*, c.Name as ClubName FROM Users u LEFT JOIN Clubs c ON u.ClubID = c.ID WHERE 1=1';
    const params = [];

    if (filters.role) {
      query += ' AND u.Role = ?';
      params.push(filters.role);
    }

    if (filters.clubId) {
      query += ' AND u.ClubID = ?';
      params.push(filters.clubId);
    }

    if (filters.eventId) {
      query += ' AND c.EventID = ?';
      params.push(filters.eventId);
    }

    if (filters.active !== undefined) {
      query += ' AND u.Active = ?';
      params.push(filters.active ? 1 : 0);
    }

    query += ' ORDER BY u.LastName, u.FirstName';

    const users = db.prepare(query).all(...params);
    
    // Calculate age for each user
    return users.map(user => {
      user.Age = user.DateOfBirth ? this.calculateAge(user.DateOfBirth) : null;
      user.IsAdult = user.DateOfBirth ? this.isAdult(user.DateOfBirth) : false;
      return user;
    });
  }

  static update(id, updates) {
    const allowedUpdates = ['FirstName', 'LastName', 'DateOfBirth', 'Email', 'Phone', 'Role', 'InvestitureLevel', 'ClubID', 'EventID', 'Active', 'BackgroundCheck', 'PasswordHash'];
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
    const stmt = db.prepare(`UPDATE Users SET ${setClause.join(', ')} WHERE ID = ?`);
    stmt.run(...values);

    return this.findById(id);
  }

  static deactivate(id) {
    // Remove user from all classes
    db.prepare('DELETE FROM Registrations WHERE UserID = ?').run(id);
    
    // Update user to inactive
    return this.update(id, { Active: 0 });
  }
}

module.exports = User;

