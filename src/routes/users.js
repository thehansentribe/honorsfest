const express = require('express');
const bcrypt = require('bcrypt');
const { verifyToken, requireRole } = require('../middleware/auth');
const User = require('../models/user');

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// GET /api/users - List users with filters
router.get('/', (req, res) => {
  try {
    const filters = {
      role: req.query.role,
      clubId: req.query.clubId,
      eventId: req.query.eventId,
      active: req.query.active
    };

    const users = User.getAll(filters);
    res.json(users);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/users/:id - Get user by ID
router.get('/:id', (req, res) => {
  try {
    const user = User.findByIdWithClub(parseInt(req.params.id));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/users - Create user (Admin, EventAdmin, ClubDirector only)
router.post('/', requireRole('Admin', 'EventAdmin', 'ClubDirector'), (req, res) => {
  try {
    const { FirstName, LastName, DateOfBirth, Email, Phone, Password, Role, InvestitureLevel, ClubID, EventID, Active, BackgroundCheck } = req.body;

    if (!FirstName || !LastName || !DateOfBirth || !Role) {
      return res.status(400).json({ error: 'Missing required fields: FirstName, LastName, DateOfBirth, and Role are required' });
    }

    // Validate EventAdmin must have an EventID
    if (Role === 'EventAdmin' && !EventID) {
      return res.status(400).json({ error: 'EventAdmin must be assigned to an event' });
    }

    const passwordHash = bcrypt.hashSync(Password || 'password123', 10);
    
    // Validate only Admin or EventAdmin can set background check
    const currentUser = req.user;
    if (BackgroundCheck && !['Admin', 'EventAdmin'].includes(currentUser.role)) {
      return res.status(403).json({ error: 'Only Admin or EventAdmin can set background check status' });
    }

    const userData = {
      FirstName,
      LastName,
      DateOfBirth,
      Email,
      Phone,
      PasswordHash: passwordHash,
      Role,
      InvestitureLevel,
      ClubID,
      EventID,
      Active,
      BackgroundCheck
    };

    const user = User.create(userData);
    res.status(201).json(user);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/users/bulk - Bulk create users
router.post('/bulk', requireRole('Admin', 'EventAdmin', 'ClubDirector'), (req, res) => {
  try {
    const users = req.body; // Array of user objects

    if (!Array.isArray(users) || users.length === 0) {
      return res.status(400).json({ error: 'Expected array of users' });
    }

    const usersWithPasswords = users.map(user => ({
      ...user,
      PasswordHash: bcrypt.hashSync('password123', 10)
    }));

    const createdUsers = User.bulkCreate(usersWithPasswords);
    res.status(201).json({ count: createdUsers.length, users: createdUsers });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', requireRole('Admin', 'EventAdmin', 'ClubDirector'), (req, res) => {
  try {
    const updates = req.body;
    console.log('Updating user with data:', updates);
    
    // Remove fields that shouldn't be updated via API
    delete updates.Username;
    
    // Handle password update if provided
    if (updates.Password) {
      updates.PasswordHash = bcrypt.hashSync(updates.Password, 10);
      delete updates.Password;
    }
    
    // Validate only Admin or EventAdmin can update background check
    if (updates.BackgroundCheck !== undefined && !['Admin', 'EventAdmin'].includes(req.user.role)) {
      return res.status(403).json({ error: 'Only Admin or EventAdmin can update background check status' });
    }

    const user = User.update(parseInt(req.params.id), updates);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/users/:id - Deactivate user
router.delete('/:id', requireRole('Admin', 'EventAdmin', 'ClubDirector'), (req, res) => {
  try {
    const user = User.deactivate(parseInt(req.params.id));
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ message: 'User deactivated successfully', user });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

