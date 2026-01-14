/**
 * Migration script to sanitize existing usernames
 * Removes all non-alphanumeric characters (except the dot separator)
 * 
 * Run manually with: node src/config/migrate-usernames.js
 * Or automatically on server startup via migrate.js
 */

const { db } = require('./db');

function migrateUsernames() {
  console.log('[migrate-usernames] Starting username sanitization migration...');
  
  // Check if migration has already been run
  const migrationCheck = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='table' AND name='_migrations'
  `).get();
  
  if (migrationCheck) {
    const alreadyRun = db.prepare(`
      SELECT 1 FROM _migrations WHERE name = 'sanitize_usernames'
    `).get();
    
    if (alreadyRun) {
      console.log('[migrate-usernames] Migration already completed. Skipping.');
      return { skipped: true, reason: 'already_run' };
    }
  } else {
    // Create migrations tracking table if it doesn't exist
    db.exec(`
      CREATE TABLE IF NOT EXISTS _migrations (
        name TEXT PRIMARY KEY,
        run_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `);
  }
  
  // Get all users with their current usernames
  const users = db.prepare('SELECT ID, Username, FirstName, LastName FROM Users').all();
  
  const updates = [];
  
  for (const user of users) {
    const oldUsername = user.Username;
    
    // Sanitize: split by dot, remove non-alphanumeric from each part, rejoin
    const parts = oldUsername.split('.');
    const sanitizedParts = parts.map(part => part.toLowerCase().replace(/[^a-z0-9]/g, ''));
    let newUsername = sanitizedParts.join('.');
    
    // Only process if the username actually changed
    if (oldUsername !== newUsername) {
      updates.push({
        id: user.ID,
        oldUsername,
        newUsername,
        firstName: user.FirstName,
        lastName: user.LastName
      });
    }
  }
  
  if (updates.length === 0) {
    console.log('[migrate-usernames] No usernames need to be updated. All usernames are already clean.');
    // Mark migration as complete
    db.prepare(`INSERT OR REPLACE INTO _migrations (name) VALUES ('sanitize_usernames')`).run();
    return { updated: 0 };
  }
  
  console.log(`[migrate-usernames] Found ${updates.length} username(s) that need sanitization:`);
  
  // Build a map of all usernames (existing + new) to detect conflicts
  const allUsernames = new Map();
  
  // First, add all users that won't change
  for (const user of users) {
    const isChanging = updates.find(u => u.id === user.ID);
    if (!isChanging) {
      allUsernames.set(user.Username, user.ID);
    }
  }
  
  // Now process updates, handling conflicts by adding numeric suffixes
  const finalUpdates = [];
  
  for (const update of updates) {
    let finalUsername = update.newUsername;
    let counter = 1;
    
    // If there's a conflict, add numeric suffix
    while (allUsernames.has(finalUsername)) {
      finalUsername = `${update.newUsername}${counter}`;
      counter++;
    }
    
    // Reserve this username
    allUsernames.set(finalUsername, update.id);
    
    finalUpdates.push({
      ...update,
      newUsername: finalUsername,
      hadConflict: finalUsername !== update.newUsername
    });
    
    const conflictNote = finalUsername !== update.newUsername ? ' (resolved conflict)' : '';
    console.log(`  ID ${update.id}: "${update.oldUsername}" → "${finalUsername}"${conflictNote}`);
  }
  
  // Perform the updates in a transaction
  console.log('[migrate-usernames] Applying changes...');
  
  const updateStmt = db.prepare('UPDATE Users SET Username = ? WHERE ID = ?');
  
  const runUpdates = db.transaction(() => {
    for (const update of finalUpdates) {
      updateStmt.run(update.newUsername, update.id);
    }
    // Mark migration as complete
    db.prepare(`INSERT OR REPLACE INTO _migrations (name) VALUES ('sanitize_usernames')`).run();
  });
  
  runUpdates();
  
  console.log(`[migrate-usernames] ✓ Successfully updated ${finalUpdates.length} username(s).`);
  
  return { updated: finalUpdates.length, updates: finalUpdates };
}

// Export for use in migrate.js
module.exports = { migrateUsernames };

// If run directly, execute the migration
if (require.main === module) {
  migrateUsernames();
}
