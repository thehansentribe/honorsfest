require('dotenv').config();
const fs = require('fs');
const bcrypt = require('bcrypt');
const path = require('path');
const { db, initializeDatabase } = require('./db');

/**
 * Seed database with comprehensive test data
 * Works for both local development and Render production
 * Always creates fresh data (designed for reset/reseed functionality)
 */
function seedDatabase() {
  try {
    // Initialize database schema (creates tables if they don't exist)
    initializeDatabase();

    console.log('Starting database seeding...');
    const passwordHash = bcrypt.hashSync('password123', 10);

    // Helper function to generate check-in number
    let nextCheckInNumber = 1000;
    function getNextCheckInNumber() {
      const maxResult = db.prepare('SELECT MAX(CheckInNumber) as maxNum FROM Users WHERE CheckInNumber IS NOT NULL').get();
      const maxNum = maxResult?.maxNum || 999;
      nextCheckInNumber = maxNum >= 1000 ? maxNum + 1 : 1000;
      return nextCheckInNumber++;
    }
    
    // Prepare user insert statement
    const insertUser = db.prepare(`
      INSERT INTO Users (FirstName, LastName, Username, DateOfBirth, PasswordHash, Role, Active, BackgroundCheck, ClubID, EventID, InvestitureLevel, CheckInNumber, CheckedIn, Email, auth_method)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Seed honors (always seed fresh)
    console.log('Seeding honors...');
    const rtfPath = path.join(__dirname, '../../Honorslist.rtf');
    if (fs.existsSync(rtfPath)) {
      // Clear existing honors for fresh seed
      db.exec('DELETE FROM Honors');
      
      const fileContent = fs.readFileSync(rtfPath, 'utf8');
      const lines = fileContent.split('\n');
      const insertHonor = db.prepare('INSERT INTO Honors (Name, Category) VALUES (?, ?)');
      
      let inserted = 0;
      for (let i = 9; i < lines.length; i++) {
        let line = lines[i].trim();
        if (!line || line.startsWith('{') || line.startsWith('}') || line.startsWith('\\')) {
          continue;
        }

        line = line.replace(/\\.*?\\/g, '');
        line = line.replace(/\\'([a-f0-9]{2})/g, (match, hex) => {
          return String.fromCharCode(parseInt(hex, 16));
        });

        if (line.includes(' - ')) {
          const [category, ...nameParts] = line.split(' - ');
          const honorName = nameParts.join(' - ');
          
          if (category && honorName) {
            let cleanHonorName = honorName.trim().replace(/\\+$/, '');
            insertHonor.run(cleanHonorName, category.trim());
            inserted++;
          }
        }
      }
      console.log(`Inserted ${inserted} honors`);
    } else {
      console.warn('Honorslist.rtf not found, skipping honors seeding');
      // Create a few sample honors if file doesn't exist
      const insertHonor = db.prepare('INSERT INTO Honors (Name, Category) VALUES (?, ?)');
      const sampleHonors = [
        { name: 'Airplane Modeling', category: 'Arts & Crafts' },
        { name: 'African Lore', category: 'Nature' },
        { name: 'Basketry', category: 'Arts & Crafts' },
        { name: 'Block Printing', category: 'Arts & Crafts' }
      ];
      sampleHonors.forEach(h => insertHonor.run(h.name, h.category));
      console.log('Created sample honors (Honorslist.rtf not found)');
    }

    // Create 3 admin users (always create fresh)
    console.log('Creating admin users...');
    const admins = [
      { FirstName: 'Jason', LastName: 'Hansen', Username: 'jason.hansen', Email: 'jason.hansen@example.com' },
      { FirstName: 'Jamie', LastName: 'Jesse', Username: 'jamie.jesse', Email: 'jamie.jesse@example.com' },
      { FirstName: 'Valerie', LastName: 'Rexin', Username: 'valerie.rexin', Email: 'valerie.rexin@example.com' }
    ];
    
    const adminBirthDate = new Date(new Date().getFullYear() - 99, 0, 1).toISOString().split('T')[0];
    
    admins.forEach(admin => {
      insertUser.run(
        admin.FirstName, 
        admin.LastName, 
        admin.Username, 
        adminBirthDate, 
        passwordHash, 
        'Admin', 
        1, 
        1, 
        null, 
        null, 
        'MasterGuide', 
        getNextCheckInNumber(), 
        0,
        admin.Email,
        'local'  // All seeded users use local auth
      );
      console.log(`Created admin: ${admin.Username}`);
    });

    // Create 2 events with proper status and active fields
    console.log('Creating events...');
    const insertEvent = db.prepare(`
      INSERT INTO Events (Name, StartDate, EndDate, CoordinatorName, Description, Status, Active)
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `);
    
    const today = new Date();
    const nextWeek = new Date(today);
    nextWeek.setDate(today.getDate() + 7);
    
    // Event 1: Spring Honors Festival (Active, Live)
    const event1Start = new Date(today);
    event1Start.setDate(today.getDate() + 1); // Tomorrow
    const event1End = new Date(event1Start);
    event1End.setDate(event1Start.getDate() + 2);
    
    const event1Result = insertEvent.run(
      'Spring Honors Festival 2025', 
      event1Start.toISOString().split('T')[0], 
      event1End.toISOString().split('T')[0], 
      'Jason Hansen', 
      'Annual Spring Honors Festival', 
      'Live',
      1  // Active
    );
    const event1Id = event1Result.lastInsertRowid;
    console.log(`Created event 1 (ID: ${event1Id}): Spring Honors Festival 2025`);
    
    // Event 2: Fall Honors Festival (Active, Closed)
    const event2Start = new Date(nextWeek);
    event2Start.setDate(nextWeek.getDate() + 1);
    const event2End = new Date(event2Start);
    event2End.setDate(event2Start.getDate() + 2);
    
    const event2Result = insertEvent.run(
      'Fall Honors Festival 2025', 
      event2Start.toISOString().split('T')[0], 
      event2End.toISOString().split('T')[0], 
      'Jamie Jesse', 
      'Annual Fall Honors Festival', 
      'Closed',  // Closed registration
      1  // Active
    );
    const event2Id = event2Result.lastInsertRowid;
    console.log(`Created event 2 (ID: ${event2Id}): Fall Honors Festival 2025`);
    
    const events = [{ ID: event1Id }, { ID: event2Id }];

    // For each event, create event admin, locations, timeslots, clubs, and users
    events.forEach((event, eventIndex) => {
      console.log(`\n=== Processing Event ${event.ID} ===`);
      
      // Create 1 Event Admin for this event
      const eventAdminBirthDate = new Date(new Date().getFullYear() - 40, 0, 1).toISOString().split('T')[0];
      const eventAdminRes = insertUser.run(
        `EventAdmin${eventIndex + 1}`,
        'Coordinator',
        `eventadmin${eventIndex + 1}`,
        eventAdminBirthDate,
        passwordHash,
        'EventAdmin',
        1,
        1,
        null,
        event.ID,
        'MasterGuide',
        getNextCheckInNumber(),
        0,
        `eventadmin${eventIndex + 1}@example.com`,
        'local'
      );
      const eventAdminId = eventAdminRes.lastInsertRowid;
      console.log(`Created Event Admin (ID: ${eventAdminId}) for event ${event.ID}`);

      // Create 4 locations for this event
      console.log(`Creating 4 locations for event ${event.ID}...`);
      const insertLoc = db.prepare('INSERT INTO Locations (EventID, Name, Description, MaxCapacity) VALUES (?, ?, ?, ?)');
      const locations = [
        { Name: 'Gymnasium', Desc: 'Main gymnasium', Cap: 40 },
        { Name: 'Auditorium', Desc: 'Large auditorium', Cap: 60 },
        { Name: 'Classroom A', Desc: 'Standard classroom', Cap: 25 },
        { Name: 'Classroom B', Desc: 'Standard classroom', Cap: 25 }
      ];
      const locationIds = [];
      locations.forEach((loc, idx) => {
        const result = insertLoc.run(event.ID, loc.Name, loc.Desc, loc.Cap);
        locationIds.push(result.lastInsertRowid);
        console.log(`  Created location: ${loc.Name} (ID: ${result.lastInsertRowid})`);
      });

      // Create 4 morning timeslots for this event
      console.log(`Creating 4 morning timeslots for event ${event.ID}...`);
      const insertTs = db.prepare('INSERT INTO Timeslots (EventID, Date, StartTime, EndTime) VALUES (?, ?, ?, ?)');
      const eventData = db.prepare('SELECT StartDate, EndDate FROM Events WHERE ID = ?').get(event.ID);
      const timeslotIds = [];
      
      // 4 morning timeslots: 2 per day
      const morningSlots = [
        { time: '09:00', end: '10:30' },
        { time: '11:00', end: '12:30' }
      ];
      
      // Day 1 timeslots
      morningSlots.forEach(slot => {
        const result = insertTs.run(event.ID, eventData.StartDate, slot.time, slot.end);
        timeslotIds.push(result.lastInsertRowid);
        console.log(`  Created timeslot: ${eventData.StartDate} ${slot.time}-${slot.end} (ID: ${result.lastInsertRowid})`);
      });
      
      // Day 2 timeslots (if different day)
      if (eventData.StartDate !== eventData.EndDate) {
        morningSlots.forEach(slot => {
          const result = insertTs.run(event.ID, eventData.EndDate, slot.time, slot.end);
          timeslotIds.push(result.lastInsertRowid);
          console.log(`  Created timeslot: ${eventData.EndDate} ${slot.time}-${slot.end} (ID: ${result.lastInsertRowid})`);
        });
      }

      // Create 4 clubs with directors, teachers, staff, and students
      console.log(`Creating 4 clubs for event ${event.ID}...`);
      const insertClub = db.prepare('INSERT INTO Clubs (Name, Church) VALUES (?, ?)');
      const insertClubEvent = db.prepare('INSERT INTO ClubEvents (ClubID, EventID) VALUES (?, ?)');
      const churches = ['First Baptist Church', 'Grace Community Church', 'Hope Presbyterian Church', 'St. Mary\'s Catholic Church'];
      const honorNames = ['Airplane Modeling', 'African Lore', 'Basketry', 'Block Printing'];
      
      for (let clubIndex = 0; clubIndex < 4; clubIndex++) {
        // Create club (without EventID - using junction table)
        const clubResult = insertClub.run(`Club ${clubIndex + 1}`, churches[clubIndex]);
        const clubId = clubResult.lastInsertRowid;
        
        // Link club to event via ClubEvents junction table
        insertClubEvent.run(clubId, event.ID);
        console.log(`\n  Club ${clubIndex + 1} (ID: ${clubId}):`);
        
        // Create club director
        const directorBirthDate = new Date(new Date().getFullYear() - 35, 0, 1).toISOString().split('T')[0];
        const directorRes = insertUser.run(
          `Director${eventIndex + 1}.${clubIndex + 1}`,
          'Leader',
          `director${eventIndex + 1}.${clubIndex + 1}`,
          directorBirthDate,
          passwordHash,
          'ClubDirector',
          1,
          1,
          clubId,
          event.ID,
          'MasterGuide',
          getNextCheckInNumber(),
          0,
          `director${eventIndex + 1}.${clubIndex + 1}@example.com`,
          'local'
        );
        const directorId = directorRes.lastInsertRowid;
        db.prepare('UPDATE Clubs SET DirectorID = ? WHERE ID = ?').run(directorId, clubId);
        console.log(`    Director: director${eventIndex + 1}.${clubIndex + 1} (ID: ${directorId})`);
        
        // Create 2 teachers
        const teacherBirthDate = new Date(new Date().getFullYear() - 30, 0, 1).toISOString().split('T')[0];
        const teacherIds = [];
        for (let t = 0; t < 2; t++) {
          const teacherRes = insertUser.run(
            `Teacher${eventIndex + 1}.${clubIndex + 1}.${t + 1}`,
            'Smith',
            `teacher${eventIndex + 1}.${clubIndex + 1}.${t + 1}`,
            teacherBirthDate,
            passwordHash,
            'Teacher',
            1,
            1,
            clubId,
            event.ID,
            'MasterGuide',
            getNextCheckInNumber(),
            0,
            `teacher${eventIndex + 1}.${clubIndex + 1}.${t + 1}@example.com`,
            'local'
          );
          const teacherId = teacherRes.lastInsertRowid;
          teacherIds.push(teacherId);
          console.log(`    Teacher ${t + 1}: teacher${eventIndex + 1}.${clubIndex + 1}.${t + 1} (ID: ${teacherId})`);
        }
        
        // Create 2 staff
        const staffBirthDate = new Date(new Date().getFullYear() - 25, 0, 1).toISOString().split('T')[0];
        const staffIds = [];
        for (let s = 0; s < 2; s++) {
          const staffRes = insertUser.run(
            `Staff${eventIndex + 1}.${clubIndex + 1}.${s + 1}`,
            'Johnson',
            `staff${eventIndex + 1}.${clubIndex + 1}.${s + 1}`,
            staffBirthDate,
            passwordHash,
            'Staff',
            1,
            1,
            clubId,
            event.ID,
            'Guide',
            getNextCheckInNumber(),
            0,
            `staff${eventIndex + 1}.${clubIndex + 1}.${s + 1}@example.com`,
            'local'
          );
          const staffId = staffRes.lastInsertRowid;
          staffIds.push(staffId);
          console.log(`    Staff ${s + 1}: staff${eventIndex + 1}.${clubIndex + 1}.${s + 1} (ID: ${staffId})`);
        }
        
        // Create 4 students
        const studentBirthDate = new Date(new Date().getFullYear() - 10, 0, 1).toISOString().split('T')[0];
        const studentIds = [];
        const studentLastNames = ['Davis', 'Miller', 'Wilson', 'Moore'];
        const investitureLevels = ['Friend', 'Companion', 'Explorer', 'Ranger'];
        for (let st = 0; st < 4; st++) {
          const studentRes = insertUser.run(
            `Student${eventIndex + 1}.${clubIndex + 1}.${st + 1}`,
            studentLastNames[st],
            `student${eventIndex + 1}.${clubIndex + 1}.${st + 1}`,
            studentBirthDate,
            passwordHash,
            'Student',
            1,
            0,
            clubId,
            event.ID,
            investitureLevels[st],
            getNextCheckInNumber(),
            0,
            `student${eventIndex + 1}.${clubIndex + 1}.${st + 1}@example.com`,
            'local'
          );
          const studentId = studentRes.lastInsertRowid;
          studentIds.push(studentId);
          console.log(`    Student ${st + 1}: student${eventIndex + 1}.${clubIndex + 1}.${st + 1} (ID: ${studentId})`);
        }
        
        // Create 1 class for this club (each club creates 1 class)
        console.log(`    Creating 1 class for club ${clubId}...`);
        const honors = db.prepare('SELECT ID, Name FROM Honors ORDER BY ID LIMIT 50').all();
        if (honors.length > 0) {
          const honorIndex = (eventIndex * 4 + clubIndex) % honors.length;
          const selectedHonor = honors[honorIndex];
          const teacherId = teacherIds[0]; // Use first teacher
          const locationId = locationIds[clubIndex % locationIds.length];
          const timeslotId = timeslotIds[0]; // Use first timeslot
          
          const insertClass = db.prepare(`
            INSERT INTO Classes (EventID, HonorID, TeacherID, LocationID, TimeslotID, MaxCapacity, TeacherMaxStudents, Active, CreatedBy)
            VALUES (?, ?, ?, ?, ?, ?, ?, 1, ?)
          `);
          
          const classResult = insertClass.run(
            event.ID,
            selectedHonor.ID,
            teacherId,
            locationId,
            timeslotId,
            20,
            20,
            directorId // Created by the club director
          );
          console.log(`      Created class: ${selectedHonor.Name} (ID: ${classResult.lastInsertRowid})`);
        }
      }
    });

    console.log('\n=== Database seeding completed successfully ===');
    console.log('\nSummary:');
    console.log('- 3 Admin users: jason.hansen, jamie.jesse, valerie.rexin (password: password123)');
    console.log('- 2 Events: Spring (Live) and Fall (Closed)');
    console.log('- 2 Event Admins (1 per event)');
    console.log('- 8 Clubs (4 per event) linked via ClubEvents junction table');
    console.log('- 8 Club Directors (1 per club)');
    console.log('- 16 Teachers (2 per club)');
    console.log('- 16 Staff (2 per club)');
    console.log('- 32 Students (4 per club)');
    console.log('- 8 Locations (4 per event)');
    console.log('- 8 Timeslots (4 per event)');
    console.log('- 8 Classes (1 per club, 4 per event)');
    console.log('- ClubEvents relationships: 8 (1 per club per event)');
    console.log('\nAll users have password: password123');
    
  } catch (error) {
    console.error('Error seeding database:', error);
    console.error('Error stack:', error.stack);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  seedDatabase();
}

module.exports = { seedDatabase };
