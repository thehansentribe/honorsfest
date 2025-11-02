const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const InviteCode = require('../models/inviteCode');
const User = require('../models/user');
const bcrypt = require('bcrypt');
const StytchService = require('../services/stytch');
const { determineAuthMethod } = require('../utils/authHelper');

const router = express.Router();

// POST /api/invites - Generate an invite code (Admin, EventAdmin)
router.post('/', verifyToken, requireRole('Admin', 'EventAdmin'), (req, res) => {
  try {
    const { firstName, lastName, email, role, clubId, eventId, expiresInDays } = req.body;
    
    if (!firstName || !lastName || !email || !role) {
      return res.status(400).json({ error: 'firstName, lastName, email, and role are required' });
    }
    
    // Validate role
    if (!['Admin', 'EventAdmin', 'ClubDirector'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be Admin, EventAdmin, or ClubDirector' });
    }
    
    // Validate role-specific requirements
    if (role === 'EventAdmin' && !eventId) {
      return res.status(400).json({ error: 'EventAdmin must have an eventId' });
    }
    
    if (role === 'ClubDirector' && !clubId) {
      return res.status(400).json({ error: 'ClubDirector must have a clubId' });
    }
    
    // EventAdmin can only create invites for their assigned event
    if (req.user.role === 'EventAdmin') {
      if (eventId && parseInt(eventId) !== req.user.eventId) {
        return res.status(403).json({ error: 'You can only create invites for your assigned event' });
      }
      // Force eventId to their assigned event
      const assignedEventId = req.user.eventId;
      const invite = InviteCode.generate(
        { FirstName: firstName, LastName: lastName, Email: email, Role: role, ClubID: clubId || null, EventID: assignedEventId },
        req.user.id,
        expiresInDays || 30
      );
      
      return res.status(201).json(invite);
    }
    
    // Admin can create invites for any role/event/club
    const invite = InviteCode.generate(
      { FirstName: firstName, LastName: lastName, Email: email, Role: role, ClubID: clubId || null, EventID: eventId || null },
      req.user.id,
      expiresInDays || 30
    );
    
    res.status(201).json(invite);
  } catch (error) {
    console.error('Error generating invite:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/invites/:code - Validate an invite code (public)
router.get('/:code', (req, res) => {
  try {
    const result = InviteCode.validate(req.params.code);
    
    if (!result.valid) {
      return res.status(400).json({ error: result.error });
    }
    
    const codeData = result.code;
    
    // Get club and event details if applicable
    const { db } = require('../config/db');
    const club = codeData.ClubID ? db.prepare('SELECT * FROM Clubs WHERE ID = ?').get(codeData.ClubID) : null;
    const event = codeData.EventID ? db.prepare('SELECT * FROM Events WHERE ID = ?').get(codeData.EventID) : null;
    
    res.json({
      valid: true,
      firstName: codeData.FirstName,
      lastName: codeData.LastName,
      email: codeData.Email,
      role: codeData.Role,
      club: club ? { id: club.ID, name: club.Name } : null,
      event: event ? { id: event.ID, name: event.Name } : null
    });
  } catch (error) {
    console.error('Error validating invite:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/invites/register - Create user from invite code (public)
router.post('/register', async (req, res) => {
  try {
    const { code, password } = req.body;
    
    if (!code || !password) {
      return res.status(400).json({ error: 'code and password are required' });
    }
    
    // Validate password
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    
    // Check password strength
    const hasUpperCase = /[A-Z]/.test(password);
    const hasLowerCase = /[a-z]/.test(password);
    const hasNumber = /[0-9]/.test(password);
    const hasSpecialChar = /[^A-Za-z0-9]/.test(password);
    const commonWords = ['password', 'admin', 'qwerty', '123456', 'password123'];
    const isCommonPassword = commonWords.some(word => password.toLowerCase().includes(word.toLowerCase()));
    
    if (!hasUpperCase || !hasLowerCase || !hasNumber || !hasSpecialChar) {
      return res.status(400).json({ 
        error: 'Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character' 
      });
    }
    
    if (isCommonPassword) {
      return res.status(400).json({ 
        error: 'Password is too weak. Please avoid common words or patterns.' 
      });
    }
    
    // Validate the invite code
    const validation = InviteCode.validate(code.toUpperCase());
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    
    const codeData = validation.code;
    
    // Check if email is already in use
    const existingUser = User.findByEmail(codeData.Email);
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists. Please log in if you have an existing account.' });
    }
    
    // Determine authentication method based on email
    const authMethod = determineAuthMethod(codeData.Email);
    let stytchUserId = null;
    let passwordHash = '';
    
    if (authMethod === 'stytch') {
      try {
        // Create user in Stytch with password
        const stytchResult = await StytchService.createUser(codeData.Email, password);
        stytchUserId = stytchResult.userId;
      } catch (stytchError) {
        console.error('Stytch user creation error:', stytchError);
        return res.status(500).json({ 
          error: stytchError.message || 'Failed to create authentication account. Please try again.' 
        });
      }
    } else {
      // Local authentication: hash the password
      passwordHash = bcrypt.hashSync(password, 10);
    }
    
    // Create the user in our database
    const user = User.create({
      FirstName: codeData.FirstName,
      LastName: codeData.LastName,
      Email: codeData.Email,
      PasswordHash: passwordHash,
      Role: codeData.Role,
      ClubID: codeData.ClubID || null,
      EventID: codeData.EventID || null,
      Active: true,
      BackgroundCheck: false,
      stytch_user_id: stytchUserId,
      auth_method: authMethod
    });
    
    // Mark invite code as used
    InviteCode.markUsed(code.toUpperCase());
    
    res.status(201).json({
      message: 'Account created successfully',
      username: user.Username,
      role: user.Role
    });
  } catch (error) {
    console.error('Invite registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/invites - Get all invites created by current user (Admin, EventAdmin)
router.get('/', verifyToken, requireRole('Admin', 'EventAdmin'), (req, res) => {
  try {
    const invites = InviteCode.findByCreatedBy(req.user.id);
    res.json(invites);
  } catch (error) {
    console.error('Error fetching invites:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/invites/:code - Delete an invite code (Admin, EventAdmin)
router.delete('/:code', verifyToken, requireRole('Admin', 'EventAdmin'), (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const codeData = InviteCode.findByCode(code);
    
    if (!codeData) {
      return res.status(404).json({ error: 'Invite code not found' });
    }
    
    // Verify the user created this invite or is an Admin
    if (req.user.role !== 'Admin' && codeData.CreatedBy !== req.user.id) {
      return res.status(403).json({ error: 'You can only delete invites you created' });
    }
    
    InviteCode.delete(code);
    res.json({ message: 'Invite code deleted successfully' });
  } catch (error) {
    console.error('Error deleting invite:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

