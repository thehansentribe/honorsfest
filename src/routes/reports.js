const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const { db } = require('../config/db');

const router = express.Router();
router.use(verifyToken);

// GET /api/reports/club/:clubId - Generate CSV report for club
router.get('/club/:clubId', requireRole('ClubDirector', 'Admin'), (req, res) => {
  try {
    const clubId = parseInt(req.params.clubId);

    // Get club info
    const club = db.prepare('SELECT * FROM Clubs WHERE ID = ?').get(clubId);
    if (!club) {
      return res.status(404).json({ error: 'Club not found' });
    }

    // Get event ID from a registration in this club
    const sampleReg = db.prepare(`
      SELECT cl.EventID
      FROM Registrations r
      JOIN Classes cl ON r.ClassID = cl.ID
      JOIN Users u ON r.UserID = u.ID
      WHERE u.ClubID = ?
      LIMIT 1
    `).get(clubId);
    
    if (!sampleReg) {
      return res.status(404).json({ error: 'No event data found for this club' });
    }
    
    const Event = require('../models/event');
    const event = Event.findById(sampleReg.EventID);

    // Get all users (students/staff) in this club
    const users = db.prepare(`
      SELECT DISTINCT
        u.ID as UserID,
        u.FirstName || ' ' || u.LastName as StudentName,
        clb.Name as Club
      FROM Registrations r
      JOIN Users u ON r.UserID = u.ID
      LEFT JOIN Clubs clb ON u.ClubID = clb.ID
      JOIN Classes cl ON r.ClassID = cl.ID
      WHERE u.ClubID = ? AND u.Role IN ('Student', 'Staff')
      ORDER BY u.LastName, u.FirstName
    `).all(clubId);

    // Get all classes this club's users are registered for
    const classes = db.prepare(`
      SELECT DISTINCT
        cl.ID as ClassID,
        h.Name as HonorName,
        ts.Date,
        ts.StartTime,
        ts.EndTime,
        t.FirstName || ' ' || t.LastName as TeacherName
      FROM Classes cl
      JOIN Honors h ON cl.HonorID = h.ID
      LEFT JOIN Users t ON cl.TeacherID = t.ID
      JOIN Timeslots ts ON cl.TimeslotID = ts.ID
      JOIN Registrations r ON cl.ID = r.ClassID
      JOIN Users u ON r.UserID = u.ID
      WHERE u.ClubID = ? AND cl.Active = 1 AND r.Status = 'Enrolled'
      ORDER BY ts.Date, ts.StartTime, h.Name
    `).all(clubId);

    // Get all attendance records for users in this club
    const attendanceMap = {};
    const attendanceRecords = db.prepare(`
      SELECT 
        a.UserID,
        a.ClassID,
        a.Attended,
        a.Completed
      FROM Attendance a
      JOIN Users u ON a.UserID = u.ID
      WHERE u.ClubID = ?
    `).all(clubId);
    
    attendanceRecords.forEach(record => {
      const key = `${record.UserID}-${record.ClassID}`;
      attendanceMap[key] = {
        attended: record.Attended === 1,
        completed: record.Completed === 1
      };
    });

    // Create CSV with event info at top
    const csvLines = [
      `"Event: ${event.Name}"`,
      `"Club: ${club.Name}"`,
      `"Date: ${event.StartDate} to ${event.EndDate}"`,
      `""` // Empty line
    ];

    // Get role label for students
    const studentLabel = event.RoleLabelStudent || 'Student';
    
    // Create header row: Student Name, then all class names
    const classHeaders = classes.map(cls => {
      const timeStr = cls.StartTime ? cls.StartTime.substring(0, 5) : '';
      return `"${cls.HonorName} (${cls.Date} ${timeStr})"`;
    });
    const headerRow = [`"${studentLabel} Name"`, '"Club"', ...classHeaders];
    csvLines.push(headerRow.join(','));

    // Create data rows: user info and attendance for each class
    users.forEach(user => {
      const row = [user.StudentName, user.Club];
      
      classes.forEach(cls => {
        const key = `${user.UserID}-${cls.ClassID}`;
        const attendance = attendanceMap[key];
        
        let cellValue = '';
        if (attendance) {
          if (attendance.completed) {
            cellValue = 'completed';
          } else if (attendance.attended) {
            cellValue = 'attended';
          } else {
            cellValue = 'noshow';
          }
        }
        
        row.push(`"${cellValue}"`);
      });
      
      csvLines.push(row.join(','));
    });

    const csv = csvLines.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=club-${clubId}-report.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/reports/event/:eventId - Generate CSV report for all clubs (Admin, EventAdmin, and ClubDirector)
router.get('/event/:eventId', requireRole('Admin', 'EventAdmin', 'ClubDirector'), (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const userRole = req.user.role;
    const userClubId = req.user.clubId; // Set from JWT
    
    const Event = require('../models/event');
    const event = Event.findById(eventId);

    // Build query to get users
    let usersQuery = `
      SELECT DISTINCT
        u.ID as UserID,
        u.FirstName || ' ' || u.LastName as StudentName,
        clb.Name as Club
      FROM Registrations r
      JOIN Users u ON r.UserID = u.ID
      LEFT JOIN Clubs clb ON u.ClubID = clb.ID
      JOIN Classes cl ON r.ClassID = cl.ID
      WHERE cl.EventID = ? AND u.Role IN ('Student', 'Staff')
    `;
    
    // Filter by club if user is a ClubDirector
    if (userRole === 'ClubDirector' && userClubId) {
      usersQuery += ` AND u.ClubID = ?`;
    }
    
    usersQuery += ` ORDER BY clb.Name, u.LastName, u.FirstName`;
    
    const users = userRole === 'ClubDirector' && userClubId
      ? db.prepare(usersQuery).all(eventId, userClubId)
      : db.prepare(usersQuery).all(eventId);

    // Get all classes in this event (filtered by club for ClubDirector)
    let classesQuery = `
      SELECT DISTINCT
        cl.ID as ClassID,
        h.Name as HonorName,
        ts.Date,
        ts.StartTime,
        ts.EndTime,
        t.FirstName || ' ' || t.LastName as TeacherName
      FROM Classes cl
      JOIN Honors h ON cl.HonorID = h.ID
      LEFT JOIN Users t ON cl.TeacherID = t.ID
      JOIN Timeslots ts ON cl.TimeslotID = ts.ID
      WHERE cl.EventID = ? AND cl.Active = 1
    `;
    
    // Filter classes to only those registered by users in the director's club
    if (userRole === 'ClubDirector' && userClubId) {
      classesQuery = `
        SELECT DISTINCT
          cl.ID as ClassID,
          h.Name as HonorName,
          ts.Date,
          ts.StartTime,
          ts.EndTime,
          t.FirstName || ' ' || t.LastName as TeacherName
        FROM Classes cl
        JOIN Honors h ON cl.HonorID = h.ID
        LEFT JOIN Users t ON cl.TeacherID = t.ID
        JOIN Timeslots ts ON cl.TimeslotID = ts.ID
        JOIN Registrations r ON cl.ID = r.ClassID
        JOIN Users u ON r.UserID = u.ID
        WHERE cl.EventID = ? AND cl.Active = 1 AND u.ClubID = ?
      `;
    }
    
    classesQuery += ` ORDER BY ts.Date, ts.StartTime, h.Name`;
    
    const classes = userRole === 'ClubDirector' && userClubId
      ? db.prepare(classesQuery).all(eventId, userClubId)
      : db.prepare(classesQuery).all(eventId);

    // Get all attendance records for users in this event (filtered by club for ClubDirector)
    let attendanceQuery = `
      SELECT 
        a.UserID,
        a.ClassID,
        a.Attended,
        a.Completed
      FROM Attendance a
      JOIN Classes cl ON a.ClassID = cl.ID
      WHERE cl.EventID = ?
    `;
    
    if (userRole === 'ClubDirector' && userClubId) {
      attendanceQuery = `
        SELECT 
          a.UserID,
          a.ClassID,
          a.Attended,
          a.Completed
        FROM Attendance a
        JOIN Classes cl ON a.ClassID = cl.ID
        JOIN Users u ON a.UserID = u.ID
        WHERE cl.EventID = ? AND u.ClubID = ?
      `;
    }
    
    const attendanceRecords = userRole === 'ClubDirector' && userClubId
      ? db.prepare(attendanceQuery).all(eventId, userClubId)
      : db.prepare(attendanceQuery).all(eventId);
    
    attendanceRecords.forEach(record => {
      const key = `${record.UserID}-${record.ClassID}`;
      attendanceMap[key] = {
        attended: record.Attended === 1,
        completed: record.Completed === 1
      };
    });

    // Get role label for students
    const studentLabel = event.RoleLabelStudent || 'Student';
    
    // Create CSV with event info at top
    const csvLines = [
      `"Event: ${event.Name}"`,
      `"Date: ${event.StartDate} to ${event.EndDate}"`,
      `"Status: ${event.Status}"`,
      `""` // Empty line
    ];

    // Create header row: Student Name, Club, then all class names
    const classHeaders = classes.map(cls => {
      const timeStr = cls.StartTime ? cls.StartTime.substring(0, 5) : '';
      return `"${cls.HonorName} (${cls.Date} ${timeStr})"`;
    });
    const headerRow = [`"${studentLabel} Name"`, '"Club"', ...classHeaders];
    csvLines.push(headerRow.join(','));

    // Create data rows: user info and attendance for each class
    users.forEach(user => {
      const row = [user.StudentName, user.Club];
      
      classes.forEach(cls => {
        const key = `${user.UserID}-${cls.ClassID}`;
        const attendance = attendanceMap[key];
        
        let cellValue = '';
        if (attendance) {
          if (attendance.completed) {
            cellValue = 'completed';
          } else if (attendance.attended) {
            cellValue = 'attended';
          } else {
            cellValue = 'noshow';
          }
        }
        
        row.push(`"${cellValue}"`);
      });
      
      csvLines.push(row.join(','));
    });

    const csv = csvLines.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename=event-${eventId}-report.csv`);
    res.send(csv);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


