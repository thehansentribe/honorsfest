#!/usr/bin/env node
/**
 * Script to check database migration status for username UNIQUE index
 * Run this on Render to verify the migration has been applied
 */

require('dotenv').config();
const { db } = require('./src/config/db');

console.log('=== Database Migration Status Check ===\n');

try {
  // Check if unique index exists
  const indexCheck = db.prepare(`
    SELECT name, sql FROM sqlite_master 
    WHERE type='index' 
    AND tbl_name='Users' 
    AND (name='idx_users_username_unique' OR sql LIKE '%UNIQUE%Username%')
  `).get();

  if (indexCheck) {
    console.log('✓ UNIQUE index on Username exists:');
    console.log(`  Name: ${indexCheck.name}`);
    console.log(`  SQL: ${indexCheck.sql || 'N/A'}\n`);
  } else {
    console.log('✗ UNIQUE index on Username NOT found\n');
    console.log('Creating UNIQUE index now...');
    db.exec('CREATE UNIQUE INDEX IF NOT EXISTS idx_users_username_unique ON Users(Username)');
    console.log('✓ UNIQUE index created successfully\n');
  }

  // Check for duplicate usernames
  const duplicates = db.prepare(`
    SELECT Username, COUNT(*) as count, GROUP_CONCAT(ID) as user_ids, GROUP_CONCAT(Role) as roles
    FROM Users 
    GROUP BY Username 
    HAVING count > 1
  `).all();

  if (duplicates.length > 0) {
    console.log('⚠ WARNING: Found duplicate usernames:');
    duplicates.forEach(dup => {
      console.log(`  Username: ${dup.Username}`);
      console.log(`    Count: ${dup.count}`);
      console.log(`    User IDs: ${dup.user_ids}`);
      console.log(`    Roles: ${dup.roles}\n`);
    });
  } else {
    console.log('✓ No duplicate usernames found\n');
  }

  // Check table schema for UNIQUE constraint
  const tableInfo = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name='Users'").get();
  if (tableInfo && tableInfo.sql.includes('Username TEXT UNIQUE')) {
    console.log('✓ Table schema includes UNIQUE constraint on Username column\n');
  } else {
    console.log('⚠ Table schema does NOT explicitly show UNIQUE constraint (may be in index)\n');
  }

  // Verify index was created
  const verifyIndex = db.prepare(`
    SELECT name FROM sqlite_master 
    WHERE type='index' 
    AND name='idx_users_username_unique'
  `).get();

  if (verifyIndex) {
    console.log('✓ Migration verified: idx_users_username_unique index exists\n');
    process.exit(0);
  } else {
    console.log('✗ Migration NOT verified: idx_users_username_unique index missing\n');
    process.exit(1);
  }

} catch (error) {
  console.error('Error checking database:', error);
  process.exit(1);
}

