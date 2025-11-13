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

  static generateCheckInNumber() {
    // Find the highest existing check-in number
    const maxResult = db.prepare('SELECT MAX(CheckInNumber) as maxNum FROM Users WHERE CheckInNumber IS NOT NULL').get();
    const maxNum = maxResult?.maxNum || 999;
    
    // Start from 1000 if no numbers exist, otherwise increment from max
    return maxNum >= 1000 ? maxNum + 1 : 1000;
  }

  static create(userData) {
    const { FirstName, LastName, DateOfBirth, Email, Phone, PasswordHash, Role, InvestitureLevel, ClubID, EventID, Active, Invited, InviteAccepted, BackgroundCheck, stytch_user_id, auth_method } = userData;
    
    const Username = this.generateUsername(FirstName, LastName);
    const CheckInNumber = this.generateCheckInNumber();
    
    // Ensure PasswordHash is never null (for Stytch users without local password)
    const safePasswordHash = PasswordHash || '';
    
    const stmt = db.prepare(`
      INSERT INTO Users (FirstName, LastName, Username, DateOfBirth, Email, Phone, PasswordHash, Role, InvestitureLevel, ClubID, EventID, Active, Invited, InviteAccepted, BackgroundCheck, CheckInNumber, CheckedIn, stytch_user_id, auth_method)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      FirstName,
      LastName,
      Username,
      DateOfBirth || null,
      Email || null,
      Phone || null,
      safePasswordHash,
      Role,
      InvestitureLevel || 'None',
      ClubID || null,
      EventID || null,
      Active !== undefined ? (Active ? 1 : 0) : 1,
      Invited !== undefined ? (Invited ? 1 : 0) : 0,
      InviteAccepted !== undefined ? (InviteAccepted ? 1 : 0) : 0,
      BackgroundCheck !== undefined ? (BackgroundCheck ? 1 : 0) : 0,
      CheckInNumber,
      0,  // CheckedIn defaults to false
      stytch_user_id || null,
      auth_method || 'local'
    );

    const createdUser = this.findById(result.lastInsertRowid);
    this.syncClubDirectorAssignment(createdUser);
    return createdUser;
  }

  static bulkCreate(users) {
    const insertStmt = db.prepare(`
      INSERT INTO Users (FirstName, LastName, Username, DateOfBirth, Email, Phone, PasswordHash, Role, InvestitureLevel, ClubID, EventID, Active, BackgroundCheck, CheckInNumber, CheckedIn, stytch_user_id, auth_method)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const usersCreated = [];
    const insertMany = db.transaction((userList) => {
      for (const userData of userList) {
        const { FirstName, LastName, DateOfBirth, Email, Phone, Role, InvestitureLevel, ClubID, EventID, Active, BackgroundCheck, PasswordHash, stytch_user_id, auth_method } = userData;
        
        const Username = this.generateUsername(FirstName, LastName);
        const CheckInNumber = this.generateCheckInNumber();
        
        // Ensure PasswordHash is never null
        const safePasswordHash = PasswordHash || '';
        
        const result = insertStmt.run(
          FirstName,
          LastName,
          Username,
          DateOfBirth || null,
          Email || null,
          Phone || null,
          safePasswordHash,
          Role,
          InvestitureLevel || 'None',
          ClubID || null,
          EventID || null,
          Active !== undefined ? (Active ? 1 : 0) : 1,
          BackgroundCheck !== undefined ? (BackgroundCheck ? 1 : 0) : 0,
          CheckInNumber,
          0,  // CheckedIn defaults to false
          stytch_user_id || null,
          auth_method || 'local'
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
    // Make email lookup case-insensitive
    const user = db.prepare('SELECT * FROM Users WHERE LOWER(Email) = LOWER(?)').get(email);
    if (user) {
      user.Age = user.DateOfBirth ? this.calculateAge(user.DateOfBirth) : null;
      user.IsAdult = user.DateOfBirth ? this.isAdult(user.DateOfBirth) : false;
    }
    return user;
  }

  static findByStytchUserId(stytchUserId) {
    const user = db.prepare('SELECT * FROM Users WHERE stytch_user_id = ?').get(stytchUserId);
    if (user) {
      user.Age = user.DateOfBirth ? this.calculateAge(user.DateOfBirth) : null;
      user.IsAdult = user.DateOfBirth ? this.isAdult(user.DateOfBirth) : false;
    }
    return user;
  }

  static findByIdWithClub(id) {
    return db.prepare(`
      SELECT u.*, c.Name as ClubName
      FROM Users u
      LEFT JOIN Clubs c ON u.ClubID = c.ID
      WHERE u.ID = ?
    `).get(id);
  }

  static getAll(filters = {}) {
    let query = 'SELECT u.*, c.Name as ClubName, e.Name as EventName, e.ID as EventID, u.Invited, u.InviteAccepted FROM Users u LEFT JOIN Clubs c ON u.ClubID = c.ID LEFT JOIN Events e ON u.EventID = e.ID WHERE 1=1';
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
      // Filter by users whose club is linked to the event via ClubEvents
      // OR users who have the eventID set directly (for backward compatibility)
      query += ' AND (u.EventID = ? OR EXISTS (SELECT 1 FROM ClubEvents ce WHERE ce.ClubID = u.ClubID AND ce.EventID = ?))';
      params.push(filters.eventId, filters.eventId);
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
    const currentUser = this.findById(id);
    if (!currentUser) {
      return null;
    }

    // Check if ClubID is changing
    const oldClubId = currentUser.ClubID;
    const newClubId = updates.ClubID !== undefined ? updates.ClubID : currentUser.ClubID;
    
    // If club is changing, handle the change before updating
    // This will update EventID and remove incompatible registrations
    if (oldClubId !== newClubId) {
      const newEventId = this.handleClubChange(id, oldClubId, newClubId);
      // Automatically set EventID to match new club's events
      // Unless EventID is explicitly being set in updates (in which case, explicit wins)
      if (updates.EventID === undefined) {
        updates.EventID = newEventId;
      }
    }

    const allowedUpdates = ['FirstName', 'LastName', 'DateOfBirth', 'Email', 'Phone', 'Role', 'InvestitureLevel', 'ClubID', 'EventID', 'Active', 'BackgroundCheck', 'PasswordHash', 'CheckedIn', 'stytch_user_id', 'auth_method'];
    const setClause = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key)) {
        // Convert boolean values to integers for SQLite
        let dbValue = value;
        if (typeof value === 'boolean') {
          dbValue = value ? 1 : 0;
        }
        
        // Handle null values
        if (value === null) {
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
    const stmt = db.prepare(`UPDATE Users SET ${setClause.join(', ')} WHERE ID = ?`);
    stmt.run(...values);

    const updatedUser = this.findById(id);
    this.syncClubDirectorAssignment(updatedUser);
    return updatedUser;
  }

  static findByCheckInNumber(checkInNumber) {
    const user = db.prepare('SELECT * FROM Users WHERE CheckInNumber = ?').get(checkInNumber);
    if (user) {
      user.Age = user.DateOfBirth ? this.calculateAge(user.DateOfBirth) : null;
      user.IsAdult = user.DateOfBirth ? this.isAdult(user.DateOfBirth) : false;
    }
    return user;
  }

  static getClubDirectors(clubId, excludeUserId = null) {
    if (!clubId) return [];

    let query = `
      SELECT *
      FROM Users
      WHERE ClubID = ?
        AND Role = 'ClubDirector'
        AND (Active = 1 OR Invited = 1)
    `;
    const params = [clubId];

    if (excludeUserId) {
      query += ' AND ID != ?';
      params.push(excludeUserId);
    }

    return db.prepare(query).all(...params);
  }

  static hasDirectorConflict(clubId, excludeUserId = null) {
    const directors = this.getClubDirectors(clubId, excludeUserId);
    return directors.length > 0;
  }

  static deactivate(id) {
    // Remove user from all classes
    db.prepare('DELETE FROM Registrations WHERE UserID = ?').run(id);
    
    // Update user to inactive
    return this.update(id, { Active: 0 });
  }

  /**
   * Handle club change for a user - updates EventID and removes registrations for incompatible events
   * @param {number} userId - The user ID
   * @param {number|null} oldClubId - The previous club ID (null if user had no club)
   * @param {number|null} newClubId - The new club ID (null if user is being removed from club)
   * @returns {number|null} - The new EventID that should be set for the user
   */
  static handleClubChange(userId, oldClubId, newClubId) {
    const user = this.findById(userId);
    if (!user) {
      return null;
    }

    // If club isn't actually changing, no action needed
    const oldClubIdNum = oldClubId ? parseInt(oldClubId, 10) : null;
    const newClubIdNum = newClubId ? parseInt(newClubId, 10) : null;
    if (oldClubIdNum === newClubIdNum) {
      return user.EventID; // Return current EventID, no change needed
    }

    const Club = require('./club');
    const Registration = require('./registration');

    // Get new club's events (empty array if no club)
    const newClubEvents = newClubIdNum ? Club.getEvents(newClubIdNum) : [];
    const newClubEventIds = newClubEvents.map(e => e.ID);

    // Determine new EventID: use first event if available, otherwise null
    // Events are ordered by StartDate DESC, so first is most recent
    const newEventId = newClubEvents.length > 0 ? newClubEvents[0].ID : null;

    // Remove registrations for events not in new club's events
    // Note: This only affects student registrations (enrollments), not teaching assignments
    // Teachers can still teach classes for events their club isn't in (that's stored in Class.TeacherID)
    // But if they're also registered as students in those classes, those registrations will be removed
    
    // Get all user's registrations with their class's event IDs
    const registrations = db.prepare(`
      SELECT r.ID, r.Status, c.EventID, c.ID as ClassID
      FROM Registrations r
      JOIN Classes c ON r.ClassID = c.ID
      WHERE r.UserID = ?
    `).all(userId);

    // Remove registrations for events not in new club's events
    let removedCount = 0;
    for (const reg of registrations) {
      // If new club has no events, remove all registrations
      // If new club has events, only remove registrations for events not in the list
      if (newClubEventIds.length === 0 || !newClubEventIds.includes(reg.EventID)) {
        try {
          // Use Registration.remove to properly handle waitlist processing
          Registration.remove(reg.ID);
          removedCount++;
        } catch (error) {
          console.error(`Error removing registration ${reg.ID} for user ${userId}:`, error);
        }
      }
    }

    if (removedCount > 0) {
      console.log(`Removed ${removedCount} registration(s) for user ${userId} (${user.Role}) when switching from club ${oldClubIdNum || 'none'} to club ${newClubIdNum || 'none'}`);
    }

    return newEventId;
  }

  static syncClubDirectorAssignment(user) {
    if (!user) return;

    if (user.Role === 'ClubDirector') {
      if (user.ClubID) {
        db.prepare('UPDATE Clubs SET DirectorID = NULL WHERE DirectorID = ? AND ID != ?').run(user.ID, user.ClubID);
        db.prepare('UPDATE Clubs SET DirectorID = ? WHERE ID = ?').run(user.ID, user.ClubID);
      } else {
        db.prepare('UPDATE Clubs SET DirectorID = NULL WHERE DirectorID = ?').run(user.ID);
      }
    } else {
      db.prepare('UPDATE Clubs SET DirectorID = NULL WHERE DirectorID = ?').run(user.ID);
    }
  }
}

module.exports = User;

