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
    
    // Check Users table for CheckInNumber and CheckedIn columns
    const usersTableInfo = db.prepare("PRAGMA table_info(Users)").all();
    const hasCheckInNumber = usersTableInfo.some(col => col.name === 'CheckInNumber');
    const hasCheckedIn = usersTableInfo.some(col => col.name === 'CheckedIn');
    
    if (!hasCheckInNumber) {
      console.log('Adding CheckInNumber column to Users table...');
      db.exec('ALTER TABLE Users ADD COLUMN CheckInNumber INTEGER');
      // Generate check-in numbers for existing users
      const users = db.prepare('SELECT ID FROM Users ORDER BY ID').all();
      users.forEach((user, index) => {
        db.prepare('UPDATE Users SET CheckInNumber = ? WHERE ID = ?').run(1000 + index + 1, user.ID);
      });
      console.log(`Generated check-in numbers for ${users.length} existing users`);
    }
    
    if (!hasCheckedIn) {
      console.log('Adding CheckedIn column to Users table...');
      db.exec('ALTER TABLE Users ADD COLUMN CheckedIn BOOLEAN DEFAULT 0');
      console.log('CheckedIn column added successfully');
    }
    
    // Check Users table for Stytch columns
    const hasStytchUserId = usersTableInfo.some(col => col.name === 'stytch_user_id');
    const hasAuthMethod = usersTableInfo.some(col => col.name === 'auth_method');
    
    if (!hasStytchUserId) {
      console.log('Adding stytch_user_id column to Users table...');
      db.exec('ALTER TABLE Users ADD COLUMN stytch_user_id TEXT');
      console.log('✓ stytch_user_id column added');
    }
    
    if (!hasAuthMethod) {
      console.log('Adding auth_method column to Users table...');
      db.exec(`ALTER TABLE Users ADD COLUMN auth_method TEXT NOT NULL DEFAULT 'local'`);
      // Set all existing users to local auth method (normalize any 'password' to 'local')
      db.exec(`UPDATE Users SET auth_method = 'local' WHERE auth_method IS NULL OR auth_method = 'password'`);
      console.log('✓ auth_method column added');
    } else {
      // If column already exists but has 'password' as default, update existing values
      const passwordUsers = db.prepare("SELECT COUNT(*) as count FROM Users WHERE auth_method = 'password'").get();
      if (passwordUsers.count > 0) {
        console.log(`Migrating ${passwordUsers.count} users from 'password' to 'local' auth_method`);
        db.exec(`UPDATE Users SET auth_method = 'local' WHERE auth_method = 'password'`);
      }
    }
    
  } catch (error) {
    console.error('Migration error:', error);
    // Don't throw, just log
  }
}

module.exports = { migrateDatabase };

