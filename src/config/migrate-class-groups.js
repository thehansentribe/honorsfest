/**
 * Migration script to add multi-session class support
 * Adds ClassGroupID and SessionNumber columns to Classes table
 */

const { db } = require('./db');

function migrateClassGroups() {
  console.log('Starting class groups migration...');

  try {
    // Check if ClassGroupID column already exists
    const tableInfo = db.prepare("PRAGMA table_info(Classes)").all();
    const hasClassGroupID = tableInfo.some(col => col.name === 'ClassGroupID');
    const hasSessionNumber = tableInfo.some(col => col.name === 'SessionNumber');

    if (hasClassGroupID && hasSessionNumber) {
      console.log('ClassGroupID and SessionNumber columns already exist. Migration skipped.');
      return { success: true, message: 'Already migrated' };
    }

    // Add ClassGroupID column if it doesn't exist
    if (!hasClassGroupID) {
      console.log('Adding ClassGroupID column...');
      db.prepare('ALTER TABLE Classes ADD COLUMN ClassGroupID TEXT').run();
      console.log('ClassGroupID column added successfully.');
    }

    // Add SessionNumber column if it doesn't exist
    if (!hasSessionNumber) {
      console.log('Adding SessionNumber column...');
      db.prepare('ALTER TABLE Classes ADD COLUMN SessionNumber INTEGER DEFAULT 1').run();
      console.log('SessionNumber column added successfully.');
    }

    // Create index for ClassGroupID for faster lookups
    console.log('Creating index on ClassGroupID...');
    db.prepare('CREATE INDEX IF NOT EXISTS idx_classes_group ON Classes(ClassGroupID)').run();
    console.log('Index created successfully.');

    console.log('Class groups migration completed successfully!');
    return { success: true, message: 'Migration completed' };

  } catch (error) {
    console.error('Migration failed:', error);
    return { success: false, error: error.message };
  }
}

// Run migration if this file is executed directly
if (require.main === module) {
  const result = migrateClassGroups();
  if (result.success) {
    console.log('Migration successful:', result.message);
    process.exit(0);
  } else {
    console.error('Migration failed:', result.error);
    process.exit(1);
  }
}

module.exports = { migrateClassGroups };
