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
      INSERT INTO Users (FirstName, LastName, Username, DateOfBirth, Email, Phone, PasswordHash, Role, InvestitureLevel, ClubID, EventID, Active, Invited, InviteAccepted, BackgroundCheck, CheckInNumber, CheckedIn, stytch_user_id, auth_method)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);

    // Seed honors (always seed fresh)
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
    } else {
      // Create a few sample honors if file doesn't exist
      const insertHonor = db.prepare('INSERT INTO Honors (Name, Category) VALUES (?, ?)');
      const sampleHonors = [
        { name: 'Airplane Modeling', category: 'Arts & Crafts' },
        { name: 'African Lore', category: 'Nature' },
        { name: 'Basketry', category: 'Arts & Crafts' },
        { name: 'Block Printing', category: 'Arts & Crafts' }
      ];
      sampleHonors.forEach(h => insertHonor.run(h.name, h.category));
    }

    // Create super admin account (full system privileges)
    const superAdminBirthDate = '1980-01-01';
    insertUser.run(
      'System',
      'Admin',
      'admin',
      superAdminBirthDate,
      'admin@honorsfest.com',
      null,
      bcrypt.hashSync('@dudlybob3X', 10),
      'Admin',
      'MasterGuide',
      null,
      null,
      1,
      0,
      0,
      1,
      getNextCheckInNumber(),
      0,
      null,
      'local'
    );

    // Create additional admin users for operations/testing
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
        admin.Email,
        null,  // Phone
        passwordHash, 
        'Admin',
        'MasterGuide',
        null,  // ClubID
        null,  // EventID
        1,     // Active
        0,     // Invited
        0,     // InviteAccepted
        1,     // BackgroundCheck
        getNextCheckInNumber(),
        0,     // CheckedIn
        null,  // stytch_user_id
        'local'  // auth_method
      );
    });

    // Create 2 events with proper status and active fields
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
    
    const events = [{ ID: event1Id }, { ID: event2Id }];

    // For each event, create event admin, locations, timeslots, clubs, and users
    events.forEach((event, eventIndex) => {
      
      // Create 1 Event Admin for this event
      const eventAdminBirthDate = new Date(new Date().getFullYear() - 40, 0, 1).toISOString().split('T')[0];
      const eventAdminRes = insertUser.run(
        `EventAdmin${eventIndex + 1}`,
        'Coordinator',
        `eventadmin${eventIndex + 1}`,
        eventAdminBirthDate,
        `eventadmin${eventIndex + 1}@example.com`,
        null,  // Phone
        passwordHash,
        'EventAdmin',
        'MasterGuide',
        null,  // ClubID
        event.ID,
        1,     // Active
        0,     // Invited
        0,     // InviteAccepted
        1,     // BackgroundCheck
        getNextCheckInNumber(),
        0,     // CheckedIn
        null,  // stytch_user_id
        'local'  // auth_method
      );
      const eventAdminId = eventAdminRes.lastInsertRowid;

      // Create 4 locations for this event
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
      });

      // Create 4 morning timeslots for this event
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
      });
      
      // Day 2 timeslots (if different day)
      if (eventData.StartDate !== eventData.EndDate) {
        morningSlots.forEach(slot => {
          const result = insertTs.run(event.ID, eventData.EndDate, slot.time, slot.end);
          timeslotIds.push(result.lastInsertRowid);
        });
      }

      // Create 4 clubs with directors, teachers, staff, and students
      const insertClub = db.prepare('INSERT INTO Clubs (Name, Church) VALUES (?, ?)');
      const insertClubEvent = db.prepare('INSERT INTO ClubEvents (ClubID, EventID) VALUES (?, ?)');
      
      // Unique club names and churches across all events
      // Event 1 clubs
      const event1Clubs = [
        { name: 'Spring Adventurers Alpha', church: 'First Baptist Church' },
        { name: 'Spring Adventurers Beta', church: 'Grace Community Church' },
        { name: 'Spring Adventurers Gamma', church: 'Hope Presbyterian Church' },
        { name: 'Spring Adventurers Delta', church: 'St. Mary\'s Catholic Church' }
      ];
      // Event 2 clubs
      const event2Clubs = [
        { name: 'Fall Adventurers Alpha', church: 'Trinity Methodist Church' },
        { name: 'Fall Adventurers Beta', church: 'Lighthouse Assembly Church' },
        { name: 'Fall Adventurers Gamma', church: 'New Life Community Church' },
        { name: 'Fall Adventurers Delta', church: 'Calvary Baptist Church' }
      ];
      
      // Select clubs based on event index
      const clubsForEvent = eventIndex === 0 ? event1Clubs : event2Clubs;
      const honorNames = ['Airplane Modeling', 'African Lore', 'Basketry', 'Block Printing'];
      
      for (let clubIndex = 0; clubIndex < 4; clubIndex++) {
        // Create club (without EventID - using junction table)
        const clubResult = insertClub.run(clubsForEvent[clubIndex].name, clubsForEvent[clubIndex].church);
        const clubId = clubResult.lastInsertRowid;
        
        // Link club to event via ClubEvents junction table
        insertClubEvent.run(clubId, event.ID);
        
        // Create club director
        const directorBirthDate = new Date(new Date().getFullYear() - 35, 0, 1).toISOString().split('T')[0];
        const directorRes = insertUser.run(
          `Director${eventIndex + 1}.${clubIndex + 1}`,
          'Leader',
          `director${eventIndex + 1}.${clubIndex + 1}`,
          directorBirthDate,
          `director${eventIndex + 1}.${clubIndex + 1}@example.com`,
          null,  // Phone
          passwordHash,
          'ClubDirector',
          'MasterGuide',
          clubId,
          event.ID,
          1,     // Active
          0,     // Invited
          0,     // InviteAccepted
          1,     // BackgroundCheck
          getNextCheckInNumber(),
          0,     // CheckedIn
          null,  // stytch_user_id
          'local'  // auth_method
        );
        const directorId = directorRes.lastInsertRowid;
        db.prepare('UPDATE Clubs SET DirectorID = ? WHERE ID = ?').run(directorId, clubId);
        
        // Create 2 teachers
        const teacherBirthDate = new Date(new Date().getFullYear() - 30, 0, 1).toISOString().split('T')[0];
        const teacherIds = [];
        for (let t = 0; t < 2; t++) {
          const teacherRes = insertUser.run(
            `Teacher${eventIndex + 1}.${clubIndex + 1}.${t + 1}`,
            'Smith',
            `teacher${eventIndex + 1}.${clubIndex + 1}.${t + 1}`,
            teacherBirthDate,
            `teacher${eventIndex + 1}.${clubIndex + 1}.${t + 1}@example.com`,
            null,  // Phone
            passwordHash,
            'Teacher',
            'MasterGuide',
            clubId,
            event.ID,
            1,     // Active
            0,     // Invited
            0,     // InviteAccepted
            1,     // BackgroundCheck
            getNextCheckInNumber(),
            0,     // CheckedIn
            null,  // stytch_user_id
            'local'  // auth_method
          );
          const teacherId = teacherRes.lastInsertRowid;
          teacherIds.push(teacherId);
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
            `staff${eventIndex + 1}.${clubIndex + 1}.${s + 1}@example.com`,
            null,  // Phone
            passwordHash,
            'Staff',
            'Guide',
            clubId,
            event.ID,
            1,     // Active
            0,     // Invited
            0,     // InviteAccepted
            1,     // BackgroundCheck
            getNextCheckInNumber(),
            0,     // CheckedIn
            null,  // stytch_user_id
            'local'  // auth_method
          );
          const staffId = staffRes.lastInsertRowid;
          staffIds.push(staffId);
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
            `student${eventIndex + 1}.${clubIndex + 1}.${st + 1}@example.com`,
            null,  // Phone
            passwordHash,
            'Student',
            investitureLevels[st],
            clubId,
            event.ID,
            1,     // Active
            0,     // Invited
            0,     // InviteAccepted
            0,     // BackgroundCheck
            getNextCheckInNumber(),
            0,     // CheckedIn
            null,  // stytch_user_id
            'local'  // auth_method
          );
          const studentId = studentRes.lastInsertRowid;
          studentIds.push(studentId);
        }
        
        // Create 1 class for this club (each club creates 1 class)
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
        }
      }
    });

    
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
