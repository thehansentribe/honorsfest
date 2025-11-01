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
      { Name: 'Club 1', Church: 'Church 1' },
      { Name: 'Club 2', Church: 'Church 2' },
      { Name: 'Club 3', Church: 'Church 3' },
      { Name: 'Club 4', Church: 'Church 4' }
    ];
    
    events.forEach(event => {
      const clubCount = db.prepare('SELECT COUNT(*) as count FROM ClubEvents WHERE EventID = ?').get(event.ID);
      if (clubCount.count === 0) {
        const insertClub = db.prepare('INSERT INTO Clubs (Name, Church) VALUES (?, ?)');
        const insertClubEvent = db.prepare('INSERT INTO ClubEvents (ClubID, EventID) VALUES (?, ?)');
        
        clubs.forEach((club, index) => {
          // Create club
          const result = insertClub.run(club.Name, club.Church);
          const clubId = result.lastInsertRowid;
          
          // Link club to event
          insertClubEvent.run(clubId, event.ID);
          
          console.log(`Created club: ${club.Name} (Event ${event.ID}) (ID: ${clubId})`);
          
          // Create a club director and assign to this club
          const directorRes = insertUser.run(
            `Director${index + 1}`,
            'Leader',
            `director${index + 1}.club${clubId}`,
            new Date(new Date().getFullYear() - 35, 0, 1).toISOString().split('T')[0],
            passwordHash,
            'ClubDirector',
            1,
            1
          );
          const directorId = directorRes.lastInsertRowid;
          db.prepare('UPDATE Users SET ClubID = ?, EventID = ?, InvestitureLevel = ? WHERE ID = ?')
            .run(clubId, event.ID, 'MasterGuide', directorId);
          db.prepare('UPDATE Clubs SET DirectorID = ? WHERE ID = ?').run(directorId, clubId);
          
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

      // Seed 4 locations per event if none exist
      const locCount = db.prepare('SELECT COUNT(*) as count FROM Locations WHERE EventID = ?').get(event.ID);
      if (locCount.count === 0) {
        const insertLoc = db.prepare('INSERT INTO Locations (EventID, Name, Description, MaxCapacity) VALUES (?, ?, ?, ?)');
        const locs = [
          { Name: 'Gymnasium', Desc: 'Main gym', Cap: 40 },
          { Name: 'Auditorium', Desc: 'Large hall', Cap: 60 },
          { Name: 'Classroom A', Desc: 'Standard room', Cap: 25 },
          { Name: 'Classroom B', Desc: 'Standard room', Cap: 25 }
        ];
        locs.forEach((l) => insertLoc.run(event.ID, `${l.Name} - Event ${event.ID}`, l.Desc, l.Cap));
        console.log(`Created 4 locations for event ${event.ID}`);
      }

      // Seed 2 timeslots per event if none exist
      const tsCount = db.prepare('SELECT COUNT(*) as count FROM Timeslots WHERE EventID = ?').get(event.ID);
      if (tsCount.count === 0) {
        const insertTs = db.prepare('INSERT INTO Timeslots (EventID, Date, StartTime, EndTime) VALUES (?, ?, ?, ?)');
        // Derive two days from event dates
        const ev = db.prepare('SELECT StartDate, EndDate FROM Events WHERE ID = ?').get(event.ID);
        const d1 = ev.StartDate;
        const d2 = ev.EndDate;
        insertTs.run(event.ID, d1, '09:00', '10:30');
        insertTs.run(event.ID, d1, '11:00', '12:30');
        insertTs.run(event.ID, d2, '09:00', '10:30');
        insertTs.run(event.ID, d2, '11:00', '12:30');
        console.log(`Created 4 timeslots for event ${event.ID}`);
      }

      // Seed 4 classes per event if none exist
      const classCount = db.prepare('SELECT COUNT(*) as count FROM Classes WHERE EventID = ?').get(event.ID);
      if (classCount.count === 0) {
        const insertClass = db.prepare(`
          INSERT INTO Classes (EventID, HonorID, TeacherID, LocationID, TimeslotID, MaxCapacity, TeacherMaxStudents, Active)
          VALUES (?, ?, ?, ?, ?, ?, ?, 1)
        `);

        // Pick 4 honors
        const honors = db.prepare('SELECT ID FROM Honors ORDER BY ID LIMIT 4').all();
        // Pick teachers for this event (any teacher linked to a club in this event)
        const teacherIds = db.prepare(`
          SELECT DISTINCT u.ID
          FROM Users u
          JOIN Clubs c ON u.ClubID = c.ID
          JOIN ClubEvents ce ON c.ID = ce.ClubID
          WHERE u.Role = 'Teacher' AND ce.EventID = ?
          ORDER BY u.ID
        `).all(event.ID).map(r => r.ID);
        // Locations and timeslots for this event
        const locIds = db.prepare('SELECT ID FROM Locations WHERE EventID = ? ORDER BY ID').all(event.ID).map(r => r.ID);
        const tsIds = db.prepare('SELECT ID FROM Timeslots WHERE EventID = ? ORDER BY Date, StartTime').all(event.ID).map(r => r.ID);

        // Ensure we have enough associations
        if (honors.length >= 4 && teacherIds.length >= 4 && locIds.length >= 4 && tsIds.length >= 2) {
          for (let i = 0; i < 4; i++) {
            const honorId = honors[i].ID;
            const teacherId = teacherIds[i % teacherIds.length];
            const locId = locIds[i % locIds.length];
            const tsId = tsIds[i % tsIds.length];
            const teacherCap = 20;
            const maxCap = 20;
            insertClass.run(event.ID, honorId, teacherId, locId, tsId, maxCap, teacherCap);
          }
          console.log(`Created 4 classes for event ${event.ID}`);
        } else {
          console.warn(`Skipping class seeding for event ${event.ID} due to insufficient data`);
        }
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

