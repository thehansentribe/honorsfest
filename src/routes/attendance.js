const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const { db } = require('../config/db');
const Event = require('../models/event');

const router = express.Router();
router.use(verifyToken);

// PUT /api/attendance/:classId/:userId - Update attendance
router.put('/:classId/:userId', requireRole('Teacher', 'Admin', 'ClubDirector'), (req, res) => {
  try {
    const { Attended, Completed } = req.body;
    const classId = parseInt(req.params.classId);
    const userId = parseInt(req.params.userId);

    // Get event status to check if it's closed
    const classData = db.prepare('SELECT EventID FROM Classes WHERE ID = ?').get(classId);
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }

    const event = Event.findById(classData.EventID);
    if (event.Status === 'Closed') {
      return res.status(403).json({ error: 'Event is closed. Attendance cannot be edited.' });
    }

    // Check if attendance record exists
    let attendance = db.prepare('SELECT * FROM Attendance WHERE ClassID = ? AND UserID = ?').get(classId, userId);
    
    if (attendance) {
      // Update existing record
      db.prepare('UPDATE Attendance SET Attended = ?, Completed = ? WHERE ClassID = ? AND UserID = ?')
        .run(Attended ? 1 : 0, Completed ? 1 : 0, classId, userId);
    } else {
      // Create new record
      db.prepare('INSERT INTO Attendance (ClassID, UserID, Attended, Completed) VALUES (?, ?, ?, ?)')
        .run(classId, userId, Attended ? 1 : 0, Completed ? 1 : 0);
    }

    attendance = db.prepare('SELECT * FROM Attendance WHERE ClassID = ? AND UserID = ?').get(classId, userId);
    res.json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


