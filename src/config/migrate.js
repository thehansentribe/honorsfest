require('dotenv').config();
const { db } = require('./db');
const { migrateUsernames } = require('./migrate-usernames');

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
    
    // Check Events table for BackgroundCheckAge column
    const hasBackgroundCheckAge = eventsTableInfo.some(col => col.name === 'BackgroundCheckAge');
    
    if (!hasBackgroundCheckAge) {
      console.log('Adding BackgroundCheckAge column to Events table...');
      db.exec('ALTER TABLE Events ADD COLUMN BackgroundCheckAge INTEGER DEFAULT 18');
      console.log('✓ BackgroundCheckAge column added (default: 18)');
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
    
    // Check Users table for Invite columns
    const hasInvited = usersTableInfo.some(col => col.name === 'Invited');
    const hasInviteAccepted = usersTableInfo.some(col => col.name === 'InviteAccepted');
    
    if (!hasInvited) {
      console.log('Adding Invited column to Users table...');
      db.exec('ALTER TABLE Users ADD COLUMN Invited BOOLEAN NOT NULL DEFAULT 0');
      console.log('✓ Invited column added');
    }
    
    if (!hasInviteAccepted) {
      console.log('Adding InviteAccepted column to Users table...');
      db.exec('ALTER TABLE Users ADD COLUMN InviteAccepted BOOLEAN DEFAULT 0');
      console.log('✓ InviteAccepted column added');
    }

    const hasSettingsTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='Settings'").get();
    if (!hasSettingsTable) {
      console.log('Creating Settings table...');
      db.exec(`
        CREATE TABLE IF NOT EXISTS Settings (
          Key TEXT PRIMARY KEY,
          Value TEXT
        )
      `);
      console.log('✓ Settings table created');
    }
    
    // Migrate InviteCodes table to include AdminViewOnly in Role CHECK constraint
    const inviteCodesTableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='InviteCodes'").get();
    if (inviteCodesTableInfo && inviteCodesTableInfo.sql) {
      const hasAdminViewOnly = inviteCodesTableInfo.sql.includes("'AdminViewOnly'");
      if (!hasAdminViewOnly) {
        console.log('Migrating InviteCodes table to include AdminViewOnly role...');
        
        // Disable foreign keys temporarily
        db.pragma('foreign_keys = OFF');
        
        // Create new table with updated constraint
        db.exec(`
          CREATE TABLE InviteCodes_new (
            ID INTEGER PRIMARY KEY AUTOINCREMENT,
            Code TEXT UNIQUE NOT NULL,
            FirstName TEXT NOT NULL,
            LastName TEXT NOT NULL,
            Email TEXT NOT NULL,
            Role TEXT NOT NULL CHECK(Role IN ('Admin', 'AdminViewOnly', 'EventAdmin', 'ClubDirector')),
            ClubID INTEGER,
            EventID INTEGER,
            CreatedBy INTEGER NOT NULL,
            CreatedAt TEXT NOT NULL DEFAULT (datetime('now')),
            ExpiresAt TEXT NOT NULL,
            Used BOOLEAN NOT NULL DEFAULT 0,
            UsedAt TEXT,
            FOREIGN KEY (ClubID) REFERENCES Clubs(ID),
            FOREIGN KEY (EventID) REFERENCES Events(ID),
            FOREIGN KEY (CreatedBy) REFERENCES Users(ID)
          )
        `);
        
        // Copy data from old table to new table
        db.exec(`
          INSERT INTO InviteCodes_new 
          SELECT * FROM InviteCodes
        `);
        
        // Drop old table
        db.exec('DROP TABLE InviteCodes');
        
        // Rename new table
        db.exec('ALTER TABLE InviteCodes_new RENAME TO InviteCodes');
        
        // Re-enable foreign keys
        db.pragma('foreign_keys = ON');
        
        console.log('✓ InviteCodes table migrated successfully');
      }
    }
    
    // Check Honors table for Active column
    const honorsTableInfo = db.prepare("PRAGMA table_info(Honors)").all();
    const hasActive = honorsTableInfo.some(col => col.name === 'Active');
    
    if (!hasActive) {
      console.log('Adding Active column to Honors table...');
      db.exec('ALTER TABLE Honors ADD COLUMN Active BOOLEAN NOT NULL DEFAULT 1');
      // Set all existing honors to active by default
      db.exec('UPDATE Honors SET Active = 1 WHERE Active IS NULL');
      console.log('✓ Active column added to Honors table');
    }
    
    // Check if unique index exists on Username
    const usernameIndexCheck = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='index' 
      AND tbl_name='Users' 
      AND (name='idx_users_username_unique' OR sql LIKE '%UNIQUE%Username%')
    `).get();

    if (!usernameIndexCheck) {
      console.log('Adding unique index on Username column...');
      db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON Users(Username)');
      console.log('✓ Unique index on Username added');
    }
    
    // Multi-session class support migration
    const classesTableInfoForGroup = db.prepare("PRAGMA table_info(Classes)").all();
    const hasClassGroupID = classesTableInfoForGroup.some(col => col.name === 'ClassGroupID');
    const hasSessionNumber = classesTableInfoForGroup.some(col => col.name === 'SessionNumber');

    if (!hasClassGroupID) {
      console.log('Adding ClassGroupID column to Classes table for multi-session support...');
      db.exec('ALTER TABLE Classes ADD COLUMN ClassGroupID TEXT');
      console.log('✓ ClassGroupID column added');
    }

    if (!hasSessionNumber) {
      console.log('Adding SessionNumber column to Classes table for multi-session support...');
      db.exec('ALTER TABLE Classes ADD COLUMN SessionNumber INTEGER DEFAULT 1');
      console.log('✓ SessionNumber column added');
    }

    // Create index for ClassGroupID if not exists
    const classGroupIndexCheck = db.prepare(`
      SELECT name FROM sqlite_master 
      WHERE type='index' 
      AND tbl_name='Classes' 
      AND name='idx_classes_group'
    `).get();

    if (!classGroupIndexCheck) {
      console.log('Creating index on ClassGroupID column...');
      db.exec('CREATE INDEX IF NOT EXISTS idx_classes_group ON Classes(ClassGroupID)');
      console.log('✓ ClassGroupID index created');
    }
    
    // Check Classes table for MinimumLevel column
    const classesTableInfoForLevel = db.prepare("PRAGMA table_info(Classes)").all();
    const hasMinimumLevel = classesTableInfoForLevel.some(col => col.name === 'MinimumLevel');
    
    if (!hasMinimumLevel) {
      console.log('Adding MinimumLevel column to Classes table for level restrictions...');
      db.exec('ALTER TABLE Classes ADD COLUMN MinimumLevel TEXT CHECK(MinimumLevel IN (\'Friend\', \'Companion\', \'Explorer\', \'Ranger\', \'Voyager\', \'Guide\', \'MasterGuide\', NULL))');
      // All existing classes will have NULL (no restriction) by default
      console.log('✓ MinimumLevel column added (existing classes set to NULL - all levels welcome)');
    }
    
    // Check Classes table for ClubID column (explicit club attribution)
    const classesTableInfoForClub = db.prepare("PRAGMA table_info(Classes)").all();
    const hasClubID = classesTableInfoForClub.some(col => col.name === 'ClubID');
    
    if (!hasClubID) {
      console.log('Adding ClubID column to Classes table for explicit club attribution...');
      db.exec('ALTER TABLE Classes ADD COLUMN ClubID INTEGER REFERENCES Clubs(ID)');
      
      // Backfill ClubID based on existing data (creator's club or teacher's club)
      console.log('Backfilling ClubID for existing classes...');
      const classesToBackfill = db.prepare(`
        SELECT 
          c.ID,
          creator.ClubID as CreatorClubID,
          teacher.ClubID as TeacherClubID
        FROM Classes c
        LEFT JOIN Users creator ON c.CreatedBy = creator.ID
        LEFT JOIN Users teacher ON c.TeacherID = teacher.ID
        WHERE c.ClubID IS NULL
      `).all();
      
      const updateStmt = db.prepare('UPDATE Classes SET ClubID = ? WHERE ID = ?');
      let updated = 0;
      
      for (const cls of classesToBackfill) {
        const clubId = cls.CreatorClubID || cls.TeacherClubID;
        if (clubId) {
          updateStmt.run(clubId, cls.ID);
          updated++;
        }
      }
      
      console.log(`✓ ClubID column added and backfilled ${updated} classes`);
      
      // Create index for ClubID
      db.exec('CREATE INDEX IF NOT EXISTS idx_classes_club ON Classes(ClubID)');
      console.log('✓ ClubID index created');
    }

    // Check Classes table for ClassNotes column
    const classesTableInfoForNotes = db.prepare("PRAGMA table_info(Classes)").all();
    const hasClassNotes = classesTableInfoForNotes.some(col => col.name === 'ClassNotes');

    if (!hasClassNotes) {
      console.log('Adding ClassNotes column to Classes table...');
      db.exec('ALTER TABLE Classes ADD COLUMN ClassNotes TEXT');
      console.log('✓ ClassNotes column added');
    }

    // Check ClassSecondaryTeachers table
    const hasSecondaryTeachersTable = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ClassSecondaryTeachers'").get();
    if (!hasSecondaryTeachersTable) {
      console.log('Creating ClassSecondaryTeachers table...');
      db.exec(`
        CREATE TABLE IF NOT EXISTS ClassSecondaryTeachers (
          ClassID INTEGER NOT NULL,
          UserID INTEGER NOT NULL,
          PRIMARY KEY (ClassID, UserID),
          FOREIGN KEY (ClassID) REFERENCES Classes(ID) ON DELETE CASCADE,
          FOREIGN KEY (UserID) REFERENCES Users(ID) ON DELETE CASCADE
        )
      `);
      console.log('✓ ClassSecondaryTeachers table created');
    }
    
    // Run username sanitization migration (removes spaces and special characters)
    try {
      migrateUsernames();
    } catch (usernameError) {
      console.error('Username migration error:', usernameError);
      // Don't throw, just log - this is a non-critical migration
    }
    
  } catch (error) {
    console.error('Migration error:', error);
    // Don't throw, just log
  }
}

module.exports = { migrateDatabase };

