require('dotenv').config();
const fs = require('fs');
const bcrypt = require('bcrypt');
const path = require('path');
const { db, initializeDatabase } = require('./db');

function seedDatabase() {
  try {
    initializeDatabase();

    let hasChanges = false;

    // Check if honors already exist
    const honorCount = db.prepare('SELECT COUNT(*) as count FROM Honors').get();
    if (honorCount.count === 0) {
      // Parse Honorslist.rtf
      const rtfPath = path.join(__dirname, '../../Honorslist.rtf');
      const fileContent = fs.readFileSync(rtfPath, 'utf8');
      const lines = fileContent.split('\n');

      const insertHonor = db.prepare('INSERT INTO Honors (Name, Category) VALUES (?, ?)');
      
      let inserted = 0;
      for (let i = 9; i < lines.length; i++) {
        let line = lines[i].trim();
        
        // Skip empty lines and RTF formatting
        if (!line || line.startsWith('{') || line.startsWith('}') || line.startsWith('\\')) {
          continue;
        }

        // Extract honor name
        line = line.replace(/\\.*?\\/g, ''); // Remove RTF commands
        line = line.replace(/\\'([a-f0-9]{2})/g, (match, hex) => {
          return String.fromCharCode(parseInt(hex, 16));
        }); // Decode RTF special characters

        if (line.includes(' - ')) {
          const [category, ...nameParts] = line.split(' - ');
          const honorName = nameParts.join(' - ');
          
          if (category && honorName) {
            insertHonor.run(honorName.trim(), category.trim());
            inserted++;
          }
        }
      }

      console.log(`Inserted ${inserted} honors`);
      hasChanges = true;
    }

    // Always check for admin user, create if doesn't exist
    const adminExists = db.prepare('SELECT COUNT(*) as count FROM Users WHERE Username = ?').get('admin');
    if (adminExists.count === 0) {
      const passwordHash = bcrypt.hashSync('password123', 10);
      const insertUser = db.prepare(`
        INSERT INTO Users (FirstName, LastName, Username, DateOfBirth, PasswordHash, Role, Active, BackgroundCheck)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?)
      `);
      
      // Set birthdate to make user 99 years old
      const birthDate = new Date(new Date().getFullYear() - 99, 0, 1).toISOString().split('T')[0];
      
      insertUser.run('System', 'Administrator', 'admin', birthDate, passwordHash, 'Admin', 1, 1);
      console.log('Created default admin user');
      hasChanges = true;
    }

    if (hasChanges) {
      console.log('Database seeding completed successfully');
    } else {
      console.log('Database already seeded');
    }
  } catch (error) {
    console.error('Error seeding database:', error);
    // Don't exit the process if called from server startup
    if (require.main === module) {
      process.exit(1);
    }
  }
}

// Only run if called directly, not when required by another module
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };

