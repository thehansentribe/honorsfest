require('dotenv').config();
const { db, initializeDatabase } = require('./db');

/**
 * Migration: Add ClubID to Classes table
 * 
 * This migration adds an explicit ClubID field to the Classes table
 * to properly associate classes with clubs, rather than inferring
 * the club from the creator or teacher.
 * 
 * Backfill logic:
 * 1. If CreatedBy user has a ClubID, use that
 * 2. Otherwise, if TeacherID user has a ClubID, use that
 * 3. Otherwise, leave NULL (will need manual assignment)
 */

function migrate() {
  try {
    initializeDatabase();
    
    console.log('Starting migration: Add ClubID to Classes table...');
    
    // Check if ClubID column already exists
    const tableInfo = db.prepare("PRAGMA table_info(Classes)").all();
    const hasClubID = tableInfo.some(col => col.name === 'ClubID');
    
    if (hasClubID) {
      console.log('ClubID column already exists in Classes table. Skipping migration.');
      return;
    }
    
    // Add ClubID column to Classes table
    console.log('Adding ClubID column to Classes table...');
    db.exec('ALTER TABLE Classes ADD COLUMN ClubID INTEGER REFERENCES Clubs(ID)');
    
    // Backfill ClubID based on existing data
    console.log('Backfilling ClubID for existing classes...');
    
    // Get all classes that need backfilling
    const classes = db.prepare(`
      SELECT 
        c.ID,
        c.CreatedBy,
        c.TeacherID,
        creator.ClubID as CreatorClubID,
        teacher.ClubID as TeacherClubID
      FROM Classes c
      LEFT JOIN Users creator ON c.CreatedBy = creator.ID
      LEFT JOIN Users teacher ON c.TeacherID = teacher.ID
      WHERE c.ClubID IS NULL
    `).all();
    
    console.log(`Found ${classes.length} classes to backfill...`);
    
    const updateStmt = db.prepare('UPDATE Classes SET ClubID = ? WHERE ID = ?');
    
    let updated = 0;
    let skipped = 0;
    
    for (const cls of classes) {
      // Priority: Creator's club > Teacher's club
      const clubId = cls.CreatorClubID || cls.TeacherClubID;
      
      if (clubId) {
        updateStmt.run(clubId, cls.ID);
        updated++;
      } else {
        console.log(`  Warning: Class ID ${cls.ID} has no club association (no creator or teacher club)`);
        skipped++;
      }
    }
    
    console.log(`\nBackfill complete:`);
    console.log(`  - Updated: ${updated} classes`);
    console.log(`  - Skipped (no club found): ${skipped} classes`);
    
    // Create index for better query performance
    console.log('Creating index on Classes.ClubID...');
    db.exec('CREATE INDEX IF NOT EXISTS idx_classes_club ON Classes(ClubID)');
    
    console.log('\nMigration completed successfully!');
    
    // Show summary of classes by club
    const summary = db.prepare(`
      SELECT 
        cl.Name as ClubName,
        COUNT(c.ID) as ClassCount
      FROM Classes c
      LEFT JOIN Clubs cl ON c.ClubID = cl.ID
      GROUP BY c.ClubID
      ORDER BY cl.Name
    `).all();
    
    console.log('\nClasses by Club:');
    summary.forEach(row => {
      console.log(`  ${row.ClubName || '(No Club)'}: ${row.ClassCount} classes`);
    });
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  migrate();
}

module.exports = { migrate };
