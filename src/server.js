require('dotenv').config();
const express = require('express');
const path = require('path');
const { initializeDatabase } = require('./config/db');
const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const eventRoutes = require('./routes/events');
const classRoutes = require('./routes/classes');
const registrationRoutes = require('./routes/registrations');
const attendanceRoutes = require('./routes/attendance');
const reportRoutes = require('./routes/reports');
const locationRoutes = require('./routes/locations');
const timeslotRoutes = require('./routes/timeslots');
const clubRoutes = require('./routes/clubs');
const codeRoutes = require('./routes/registrationCodes');

const app = express();
const PORT = process.env.PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, '../public')));

// API Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/locations', locationRoutes);
app.use('/api/timeslots', timeslotRoutes);
app.use('/api/clubs', clubRoutes);
app.use('/api/classes', classRoutes);
app.use('/api/registrations', registrationRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/codes', codeRoutes);

// Serve frontend
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Initialize database on startup
async function startServer() {
  try {
    initializeDatabase();
    
    // Run migrations
    const { migrateDatabase } = require('./config/migrate');
    migrateDatabase();
    
    // Check if we need to seed the database
    const { db } = require('./config/db');
    const userCount = db.prepare('SELECT COUNT(*) as count FROM Users').get();
    
    if (userCount.count === 0) {
      console.log('Database is empty, running seed script...');
      const { seedDatabase } = require('./config/seed');
      if (typeof seedDatabase === 'function') {
        seedDatabase();
      }
    }
    
    app.listen(PORT, () => {
      console.log(`Server running on port ${PORT}`);
      console.log(`Database initialized`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;

