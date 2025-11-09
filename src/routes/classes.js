const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const Class = require('../models/class');
const Honor = require('../models/honor');
const Location = require('../models/location');

const router = express.Router();
router.use(verifyToken);

// GET /api/honors - List all honors
router.get('/honors', (req, res) => {
  try {
    const filters = {
      category: req.query.category,
      search: req.query.search
    };
    const honors = Honor.getAll(filters);
    res.json(honors);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/honors/categories - Get all honor categories
router.get('/honors/categories', (req, res) => {
  try {
    const categories = Honor.getCategories();
    res.json(categories.map(c => c.Category));
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/classes/:eventId - List classes for event
router.get('/:eventId', (req, res) => {
  try {
    const user = req.user;
    const eventId = parseInt(req.params.eventId);
    
    // Check if event is active (non-admins can't see inactive events)
    const Event = require('../models/event');
    const event = Event.findById(eventId);
    
    if (!event) {
      return res.status(404).json({ error: 'Event not found' });
    }
    
    // Non-admins can only see active events
    if (user.role !== 'Admin' && user.role !== 'EventAdmin') {
      if (!event.Active) {
        return res.status(403).json({ error: 'This event is not currently active.' });
      }
      
      // Check if user's club participates in this event
      const User = require('../models/user');
      const userData = User.findById(user.id);
      
      if (userData && userData.ClubID) {
        const Club = require('../models/club');
        if (!Club.isInEvent(userData.ClubID, eventId)) {
          return res.status(403).json({ error: 'Your club is not participating in this event.' });
        }
      }
    }
    
    const filters = {
      locationId: req.query.locationId,
      timeslotId: req.query.timeslotId,
      honorId: req.query.honorId,
      category: req.query.category,
      teacherId: req.query.teacherId
    };
    
    const classes = Class.findByEvent(eventId, filters);
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/classes/details/:id - Get class details
router.get('/details/:id', (req, res) => {
  try {
    const classData = Class.findById(parseInt(req.params.id));
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    res.json(classData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/classes - Create class (Admin, EventAdmin, ClubDirector)
router.post('/', requireRole('Admin', 'EventAdmin', 'ClubDirector'), (req, res) => {
  try {
    // Set CreatedBy from authenticated user
    const classData = Class.create({
      ...req.body,
      CreatedBy: req.user.id
    });
    res.status(201).json(classData);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/classes/:id - Update class
router.put('/:id', requireRole('Admin', 'EventAdmin', 'ClubDirector'), (req, res) => {
  try {
    const classId = parseInt(req.params.id);
    const existingClass = Class.findById(classId);
    
    if (!existingClass) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // ClubDirectors can only edit classes they created
    if (req.user.role === 'ClubDirector' && existingClass.CreatedBy !== req.user.id) {
      return res.status(403).json({ error: 'You can only edit classes that you created' });
    }
    
    // ClubDirectors can only edit TeacherID and TeacherMaxStudents (max capacity)
    // They cannot edit LocationID or other fields
    if (req.user.role === 'ClubDirector') {
      const allowedFields = ['TeacherID', 'TeacherMaxStudents'];
      const restrictedFields = Object.keys(req.body).filter(key => !allowedFields.includes(key) && key !== 'CreatedBy');
      
      if (restrictedFields.length > 0) {
        return res.status(403).json({ error: `You can only edit teacher and max capacity. Cannot edit: ${restrictedFields.join(', ')}` });
      }
    }
    
    const classData = Class.update(classId, req.body);
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    res.json(classData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/classes/:id - Deactivate class
router.delete('/:id', requireRole('Admin', 'EventAdmin', 'ClubDirector'), (req, res) => {
  try {
    const classData = Class.deactivate(parseInt(req.params.id));
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    res.json({ message: 'Class deactivated successfully', class: classData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/classes/:id/activate - Reactivate class
router.post('/:id/activate', requireRole('Admin', 'EventAdmin'), (req, res) => {
  try {
    const classData = Class.activate(parseInt(req.params.id));
    if (!classData) {
      return res.status(404).json({ error: 'Class not found' });
    }
    res.json({ message: 'Class activated successfully', class: classData });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/classes/teacherless/:eventId - Get teacherless classes
router.get('/teacherless/:eventId', requireRole('Admin', 'EventAdmin', 'ClubDirector'), (req, res) => {
  try {
    const classes = Class.getTeacherlessClasses(parseInt(req.params.eventId));
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


