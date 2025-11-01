/**
 * Migration script to add Active field to Events table
 * - Adds Active BOOLEAN field (default true)
 * - Existing events will be set to Active = true
 */

const { db } = require('./db');

function migrateEventActive() {
  console.log('Starting Event Active migration...');
  
  try {
    // Check if Active column already exists
    const tableInfo = db.prepare("PRAGMA table_info(Events)").all();
    const hasActive = tableInfo.some(col => col.name === 'Active');
    
    if (hasActive) {
      console.log('✓ Events table already has Active column');
      return;
    }

    console.log('Adding Active column to Events table...');
    
    // SQLite doesn't support ADD COLUMN with DEFAULT easily in older versions
    // So we'll add it as nullable first, then set default values
    db.exec(`
      ALTER TABLE Events ADD COLUMN Active BOOLEAN DEFAULT 1;
    `);

    // Set all existing events to Active = true
    db.exec(`UPDATE Events SET Active = 1 WHERE Active IS NULL`);

    console.log('✓ Active column added to Events table');
    console.log('✓ Migration completed successfully!');
    
  } catch (error) {
    console.error('Migration failed:', error);
    throw error;
  }
}

// Run migration if called directly
if (require.main === module) {
  migrateEventActive();
  process.exit(0);
}

module.exports = { migrateEventActive };

