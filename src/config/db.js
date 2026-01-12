const Database = require('better-sqlite3');
const path = require('path');
const fs = require('fs');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../database.sqlite');

// Log the database path for debugging
console.log(`[Database] Using database file: ${dbPath}`);

// Ensure the directory exists for the database file
const dbDir = path.dirname(dbPath);
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

const db = new Database(dbPath);

// Enable foreign keys
db.pragma('foreign_keys = ON');

// Initialize database schema
function initializeDatabase() {
  try {
    const schema = `
      CREATE TABLE IF NOT EXISTS Users (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        FirstName TEXT NOT NULL,
        LastName TEXT NOT NULL,
        Username TEXT UNIQUE NOT NULL,
        DateOfBirth TEXT,
        Email TEXT,
        Phone TEXT,
        PasswordHash TEXT NOT NULL,
        Role TEXT NOT NULL CHECK(Role IN ('Admin', 'AdminViewOnly', 'EventAdmin', 'ClubDirector', 'Teacher', 'Student', 'Staff')),
        InvestitureLevel TEXT CHECK(InvestitureLevel IN ('Friend', 'Companion', 'Explorer', 'Ranger', 'Voyager', 'Guide', 'MasterGuide', 'None')),
        ClubID INTEGER,
        EventID INTEGER,
        Active BOOLEAN NOT NULL DEFAULT 1,
        Invited BOOLEAN NOT NULL DEFAULT 0,
        InviteAccepted BOOLEAN DEFAULT 0,
        BackgroundCheck BOOLEAN DEFAULT 0,
        CheckInNumber INTEGER UNIQUE,
        CheckedIn BOOLEAN DEFAULT 0,
        FOREIGN KEY (ClubID) REFERENCES Clubs(ID),
        FOREIGN KEY (EventID) REFERENCES Events(ID)
      );

      CREATE TABLE IF NOT EXISTS Events (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        Name TEXT NOT NULL,
        StartDate TEXT NOT NULL,
        EndDate TEXT NOT NULL,
        Status TEXT NOT NULL CHECK(Status IN ('Live', 'Closed')) DEFAULT 'Closed',
        Active BOOLEAN NOT NULL DEFAULT 1,
        Description TEXT,
        CoordinatorName TEXT NOT NULL,
        LocationDescription TEXT,
        Street TEXT,
        City TEXT,
        State TEXT,
        ZIP TEXT,
        RoleLabelStudent TEXT DEFAULT 'Student',
        RoleLabelTeacher TEXT DEFAULT 'Teacher',
        RoleLabelStaff TEXT DEFAULT 'Staff',
        RoleLabelClubDirector TEXT DEFAULT 'Club Director',
        RoleLabelEventAdmin TEXT DEFAULT 'Event Admin'
      );

      CREATE TABLE IF NOT EXISTS Locations (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        EventID INTEGER NOT NULL,
        Name TEXT NOT NULL,
        Description TEXT,
        MaxCapacity INTEGER NOT NULL,
        FOREIGN KEY (EventID) REFERENCES Events(ID)
      );

      CREATE TABLE IF NOT EXISTS Clubs (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        Name TEXT NOT NULL,
        Church TEXT,
        DirectorID INTEGER,
        FOREIGN KEY (DirectorID) REFERENCES Users(ID)
      );

      CREATE TABLE IF NOT EXISTS Timeslots (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        EventID INTEGER NOT NULL,
        Date TEXT NOT NULL,
        StartTime TEXT NOT NULL,
        EndTime TEXT NOT NULL,
        FOREIGN KEY (EventID) REFERENCES Events(ID)
      );

      CREATE TABLE IF NOT EXISTS Honors (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        Name TEXT NOT NULL,
        Category TEXT NOT NULL,
        Active BOOLEAN NOT NULL DEFAULT 1
      );

      CREATE TABLE IF NOT EXISTS Classes (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        EventID INTEGER NOT NULL,
        HonorID INTEGER NOT NULL,
        TeacherID INTEGER,
        LocationID INTEGER, -- Allow NULL for Club Directors
        TimeslotID INTEGER NOT NULL,
        MaxCapacity INTEGER NOT NULL,
        TeacherMaxStudents INTEGER NOT NULL,
        Active BOOLEAN NOT NULL DEFAULT 1,
        CreatedBy INTEGER,
        ClassGroupID TEXT, -- Links sessions of same multi-session class (NULL for single-session)
        SessionNumber INTEGER DEFAULT 1, -- Order within group: 1, 2, 3...
        MinimumLevel TEXT CHECK(MinimumLevel IN ('Friend', 'Companion', 'Explorer', 'Ranger', 'Voyager', 'Guide', 'MasterGuide', NULL)),
        FOREIGN KEY (EventID) REFERENCES Events(ID),
        FOREIGN KEY (HonorID) REFERENCES Honors(ID),
        FOREIGN KEY (TeacherID) REFERENCES Users(ID),
        FOREIGN KEY (LocationID) REFERENCES Locations(ID),
        FOREIGN KEY (TimeslotID) REFERENCES Timeslots(ID),
        FOREIGN KEY (CreatedBy) REFERENCES Users(ID)
      );

      CREATE TABLE IF NOT EXISTS Registrations (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        UserID INTEGER NOT NULL,
        ClassID INTEGER NOT NULL,
        Status TEXT NOT NULL CHECK(Status IN ('Enrolled', 'Waitlisted')),
        WaitlistOrder INTEGER,
        FOREIGN KEY (UserID) REFERENCES Users(ID),
        FOREIGN KEY (ClassID) REFERENCES Classes(ID)
      );

      CREATE TABLE IF NOT EXISTS Attendance (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        ClassID INTEGER NOT NULL,
        UserID INTEGER NOT NULL,
        Attended BOOLEAN DEFAULT 0,
        Completed BOOLEAN DEFAULT 0,
        FOREIGN KEY (ClassID) REFERENCES Classes(ID),
        FOREIGN KEY (UserID) REFERENCES Users(ID)
      );

      CREATE TABLE IF NOT EXISTS RegistrationCodes (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        Code TEXT UNIQUE NOT NULL,
        ClubID INTEGER NOT NULL,
        EventID INTEGER NOT NULL,
        CreatedBy INTEGER NOT NULL,
        CreatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        ExpiresAt TEXT NOT NULL,
        Used BOOLEAN NOT NULL DEFAULT 0,
        UsedAt TEXT,
        FOREIGN KEY (ClubID) REFERENCES Clubs(ID),
        FOREIGN KEY (EventID) REFERENCES Events(ID),
        FOREIGN KEY (CreatedBy) REFERENCES Users(ID)
      );

      CREATE TABLE IF NOT EXISTS InviteCodes (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        Code TEXT UNIQUE NOT NULL,
        FirstName TEXT NOT NULL,
        LastName TEXT NOT NULL,
        Email TEXT NOT NULL,
        Role TEXT NOT NULL CHECK(Role IN ('Admin', 'AdminViewOnly', 'EventAdmin', 'ClubDirector')),
        ClubID INTEGER,
        EventID INTEGER,
        CreatedBy INTEGER NOT NULL,
        CreatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        ExpiresAt TEXT NOT NULL,
        Used BOOLEAN NOT NULL DEFAULT 0,
        UsedAt TEXT,
        FOREIGN KEY (ClubID) REFERENCES Clubs(ID),
        FOREIGN KEY (EventID) REFERENCES Events(ID),
        FOREIGN KEY (CreatedBy) REFERENCES Users(ID)
      );

      CREATE TABLE IF NOT EXISTS ClubEvents (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        ClubID INTEGER NOT NULL,
        EventID INTEGER NOT NULL,
        CreatedAt TEXT NOT NULL DEFAULT (datetime('now')),
        FOREIGN KEY (ClubID) REFERENCES Clubs(ID),
        FOREIGN KEY (EventID) REFERENCES Events(ID),
        UNIQUE(ClubID, EventID)
      );

      CREATE TABLE IF NOT EXISTS Settings (
        Key TEXT PRIMARY KEY,
        Value TEXT
      );

      CREATE INDEX IF NOT EXISTS idx_club_events_club ON ClubEvents(ClubID);
      CREATE INDEX IF NOT EXISTS idx_club_events_event ON ClubEvents(EventID);
    `;

    db.exec(schema);
    console.log('Database schema initialized');
  } catch (error) {
    console.error('Error initializing database:', error);
    throw error;
  }
}

module.exports = {
  db,
  initializeDatabase
};
