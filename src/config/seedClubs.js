require('dotenv').config();
const { db, initializeDatabase } = require('./db');

function seedClubs() {
  try {
    initializeDatabase();

    // Get the first event (assume it exists)
    const event = db.prepare('SELECT ID FROM Events ORDER BY ID LIMIT 1').get();
    if (!event) {
      console.error('No events found. Please create an event first.');
      return;
    }

    const eventId = event.ID;

    // Check if clubs are already linked to this event
    const clubCount = db.prepare('SELECT COUNT(*) as count FROM ClubEvents WHERE EventID = ?').get(eventId);
    if (clubCount.count > 0) {
      console.log(`${clubCount.count} clubs already linked to this event`);
      return;
    }

    // Insert 3 new clubs (without EventID)
    const insertClub = db.prepare('INSERT INTO Clubs (Name, Church) VALUES (?, ?)');
    const insertClubEvent = db.prepare('INSERT INTO ClubEvents (ClubID, EventID) VALUES (?, ?)');
    
    const clubs = [
      { Name: 'Adventurer Club Alpha', Church: 'First Baptist Church' },
      { Name: 'Adventurer Club Beta', Church: 'Grace Community Church' },
      { Name: 'Adventurer Club Gamma', Church: 'Hope Presbyterian Church' }
    ];

    clubs.forEach(club => {
      const result = insertClub.run(club.Name, club.Church);
      const clubId = result.lastInsertRowid;
      insertClubEvent.run(clubId, eventId);
      console.log(`Created club: ${club.Name} at ${club.Church} (linked to event ${eventId})`);
    });

    console.log('Club seeding completed successfully');
  } catch (error) {
    console.error('Error seeding clubs:', error);
  } finally {
    db.close();
  }
}

seedClubs();

