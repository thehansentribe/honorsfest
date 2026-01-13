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
    const user = req.user;
    const filters = {
      category: req.query.category,
      search: req.query.search
    };
    
    // Club Directors only see active honors
    if (user.role === 'ClubDirector') {
      filters.active = true;
    }
    // For other roles, honor active status can be filtered via query param if needed
    // but by default show all honors for admins
    if (req.query.active !== undefined && user.role !== 'ClubDirector') {
      filters.active = req.query.active === 'true';
    }
    
    const honors = Honor.getAll(filters);
    console.log(`[Honors API] Returning ${honors.length} honors (role: ${user.role}, active filter: ${filters.active !== undefined ? filters.active : 'none'})`);
    // Log if Dinosaurs is in the results
    const hasDinosaurs = honors.some(h => h.Name && h.Name.toLowerCase().includes('dinosaur'));
    if (hasDinosaurs) {
      console.log('[Honors API] Dinosaurs found in results');
    } else {
      console.log('[Honors API] Dinosaurs NOT found in results');
    }
    res.json(honors);
  } catch (error) {
    console.error('[Honors API] Error:', error);
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

// POST /api/classes/honors - Create a new honor
router.post('/honors', requireRole('Admin'), (req, res) => {
  try {
    const { name, category } = req.body;

    if (!name || !category) {
      return res.status(400).json({ error: 'Name and category are required' });
    }

    // Trim whitespace
    const trimmedName = name.trim();
    const trimmedCategory = category.trim();

    if (!trimmedName || !trimmedCategory) {
      return res.status(400).json({ error: 'Name and category cannot be empty' });
    }

    // Check if honor already exists (same name and category)
    const existing = Honor.findByNameAndCategory(trimmedName, trimmedCategory);
    if (existing) {
      return res.status(409).json({ 
        error: `The honor "${trimmedName}" already exists in the "${trimmedCategory}" category.` 
      });
    }

    // Create the honor
    const newHonor = Honor.create(trimmedName, trimmedCategory);
    res.status(201).json(newHonor);
  } catch (error) {
    console.error('Error creating honor:', error);
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
    
    // Get user data for all roles (needed for level filtering and club checks)
    const User = require('../models/user');
    const userData = User.findById(user.id);
    
    // Non-admins can only see active events
    if (user.role !== 'Admin' && user.role !== 'AdminViewOnly' && user.role !== 'EventAdmin') {
      if (!event.Active && user.role !== 'ClubDirector') {
        return res.status(403).json({ error: 'This event is not currently active.' });
      }

      // Check if user's club participates in this event
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
    
    // Club Directors only see active classes with active honors
    if (user.role === 'ClubDirector') {
      filters.active = true;
      filters.honorActive = true;
    }
    // For other roles, honor active status can be filtered via query param if needed
    // but by default show all classes for admins
    if (req.query.active !== undefined && user.role !== 'ClubDirector') {
      filters.active = req.query.active === 'true';
    }
    
    let classes = Class.findByEvent(eventId, filters);
    
    // Filter classes by level requirement for students and staff (non-admin roles that browse classes)
    // Admins, EventAdmins, and ClubDirectors see all classes regardless of level for management purposes
    if ((user.role === 'Student' || user.role === 'Staff') && userData) {
      const userLevel = userData.InvestitureLevel || null;
      
      classes = classes.filter(cls => {
        // Use the Class model's helper method to check level eligibility
        return Class.meetsLevelRequirement(userLevel, cls.MinimumLevel);
      });
    }
    
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
// Supports both single-session and multi-session class creation
router.post('/', requireRole('Admin', 'EventAdmin', 'ClubDirector'), (req, res) => {
  try {
    const { TimeslotIDs, isMultiSession, ...classData } = req.body;
    
    // Set CreatedBy from authenticated user
    classData.CreatedBy = req.user.id;
    
    // Handle ClubID assignment
    const User = require('../models/user');
    const userData = User.findById(req.user.id);
    
    // For ClubDirectors, automatically use their club if not specified
    if (req.user.role === 'ClubDirector') {
      if (!classData.ClubID && userData && userData.ClubID) {
        classData.ClubID = userData.ClubID;
      }
    }
    
    // Validate ClubID is provided (required for proper class attribution)
    if (!classData.ClubID) {
      return res.status(400).json({ error: 'ClubID is required to create a class' });
    }
    
    // Check if this is a multi-session class creation request
    if (TimeslotIDs && Array.isArray(TimeslotIDs) && TimeslotIDs.length > 0) {
      if (isMultiSession && TimeslotIDs.length > 1) {
        // Create linked multi-session class
        const createdClasses = Class.createMultiSession(classData, TimeslotIDs);
        res.status(201).json({
          message: `Created multi-session class with ${createdClasses.length} sessions`,
          classes: createdClasses,
          isMultiSession: true,
          classGroupId: createdClasses[0]?.ClassGroupID
        });
      } else {
        // Create separate independent classes for each timeslot (legacy behavior)
        const createdClasses = [];
        for (const timeslotId of TimeslotIDs) {
          const created = Class.create({
            ...classData,
            TimeslotID: timeslotId
          });
          createdClasses.push(created);
        }
        res.status(201).json({
          message: `Created ${createdClasses.length} separate class(es)`,
          classes: createdClasses,
          isMultiSession: false
        });
      }
    } else if (req.body.TimeslotID) {
      // Single timeslot provided (original behavior)
      const created = Class.create(classData);
      res.status(201).json(created);
    } else {
      res.status(400).json({ error: 'TimeslotID or TimeslotIDs is required' });
    }
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

// GET /api/classes/group/:groupId - Get all sessions in a multi-session class group
router.get('/group/:groupId', (req, res) => {
  try {
    const groupId = req.params.groupId;
    const classes = Class.findByGroup(groupId);
    
    if (classes.length === 0) {
      return res.status(404).json({ error: 'Class group not found' });
    }
    
    res.json({
      groupId,
      sessionCount: classes.length,
      classes
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
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
    
    // ClubDirectors can only edit TeacherID, TeacherMaxStudents (max capacity), and MinimumLevel
    // They cannot edit LocationID or other fields
    if (req.user.role === 'ClubDirector') {
      const allowedFields = ['TeacherID', 'TeacherMaxStudents', 'MinimumLevel'];
      const restrictedFields = Object.keys(req.body).filter(key => !allowedFields.includes(key) && key !== 'CreatedBy');
      
      if (restrictedFields.length > 0) {
        return res.status(403).json({ error: `You can only edit teacher, max capacity, and minimum level. Cannot edit: ${restrictedFields.join(', ')}` });
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

// DELETE /api/classes/:id/remove - Permanently delete a deactivated class
router.delete('/:id/remove', requireRole('Admin', 'EventAdmin'), (req, res) => {
  try {
    const classId = parseInt(req.params.id);
    const existingClass = Class.findById(classId);
    
    if (!existingClass) {
      return res.status(404).json({ error: 'Class not found' });
    }
    
    // Only allow deletion of inactive classes
    if (existingClass.Active) {
      return res.status(400).json({ error: 'Cannot delete an active class. Please deactivate it first.' });
    }
    
    Class.delete(classId);
    res.json({ message: 'Class removed successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/classes/teacherless/:eventId - Get teacherless classes
router.get('/teacherless/:eventId', requireRole('Admin', 'AdminViewOnly', 'EventAdmin', 'ClubDirector'), (req, res) => {
  try {
    const classes = Class.getTeacherlessClasses(parseInt(req.params.eventId));
    res.json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;


