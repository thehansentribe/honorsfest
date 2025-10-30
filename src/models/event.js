const { db } = require('../config/db');

class Event {
  static create(eventData) {
    const { Name, StartDate, EndDate, Status, Description, CoordinatorName, LocationDescription, Street, City, State, ZIP, RoleLabelStudent, RoleLabelTeacher, RoleLabelStaff, RoleLabelClubDirector, RoleLabelEventAdmin } = eventData;
    
    const stmt = db.prepare(`
      INSERT INTO Events (Name, StartDate, EndDate, Status, Description, CoordinatorName, LocationDescription, Street, City, State, ZIP, RoleLabelStudent, RoleLabelTeacher, RoleLabelStaff, RoleLabelClubDirector, RoleLabelEventAdmin)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    const result = stmt.run(
      Name,
      StartDate,
      EndDate,
      Status || 'Closed',
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

  static getAll() {
    return db.prepare('SELECT * FROM Events ORDER BY StartDate DESC').all();
  }

  static update(id, updates) {
    const allowedUpdates = ['Name', 'StartDate', 'EndDate', 'Status', 'Description', 'CoordinatorName', 'LocationDescription', 'Street', 'City', 'State', 'ZIP', 'RoleLabelStudent', 'RoleLabelTeacher', 'RoleLabelStaff', 'RoleLabelClubDirector', 'RoleLabelEventAdmin'];
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

    // Validate Live status: must have at least one class assigned
    if (updates.Status === 'Live') {
      const classCount = db.prepare('SELECT COUNT(*) as count FROM Classes WHERE EventID = ?').get(id);
      if (classCount.count === 0) {
        throw new Error('Cannot set Live: No classes assigned to this event.');
      }
    }

    values.push(id);
    const stmt = db.prepare(`UPDATE Events SET ${setClause.join(', ')} WHERE ID = ?`);
    stmt.run(...values);

    return this.findById(id);
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


