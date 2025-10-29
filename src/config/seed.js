require('dotenv').config();
const fs = require('fs');
const bcrypt = require('bcrypt');
const path = require('path');
const { db, initializeDatabase } = require('./db');

function seedDatabase() {
  try {
    initializeDatabase();

    let hasChanges = false;
    
    // Prepare user insert statement (used in multiple places)
    const insertUser = db.prepare(`
      INSERT INTO Users (FirstName, LastName, Username, DateOfBirth, PasswordHash, Role, Active, BackgroundCheck)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?)
    `);
    const passwordHash = bcrypt.hashSync('password123', 10);

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
            // Remove trailing backslashes from honor name
            let cleanHonorName = honorName.trim().replace(/\\+$/, '');
            insertHonor.run(cleanHonorName, category.trim());
            inserted++;
          }
        }
      }

      console.log(`Inserted ${inserted} honors`);
      hasChanges = true;
    }

    // Check if users exist, create if not
    const userCount = db.prepare('SELECT COUNT(*) as count FROM Users').get();
    if (userCount.count === 0) {
      // Set birthdate to make user 99 years old
      const birthDate = new Date(new Date().getFullYear() - 99, 0, 1).toISOString().split('T')[0];
      
      // Create 3 admin users
      const admins = [
        { FirstName: 'Jason', LastName: 'Hansen', Username: 'jason.hansen' },
        { FirstName: 'Jamie', LastName: 'Jesse', Username: 'jamie.jesse' },
        { FirstName: 'Valerie', LastName: 'Rexin', Username: 'valerie.rexin' }
      ];
      
      admins.forEach(admin => {
        insertUser.run(admin.FirstName, admin.LastName, admin.Username, birthDate, passwordHash, 'Admin', 1, 1);
        console.log(`Created admin user: ${admin.Username}`);
      });
      
      hasChanges = true;
    }
    
    // Create two test events if they don't exist
    const eventCount = db.prepare('SELECT COUNT(*) as count FROM Events').get();
    if (eventCount.count === 0) {
      const insertEvent = db.prepare(`
        INSERT INTO Events (Name, StartDate, EndDate, CoordinatorName, Description, Status)
        VALUES (?, ?, ?, ?, ?, ?)
      `);
      
      const today = new Date();
      const nextWeek = new Date(today);
      nextWeek.setDate(today.getDate() + 7);
      const twoWeeks = new Date(today);
      twoWeeks.setDate(today.getDate() + 14);
      
      const event1EndDate = new Date(today);
      event1EndDate.setDate(today.getDate() + 2);
      
      const event2EndDate = new Date(nextWeek);
      event2EndDate.setDate(nextWeek.getDate() + 2);
      
      insertEvent.run(
        'Spring Honors Festival 2025',
        today.toISOString().split('T')[0],
        event1EndDate.toISOString().split('T')[0],
        'Jason Hansen',
        'Annual Spring Honors Festival',
        'Live'
      );
      console.log('Created event: Spring Honors Festival 2025');
      
      insertEvent.run(
        'Fall Honors Festival 2025',
        nextWeek.toISOString().split('T')[0],
        event2EndDate.toISOString().split('T')[0],
        'Jamie Jesse',
        'Annual Fall Honors Festival',
        'Live'
      );
      console.log('Created event: Fall Honors Festival 2025');
      
      hasChanges = true;
    }
    
    // Create clubs for each event if they don't exist
    const events = db.prepare('SELECT ID FROM Events ORDER BY ID').all();
    const clubs = [
      { Name: 'Adventurer Club Alpha', Church: 'First Baptist Church' },
      { Name: 'Adventurer Club Beta', Church: 'Grace Community Church' },
      { Name: 'Adventurer Club Gamma', Church: 'Hope Presbyterian Church' },
      { Name: 'Adventurer Club Delta', Church: 'St. Mary\'s Catholic Church' }
    ];
    
    events.forEach(event => {
      const clubCount = db.prepare('SELECT COUNT(*) as count FROM Clubs WHERE EventID = ?').get(event.ID);
      if (clubCount.count === 0) {
        const insertClub = db.prepare('INSERT INTO Clubs (EventID, Name, Church) VALUES (?, ?, ?)');
        
        clubs.forEach((club, index) => {
          const result = insertClub.run(event.ID, `${club.Name} - Event ${event.ID}`, club.Church);
          const clubId = result.lastInsertRowid;
          console.log(`Created club: ${club.Name} - Event ${event.ID} (ID: ${clubId})`);
          
          // Create users for this club
          const userIndex = (event.ID - 1) * 4 + index;
          const users = [
            // Teachers
            { FirstName: `Teacher${userIndex * 2 + 1}`, LastName: 'Smith', Username: `teacher${userIndex * 2 + 1}.club${clubId}`, Role: 'Teacher', InvestitureLevel: 'MasterGuide' },
            { FirstName: `Teacher${userIndex * 2 + 2}`, LastName: 'Johnson', Username: `teacher${userIndex * 2 + 2}.club${clubId}`, Role: 'Teacher', InvestitureLevel: 'MasterGuide' },
            
            // Staff
            { FirstName: `Staff${userIndex * 2 + 1}`, LastName: 'Williams', Username: `staff${userIndex * 2 + 1}.club${clubId}`, Role: 'Staff', InvestitureLevel: 'Guide' },
            { FirstName: `Staff${userIndex * 2 + 2}`, LastName: 'Brown', Username: `staff${userIndex * 2 + 2}.club${clubId}`, Role: 'Staff', InvestitureLevel: 'Voyager' },
            
            // Students
            { FirstName: `Student${userIndex * 4 + 1}`, LastName: 'Davis', Username: `student${userIndex * 4 + 1}.club${clubId}`, Role: 'Student', InvestitureLevel: 'Friend' },
            { FirstName: `Student${userIndex * 4 + 2}`, LastName: 'Miller', Username: `student${userIndex * 4 + 2}.club${clubId}`, Role: 'Student', InvestitureLevel: 'Companion' },
            { FirstName: `Student${userIndex * 4 + 3}`, LastName: 'Wilson', Username: `student${userIndex * 4 + 3}.club${clubId}`, Role: 'Student', InvestitureLevel: 'Explorer' },
            { FirstName: `Student${userIndex * 4 + 4}`, LastName: 'Moore', Username: `student${userIndex * 4 + 4}.club${clubId}`, Role: 'Student', InvestitureLevel: 'Ranger' }
          ];
          
          const birthDate = new Date(new Date().getFullYear() - 30, 0, 1).toISOString().split('T')[0];
          const studentBirthDate = new Date(new Date().getFullYear() - 10, 0, 1).toISOString().split('T')[0];
          
          users.forEach((user, userIndex) => {
            const dob = user.Role === 'Student' ? studentBirthDate : birthDate;
            const backgroundCheck = user.Role !== 'Student' ? 1 : 0;
            
            const userResult = insertUser.run(
              user.FirstName,
              user.LastName,
              user.Username.toLowerCase(),
              dob,
              passwordHash,
              user.Role,
              1,
              backgroundCheck
            );
            
            // Update user with club and event
            db.prepare('UPDATE Users SET ClubID = ?, EventID = ?, InvestitureLevel = ? WHERE ID = ?')
              .run(clubId, event.ID, user.InvestitureLevel, userResult.lastInsertRowid);
          });
          
          console.log(`Created 8 users for club ${clubId}`);
        });
      }
    });

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

