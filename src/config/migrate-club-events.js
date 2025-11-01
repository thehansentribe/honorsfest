/**
 * Migration script to support multi-event clubs
 * - Creates ClubEvents junction table
 * - Migrates existing Clubs.EventID relationships to ClubEvents
 * - Removes EventID column from Clubs table
 */

const { db } = require('./db');

function migrateClubEvents() {
  console.log('Starting ClubEvents migration...');
  
  try {
    // Step 1: Create ClubEvents table if it doesn't exist
    console.log('Creating ClubEvents junction table...');
    db.exec(`
      CREATE TABLE IF NOT EXISTS ClubEvents (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        ClubID INTEGER NOT NULL,
        EventID INTEGER NOT NULL,
        CreatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (ClubID) REFERENCES Clubs(ID),
        FOREIGN KEY (EventID) REFERENCES Events(ID),
        UNIQUE(ClubID, EventID)
      );

      CREATE INDEX IF NOT EXISTS idx_club_events_club ON ClubEvents(ClubID);
      CREATE INDEX IF NOT EXISTS idx_club_events_event ON ClubEvents(EventID);
    `);
    console.log('✓ ClubEvents table created');

    // Step 2: Check if Clubs table has EventID column
    const tableInfo = db.prepare("PRAGMA table_info(Clubs)").all();
    const hasEventID = tableInfo.some(col => col.name === 'EventID');
    
    if (!hasEventID) {
      console.log('✓ Clubs table already migrated (no EventID column)');
      return;
    }

    // Step 3: Migrate existing Clubs.EventID data to ClubEvents
    console.log('Migrating existing club-event relationships...');
    const clubsWithEvents = db.prepare(`
      SELECT ID, EventID 
      FROM Clubs 
      WHERE EventID IS NOT NULL
    `).all();

    let migrated = 0;
    const insertClubEvent = db.prepare(`
      INSERT OR IGNORE INTO ClubEvents (ClubID, EventID)
      VALUES (?, ?)
    `);

    for (const club of clubsWithEvents) {
      try {
        insertClubEvent.run(club.ID, club.EventID);
        migrated++;
      } catch (error) {
        // Ignore unique constraint violations (already exists)
        if (!error.message.includes('UNIQUE constraint')) {
          console.error(`Error migrating club ${club.ID}:`, error.message);
        }
      }
    }

    console.log(`✓ Migrated ${migrated} club-event relationships`);

    // Step 4: Recreate Clubs table without EventID
    // SQLite doesn't support DROP COLUMN, so we need to recreate the table
    // We must disable foreign keys temporarily to drop the table
    console.log('Recreating Clubs table without EventID...');
    
    // Disable foreign key constraints
    db.pragma('foreign_keys = OFF');
    
    try {
      // Create backup table with all data
      db.exec(`
        CREATE TABLE IF NOT EXISTS Clubs_backup AS SELECT * FROM Clubs;
      `);
      
      // Drop old table (now safe with foreign keys disabled)
      db.exec(`DROP TABLE IF EXISTS Clubs;`);
      
      // Create new table without EventID
      db.exec(`
        CREATE TABLE Clubs (
          ID INTEGER PRIMARY KEY AUTOINCREMENT,
          Name TEXT NOT NULL,
          Church TEXT,
          DirectorID INTEGER,
          FOREIGN KEY (DirectorID) REFERENCES Users(ID)
        );
      `);

      // Copy data back (without EventID)
      db.exec(`
        INSERT INTO Clubs (ID, Name, Church, DirectorID)
        SELECT ID, Name, Church, DirectorID FROM Clubs_backup;
      `);
      
      // Drop backup table
      db.exec(`DROP TABLE IF EXISTS Clubs_backup;`);
      
      // Re-enable foreign key constraints
      db.pragma('foreign_keys = ON');
      
    } catch (error) {
      // Always re-enable foreign keys even if something fails
      db.pragma('foreign_keys = ON');
      throw error;
    }

    console.log('✓ Clubs table recreated without EventID');
    console.log('✓ Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateClubEvents();
  process.exit(0);
}

module.exports = { migrateClubEvents };

