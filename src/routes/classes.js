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
    const filters = {
      locationId: req.query.locationId,
      timeslotId: req.query.timeslotId,
      honorId: req.query.honorId,
      category: req.query.category,
      teacherId: req.query.teacherId
    };
    
    // Admin and EventAdmin see all classes (active and inactive)
    // Other roles (ClubDirector, Teacher, Student) only see active classes
    if (user.role !== 'Admin' && user.role !== 'EventAdmin') {
      filters.active = true;
    }
    
    const classes = Class.findByEvent(parseInt(req.params.eventId), filters);
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
    const classData = Class.create(req.body);
    res.status(201).json(classData);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// PUT /api/classes/:id - Update class
router.put('/:id', requireRole('Admin', 'EventAdmin', 'ClubDirector'), (req, res) => {
  try {
    const classData = Class.update(parseInt(req.params.id), req.body);
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


