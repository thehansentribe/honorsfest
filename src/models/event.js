const { db } = require('../config/db');

class Event {
  static create(eventData) {
    const { Name, StartDate, EndDate, Status, Active, Description, CoordinatorName, LocationDescription, Street, City, State, ZIP, RoleLabelStudent, RoleLabelTeacher, RoleLabelStaff, RoleLabelClubDirector, RoleLabelEventAdmin } = eventData;
    
    const stmt = db.prepare(`
      INSERT INTO Events (Name, StartDate, EndDate, Status, Active, Description, CoordinatorName, LocationDescription, Street, City, State, ZIP, RoleLabelStudent, RoleLabelTeacher, RoleLabelStaff, RoleLabelClubDirector, RoleLabelEventAdmin)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      Name,
      StartDate,
      EndDate,
      Status || 'Closed',
      Active !== undefined ? (Active ? 1 : 0) : 1,
      Description || null,
      CoordinatorName,
      LocationDescription || null,
      Street || null,
      City || null,
      State || null,
      ZIP || null,
      RoleLabelStudent || 'Student',
      RoleLabelTeacher || 'Teacher',
      RoleLabelStaff || 'Staff',
      RoleLabelClubDirector || 'Club Director',
      RoleLabelEventAdmin || 'Event Admin'
    );

    return this.findById(result.lastInsertRowid);
  }

  static findById(id) {
    return db.prepare('SELECT * FROM Events WHERE ID = ?').get(id);
  }

  static getAll(filters = {}) {
    let query = 'SELECT * FROM Events WHERE 1=1';
    const params = [];

    // Filter by Active status if specified
    if (filters.active !== undefined) {
      query += ' AND Active = ?';
      params.push(filters.active ? 1 : 0);
    }

    query += ' ORDER BY StartDate DESC';
    return db.prepare(query).all(...params);
  }

  // Get events where a club participates
  static getEventsForClub(clubId) {
    return db.prepare(`
      SELECT e.*
      FROM Events e
      INNER JOIN ClubEvents ce ON e.ID = ce.EventID
      WHERE ce.ClubID = ? AND e.Active = 1
      ORDER BY e.StartDate DESC
    `).all(clubId);
  }

  static update(id, updates) {
    const allowedUpdates = ['Name', 'StartDate', 'EndDate', 'Status', 'Active', 'Description', 'CoordinatorName', 'LocationDescription', 'Street', 'City', 'State', 'ZIP', 'RoleLabelStudent', 'RoleLabelTeacher', 'RoleLabelStaff', 'RoleLabelClubDirector', 'RoleLabelEventAdmin'];
    const setClause = [];
    const values = [];

    for (const [key, value] of Object.entries(updates)) {
      if (allowedUpdates.includes(key)) {
        // Convert boolean values to integers for SQLite
        // Also ensure integers 0/1 are preserved correctly
        let dbValue = value;
        if (key === 'Active') {
          // Explicitly handle Active field - convert to integer 0 or 1
          // Handle boolean, number, or string '0'/'1'
          if (value === true || value === 1 || value === '1') {
            dbValue = 1;
          } else if (value === false || value === 0 || value === '0') {
            dbValue = 0;
          } else {
            // Default fallback
            dbValue = value ? 1 : 0;
          }
        } else if (typeof value === 'boolean') {
          dbValue = value ? 1 : 0;
        }
        
        setClause.push(`${key} = ?`);
        values.push(dbValue);
      }
    }

    if (setClause.length === 0) {
      return this.findById(id);
    }

    // Validate Live status: must have at least one class assigned
    if (updates.Status === 'Live') {
      const classCount = db.prepare('SELECT COUNT(*) as count FROM Classes WHERE EventID = ?').get(id);
      if (classCount.count === 0) {
        throw new Error('Cannot set Live: No classes assigned to this event.');
      }
      // If setting to Live, also ensure Active is true
      if (updates.Active === false) {
        throw new Error('Cannot set Live status for inactive event. Set Active to true first.');
      }
    }

    // If setting Active to false or 0, automatically close registration (Status = Closed)
    if (updates.hasOwnProperty('Active') && (updates.Active === false || updates.Active === 0)) {
      // Always close registration when event is closed, even if Status is explicitly set
      if (allowedUpdates.includes('Status') && !setClause.includes('Status = ?')) {
        setClause.push('Status = ?');
        values.push('Closed');
      }
    }
    // Note: When opening an event (Active = true/1), we do NOT automatically open registration
    // Registration must be manually opened using the registration toggle button
    
    values.push(id);
    const updateQuery = `UPDATE Events SET ${setClause.join(', ')} WHERE ID = ?`;
    const stmt = db.prepare(updateQuery);
    stmt.run(...values);

    const updated = this.findById(id);
    return updated;
  }

  // Get role label for a given role type
  static getRoleLabel(eventId, roleType) {
    const event = this.findById(eventId);
    if (!event) return roleType; // Fallback to role type if event not found
    
    const labelMap = {
      'Student': event.RoleLabelStudent || 'Student',
      'Teacher': event.RoleLabelTeacher || 'Teacher',
      'Staff': event.RoleLabelStaff || 'Staff',
      'ClubDirector': event.RoleLabelClubDirector || 'Club Director',
      'EventAdmin': event.RoleLabelEventAdmin || 'Event Admin',
      'Admin': 'Admin' // Admin is system-wide and not customizable
    };
    
    return labelMap[roleType] || roleType;
  }
}

module.exports = Event;


