const Database = require('better-sqlite3');
const path = require('path');

const dbPath = process.env.DATABASE_PATH || path.join(__dirname, '../../database.sqlite');
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
        Role TEXT NOT NULL CHECK(Role IN ('Admin', 'EventAdmin', 'ClubDirector', 'Teacher', 'Student', 'Staff')),
        InvestitureLevel TEXT CHECK(InvestitureLevel IN ('Friend', 'Companion', 'Explorer', 'Ranger', 'Voyager', 'Guide', 'MasterGuide', 'None')),
        ClubID INTEGER,
        EventID INTEGER,
        Active BOOLEAN NOT NULL DEFAULT 1,
        BackgroundCheck BOOLEAN DEFAULT 0,
        FOREIGN KEY (ClubID) REFERENCES Clubs(ID),
        FOREIGN KEY (EventID) REFERENCES Events(ID)
      );

      CREATE TABLE IF NOT EXISTS Events (
        ID INTEGER PRIMARY KEY AUTOINCREMENT,
        Name TEXT NOT NULL,
        StartDate TEXT NOT NULL,
        EndDate TEXT NOT NULL,
        Status TEXT NOT NULL CHECK(Status IN ('Live', 'Closed')) DEFAULT 'Closed',
        Description TEXT,
        CoordinatorName TEXT NOT NULL,
        LocationDescription TEXT,
        Street TEXT,
        City TEXT,
        State TEXT,
        ZIP TEXT
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
        EventID INTEGER NOT NULL,
        Name TEXT NOT NULL,
        Church TEXT,
        DirectorID INTEGER,
        FOREIGN KEY (EventID) REFERENCES Events(ID),
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
        Category TEXT NOT NULL
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
        FOREIGN KEY (EventID) REFERENCES Events(ID),
        FOREIGN KEY (HonorID) REFERENCES Honors(ID),
        FOREIGN KEY (TeacherID) REFERENCES Users(ID),
        FOREIGN KEY (LocationID) REFERENCES Locations(ID),
        FOREIGN KEY (TimeslotID) REFERENCES Timeslots(ID)
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
