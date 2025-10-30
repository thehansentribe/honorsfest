require('dotenv').config();
const { db } = require('./db');

function migrateDatabase() {
  try {
    console.log('Running database migration...');
    
    // Check if Age column exists
    const tableInfo = db.prepare("PRAGMA table_info(Users)").all();
    const hasAge = tableInfo.some(col => col.name === 'Age');
    const hasDateOfBirth = tableInfo.some(col => col.name === 'DateOfBirth');
    
    if (hasAge && !hasDateOfBirth) {
      console.log('Migrating Users table from Age to DateOfBirth...');
      
      // Add DateOfBirth column
      db.exec('ALTER TABLE Users ADD COLUMN DateOfBirth TEXT');
      
      // Try to migrate existing data (set a default date)
      const defaultDate = new Date(new Date().getFullYear() - 99, 0, 1).toISOString().split('T')[0];
      db.exec(`UPDATE Users SET DateOfBirth = '${defaultDate}' WHERE DateOfBirth IS NULL`);
      
      console.log('Migration completed successfully');
    } else if (!hasDateOfBirth) {
      console.log('Adding DateOfBirth column to Users table...');
      db.exec('ALTER TABLE Users ADD COLUMN DateOfBirth TEXT');
    } else {
      console.log('Database schema is up to date');
    }

    // Check Events table for role label columns
    const eventsTableInfo = db.prepare("PRAGMA table_info(Events)").all();
    const hasRoleLabels = eventsTableInfo.some(col => col.name === 'RoleLabelStudent');
    
    if (!hasRoleLabels) {
      console.log('Adding role label columns to Events table...');
      db.exec('ALTER TABLE Events ADD COLUMN RoleLabelStudent TEXT DEFAULT \'Student\'');
      db.exec('ALTER TABLE Events ADD COLUMN RoleLabelTeacher TEXT DEFAULT \'Teacher\'');
      db.exec('ALTER TABLE Events ADD COLUMN RoleLabelStaff TEXT DEFAULT \'Staff\'');
      db.exec('ALTER TABLE Events ADD COLUMN RoleLabelClubDirector TEXT DEFAULT \'Club Director\'');
      db.exec('ALTER TABLE Events ADD COLUMN RoleLabelEventAdmin TEXT DEFAULT \'Event Admin\'');
      console.log('Role label columns added successfully');
    }
    
    // Check Classes table for CreatedBy column
    const classesTableInfo = db.prepare("PRAGMA table_info(Classes)").all();
    const hasCreatedBy = classesTableInfo.some(col => col.name === 'CreatedBy');
    
    if (!hasCreatedBy) {
      console.log('Adding CreatedBy column to Classes table...');
      db.exec('ALTER TABLE Classes ADD COLUMN CreatedBy INTEGER');
      // Set existing classes to null (created by admin/system)
      db.exec('UPDATE Classes SET CreatedBy = NULL WHERE CreatedBy IS NULL');
      console.log('CreatedBy column added successfully');
    }
    
  } catch (error) {
    console.error('Migration error:', error);
    // Don't throw, just log
  }
}

module.exports = { migrateDatabase };

