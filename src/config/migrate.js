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
    
    // Clean up honor names (remove trailing backslashes)
    const honors = db.prepare('SELECT ID, Name FROM Honors WHERE Name LIKE ?').all('%\\%');
    if (honors.length > 0) {
      console.log(`Cleaning ${honors.length} honor names with trailing backslashes...`);
      const updateStmt = db.prepare('UPDATE Honors SET Name = REPLACE(Name, ?, ?) WHERE Name LIKE ?');
      updateStmt.run('\\', '', '%\\%');
      console.log('Honor names cleaned');
    }
    
  } catch (error) {
    console.error('Migration error:', error);
    // Don't throw, just log
  }
}

module.exports = { migrateDatabase };

