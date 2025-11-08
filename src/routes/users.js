const express = require('express');
const bcrypt = require('bcrypt');
const { verifyToken, requireRole } = require('../middleware/auth');
const User = require('../models/user');
const { allowMultipleClubDirectors } = require('../config/features');

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

// GET /api/users/search?firstName= - Search users by first name (for check-in dropdown)
router.get('/search', requireRole('Admin'), (req, res) => {
  try {
    const firstName = req.query.firstName || '';
    if (!firstName) {
      return res.json([]);
    }
    
    const users = User.getAll({});
    const filtered = users.filter(u => 
      u.FirstName.toLowerCase().includes(firstName.toLowerCase())
    ).slice(0, 50); // Limit to 50 results
    
    res.json(filtered);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/users/checkin/:number - Get user by check-in number (Admin, EventAdmin, ClubDirector)
router.get('/checkin/:number', requireRole('Admin', 'EventAdmin', 'ClubDirector'), (req, res) => {
  try {
    const checkInNumber = parseInt(req.params.number);
    if (isNaN(checkInNumber)) {
      return res.status(400).json({ error: 'Invalid check-in number' });
    }
    
    const user = User.findByCheckInNumber(checkInNumber);
    if (!user) {
      return res.status(404).json({ error: 'User not found with that check-in number' });
    }
    
    // Get club name if applicable
    const userWithClub = User.findByIdWithClub(user.ID);
    res.json(userWithClub || user);
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
    const clubIdInt = ClubID ? parseInt(ClubID, 10) : null;
    const eventIdInt = EventID ? parseInt(EventID, 10) : null;

    if (!FirstName || !LastName || !DateOfBirth || !Role) {
      return res.status(400).json({ error: 'Missing required fields: FirstName, LastName, DateOfBirth, and Role are required' });
    }

    // Validate EventAdmin must have an EventID
    if (Role === 'EventAdmin' && !EventID) {
      return res.status(400).json({ error: 'EventAdmin must be assigned to an event' });
    }

    const passwordHash = bcrypt.hashSync(Password || 'password123', 10);
    
    if (Role === 'ClubDirector' && !clubIdInt) {
      return res.status(400).json({ error: 'ClubDirector must be assigned to a club' });
    }

    if (!allowMultipleClubDirectors && Role === 'ClubDirector' && clubIdInt) {
      if (User.hasDirectorConflict(clubIdInt)) {
        return res.status(409).json({ error: 'This club already has a director assigned.' });
      }
    }

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
      ClubID: clubIdInt,
      EventID: eventIdInt,
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
    const userId = parseInt(req.params.id);
    const currentRecord = User.findById(userId);

    if (!currentRecord) {
      return res.status(404).json({ error: 'User not found' });
    }
    
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

    if (updates.ClubID !== undefined) {
      const parsedClubId = updates.ClubID ? parseInt(updates.ClubID, 10) : null;
      if (updates.ClubID && Number.isNaN(parsedClubId)) {
        return res.status(400).json({ error: 'Invalid ClubID' });
      }
      updates.ClubID = parsedClubId;
    }

    if (updates.EventID !== undefined) {
      const parsedEventId = updates.EventID ? parseInt(updates.EventID, 10) : null;
      if (updates.EventID && Number.isNaN(parsedEventId)) {
        return res.status(400).json({ error: 'Invalid EventID' });
      }
      updates.EventID = parsedEventId;
    }

    const resolvedRole = updates.Role || currentRecord.Role;
    const resolvedClubId = updates.ClubID !== undefined ? updates.ClubID : currentRecord.ClubID;

    if (!allowMultipleClubDirectors && resolvedRole === 'ClubDirector' && resolvedClubId) {
      if (User.hasDirectorConflict(resolvedClubId, currentRecord.ID)) {
        return res.status(409).json({ error: 'This club already has a director assigned.' });
      }
    }

    const user = User.update(userId, updates);
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

