require('dotenv').config();
const fs = require('fs');
const bcrypt = require('bcrypt');
const path = require('path');
const { db, initializeDatabase } = require('./db');

function seedDatabase() {
  try {
    initializeDatabase();

    // Check if honors already exist
    const honorCount = db.prepare('SELECT COUNT(*) as count FROM Honors').get();
    if (honorCount.count > 0) {
      console.log('Database already seeded');
      return;
    }

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

    // Create default admin user
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
    } else {
      console.log('Admin user already exists');
      
      // Update existing admin user to have DateOfBirth if not set
      const admin = db.prepare('SELECT DateOfBirth FROM Users WHERE Username = ?').get('admin');
      if (!admin.DateOfBirth) {
        const birthDate = new Date(new Date().getFullYear() - 99, 0, 1).toISOString().split('T')[0];
        db.prepare('UPDATE Users SET DateOfBirth = ? WHERE Username = ?').run(birthDate, 'admin');
        console.log('Updated admin user with DateOfBirth');
      }
    }

    console.log('Database seeding completed successfully');
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  } finally {
    db.close();
  }
}

seedDatabase();

