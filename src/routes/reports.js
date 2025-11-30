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
        clb.Name as Club,
        u.CheckedIn
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
    
    // Create header row: Student Name, Attendee, Club, then all class names
    const classHeaders = classes.map(cls => {
      const timeStr = cls.StartTime ? cls.StartTime.substring(0, 5) : '';
      return `"${cls.HonorName} (${cls.Date} ${timeStr})"`;
    });
    const headerRow = [`"${studentLabel} Name"`, '"Attendee"', '"Club"', ...classHeaders];
    csvLines.push(headerRow.join(','));

    // Create data rows: user info and attendance for each class
    users.forEach(user => {
      const attendeeStatus = user.CheckedIn ? 'Attended' : 'Not Attended';
      const row = [user.StudentName, attendeeStatus, user.Club];
      
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
        clb.Name as Club,
        u.CheckedIn
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
    
    const attendanceMap = {};
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

    // Create header row: Student Name, Attendee, Club, then all class names
    const classHeaders = classes.map(cls => {
      const timeStr = cls.StartTime ? cls.StartTime.substring(0, 5) : '';
      return `"${cls.HonorName} (${cls.Date} ${timeStr})"`;
    });
    const headerRow = [`"${studentLabel} Name"`, '"Attendee"', '"Club"', ...classHeaders];
    csvLines.push(headerRow.join(','));

    // Create data rows: user info and attendance for each class
    users.forEach(user => {
      const attendeeStatus = user.CheckedIn ? 'Attended' : 'Not Attended';
      const row = [user.StudentName, attendeeStatus, user.Club];
      
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

// GET /api/reports/event/:eventId/timeslot-roster - Generate HTML timeslot roster report (Admin, EventAdmin)
router.get('/event/:eventId/timeslot-roster', requireRole('Admin', 'EventAdmin'), (req, res) => {
  try {
    const eventId = parseInt(req.params.eventId);
    const userRole = req.user.role;
    
    // EventAdmin can only access their assigned event
    if (userRole === 'EventAdmin' && req.user.eventId !== eventId) {
      return res.status(403).json({ error: 'You can only access reports for your assigned event' });
    }
    
    const Event = require('../models/event');
    const event = Event.findById(eventId);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }

    // Get all timeslots for this event, ordered by date and start time
    const timeslots = db.prepare(`
      SELECT * FROM Timeslots
      WHERE EventID = ?
      ORDER BY Date, StartTime
    `).all(eventId);

    // Get all classes with their timeslot, honor, teacher, location info
    const classes = db.prepare(`
      SELECT 
        c.ID as ClassID,
        c.TimeslotID,
        h.Name as HonorName,
        t.FirstName || ' ' || t.LastName as TeacherName,
        l.Name as LocationName,
        ts.Date as TimeslotDate,
        ts.StartTime as TimeslotStartTime,
        ts.EndTime as TimeslotEndTime
      FROM Classes c
      JOIN Honors h ON c.HonorID = h.ID
      LEFT JOIN Users t ON c.TeacherID = t.ID
      LEFT JOIN Locations l ON c.LocationID = l.ID
      JOIN Timeslots ts ON c.TimeslotID = ts.ID
      WHERE c.EventID = ? AND c.Active = 1
      ORDER BY ts.Date, ts.StartTime, h.Name
    `).all(eventId);

    // Get all enrolled students for classes in this event
    const registrations = db.prepare(`
      SELECT 
        r.ClassID,
        u.FirstName || ' ' || u.LastName as StudentName,
        clb.Name as ClubName
      FROM Registrations r
      JOIN Users u ON r.UserID = u.ID
      LEFT JOIN Clubs clb ON u.ClubID = clb.ID
      JOIN Classes c ON r.ClassID = c.ID
      WHERE r.Status = 'Enrolled' AND c.EventID = ?
      ORDER BY u.LastName, u.FirstName
    `).all(eventId);

    // Group registrations by class
    const classRosters = {};
    registrations.forEach(reg => {
      if (!classRosters[reg.ClassID]) {
        classRosters[reg.ClassID] = [];
      }
      classRosters[reg.ClassID].push({
        name: reg.StudentName,
        club: reg.ClubName || 'No Club'
      });
    });

    // Group classes by timeslot
    const timeslotClasses = {};
    classes.forEach(cls => {
      if (!timeslotClasses[cls.TimeslotID]) {
        timeslotClasses[cls.TimeslotID] = [];
      }
      timeslotClasses[cls.TimeslotID].push(cls);
    });

    // Helper function to format time
    function formatTime(timeStr) {
      if (!timeStr) return '';
      const [hours, minutes] = timeStr.split(':');
      const hour = parseInt(hours);
      const ampm = hour >= 12 ? 'PM' : 'AM';
      const displayHour = hour > 12 ? hour - 12 : (hour === 0 ? 12 : hour);
      return `${displayHour}:${minutes} ${ampm}`;
    }

    // Helper function to split students into two columns
    function splitIntoColumns(students) {
      const mid = Math.ceil(students.length / 2);
      return {
        left: students.slice(0, mid),
        right: students.slice(mid)
      };
    }

    // Build HTML
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Timeslot Roster Report - ${event.Name}</title>
  <style>
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }
    body {
      font-family: Arial, sans-serif;
      font-size: 12pt;
      line-height: 1.4;
      padding: 20px;
      color: #000;
    }
    .header {
      text-align: center;
      margin-bottom: 30px;
      border-bottom: 2px solid #000;
      padding-bottom: 15px;
    }
    .header h1 {
      font-size: 24pt;
      margin-bottom: 10px;
    }
    .header p {
      font-size: 14pt;
    }
    .timeslot-section {
      margin-bottom: 30px;
      page-break-inside: avoid;
    }
    .timeslot-header {
      background-color: #f0f0f0;
      padding: 10px;
      margin-bottom: 15px;
      border: 1px solid #000;
      font-weight: bold;
      font-size: 14pt;
    }
    .class-block {
      margin-bottom: 20px;
      page-break-inside: avoid;
      border: 1px solid #ccc;
      padding: 10px;
    }
    .class-info {
      margin-bottom: 10px;
      padding-bottom: 10px;
      border-bottom: 1px solid #ccc;
    }
    .class-info strong {
      font-size: 13pt;
    }
    .class-info p {
      margin: 3px 0;
      font-size: 11pt;
    }
    .students-container {
      display: flex;
      gap: 20px;
    }
    .student-column {
      flex: 1;
    }
    .student-item {
      padding: 3px 0;
      font-size: 11pt;
      border-bottom: 1px dotted #ccc;
    }
    .student-item:last-child {
      border-bottom: none;
    }
    @media print {
      body {
        padding: 10px;
      }
      .timeslot-section {
        page-break-inside: avoid;
      }
      .class-block {
        page-break-inside: avoid;
      }
    }
  </style>
</head>
<body>
  <div class="header">
    <h1>${event.Name}</h1>
    <p>Class Roster by Timeslot</p>
    <p>${event.StartDate} to ${event.EndDate}</p>
  </div>`;

    // Iterate through timeslots
    timeslots.forEach(timeslot => {
      const classesInTimeslot = timeslotClasses[timeslot.ID] || [];
      
      if (classesInTimeslot.length === 0) return;

      html += `
  <div class="timeslot-section">
    <div class="timeslot-header">
      ${timeslot.Date} - ${formatTime(timeslot.StartTime)} to ${formatTime(timeslot.EndTime)}
    </div>`;

      classesInTimeslot.forEach(cls => {
        const students = classRosters[cls.ClassID] || [];
        const columns = splitIntoColumns(students);

        html += `
    <div class="class-block">
      <div class="class-info">
        <strong>${cls.HonorName}</strong>
        ${cls.TeacherName ? `<p>Teacher: ${cls.TeacherName}</p>` : '<p>Teacher: TBA</p>'}
        ${cls.LocationName ? `<p>Location: ${cls.LocationName}</p>` : '<p>Location: TBA</p>'}
      </div>
      <div class="students-container">
        <div class="student-column">
          ${columns.left.map(s => `<div class="student-item">${s.name} | ${s.club}</div>`).join('')}
        </div>
        <div class="student-column">
          ${columns.right.map(s => `<div class="student-item">${s.name} | ${s.club}</div>`).join('')}
        </div>
      </div>
    </div>`;
      });

      html += `
  </div>`;
    });

    html += `
</body>
</html>`;

    res.setHeader('Content-Type', 'text/html');
    res.send(html);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


