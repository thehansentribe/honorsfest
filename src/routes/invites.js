const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const InviteCode = require('../models/inviteCode');
const User = require('../models/user');
const { allowMultipleClubDirectors } = require('../config/features');
const bcrypt = require('bcrypt');
const StytchService = require('../services/stytch');
const { determineAuthMethod } = require('../utils/authHelper');
const { db } = require('../config/db');

const router = express.Router();

// POST /api/invites - Generate an invite code (Admin, EventAdmin only - AdminViewOnly cannot create invites)
router.post('/', verifyToken, requireRole('Admin', 'EventAdmin'), (req, res) => {
  try {
    const { firstName, lastName, email, role, clubId, eventId, expiresInDays } = req.body;
    const parsedClubId = clubId ? parseInt(clubId, 10) : null;
    const parsedEventId = eventId ? parseInt(eventId, 10) : null;
    
    if (!firstName || !lastName || !email || !role) {
      return res.status(400).json({ error: 'firstName, lastName, email, and role are required' });
    }
    
    // Validate role
    if (!['Admin', 'AdminViewOnly', 'EventAdmin', 'ClubDirector'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role. Must be Admin, AdminViewOnly, EventAdmin, or ClubDirector' });
    }
    
    // Validate role-specific requirements
    if (role === 'EventAdmin' && !parsedEventId) {
      return res.status(400).json({ error: 'EventAdmin must have an eventId' });
    }
    
    if (clubId && Number.isNaN(parsedClubId)) {
      return res.status(400).json({ error: 'Invalid clubId' });
    }

    if (eventId && Number.isNaN(parsedEventId)) {
      return res.status(400).json({ error: 'Invalid eventId' });
    }

    if (role === 'ClubDirector' && !parsedClubId) {
      return res.status(400).json({ error: 'ClubDirector must have a clubId' });
    }

    if (!allowMultipleClubDirectors && role === 'ClubDirector' && parsedClubId) {
      if (User.hasDirectorConflict(parsedClubId)) {
        return res.status(409).json({ error: 'This club already has a director assigned.' });
      }
    }
    
    // EventAdmin can only create invites for their assigned event
    if (req.user.role === 'EventAdmin') {
      if (eventId && parsedEventId !== req.user.eventId) {
        return res.status(403).json({ error: 'You can only create invites for your assigned event' });
      }
      // Force eventId to their assigned event
      const assignedEventId = req.user.eventId;
    const invite = InviteCode.generate(
        { FirstName: firstName, LastName: lastName, Email: email, Role: role, ClubID: parsedClubId || null, EventID: assignedEventId },
        req.user.id,
        expiresInDays || 30
      );
      
      // Create the user record immediately but mark as invited and not active
      try {
        User.create({
          FirstName: firstName,
          LastName: lastName,
          Email: email,
          PasswordHash: '', // Empty for invited users until they set password
          Role: role,
          ClubID: parsedClubId || null,
          EventID: assignedEventId,
          Active: false, // Inactive until they accept invite
          Invited: true,
          InviteAccepted: false,
          BackgroundCheck: false,
          stytch_user_id: null,
          auth_method: 'local' // Will be updated when they register
        });
      } catch (error) {
        console.error('Error creating user for invite:', error);
        // If username conflict, try to find existing user by email
        if (error.message.includes('unique username')) {
          const existingUser = User.findByEmail(email);
          if (existingUser) {
            User.update(existingUser.ID, {
              Role: role,
              ClubID: parsedClubId || existingUser.ClubID || null,
              EventID: assignedEventId,
              Active: 0,
              Invited: 1,
              InviteAccepted: 0
            });
          } else {
            throw new Error(`Failed to create user record: ${error.message}`);
          }
        } else {
          // If user already exists by email, update their invite status
          const existingUser = User.findByEmail(email);
          if (existingUser) {
            User.update(existingUser.ID, {
              Role: role,
              ClubID: parsedClubId || existingUser.ClubID || null,
              EventID: assignedEventId,
              Active: 0,
              Invited: 1,
              InviteAccepted: 0
            });
          } else {
            throw new Error(`Failed to create user record: ${error.message}`);
          }
        }
      }
      
      return res.status(201).json(invite);
    }
    
    // Admin can create invites for any role/event/club
    const invite = InviteCode.generate(
      { FirstName: firstName, LastName: lastName, Email: email, Role: role, ClubID: parsedClubId || null, EventID: parsedEventId || null },
      req.user.id,
      expiresInDays || 30
    );
    
    // Create the user record immediately but mark as invited and not active
    // DateOfBirth will be collected when user accepts invite and registers
    try {
      User.create({
        FirstName: firstName,
        LastName: lastName,
        DateOfBirth: null, // Will be set when user completes registration
        Email: email,
        PasswordHash: '', // Empty for invited users until they set password
        Role: role,
        ClubID: parsedClubId || null,
        EventID: parsedEventId || null,
        Active: false, // Inactive until they accept invite
        Invited: true,
        InviteAccepted: false,
        BackgroundCheck: false,
        stytch_user_id: null,
        auth_method: 'local' // Will be updated when they register
      });
    } catch (error) {
      console.error('Error creating user for invite:', error);
      // If username conflict, try to find existing user by email
      if (error.message.includes('unique username')) {
        const existingUser = User.findByEmail(email);
        if (existingUser) {
          User.update(existingUser.ID, {
            Role: role,
            ClubID: parsedClubId || existingUser.ClubID || null,
            EventID: parsedEventId || existingUser.EventID || null,
            Active: 0,
            Invited: 1,
            InviteAccepted: 0
          });
        } else {
          throw new Error(`Failed to create user record: ${error.message}`);
        }
      } else {
        // If user already exists by email, update their invite status
        const existingUser = User.findByEmail(email);
        if (existingUser) {
          User.update(existingUser.ID, {
            Role: role,
            ClubID: parsedClubId || existingUser.ClubID || null,
            EventID: parsedEventId || existingUser.EventID || null,
            Active: 0,
            Invited: 1,
            InviteAccepted: 0
          });
        } else {
          // If user creation failed and user doesn't exist, we should not create the invite
          // This prevents the "User not found" error during registration
          throw new Error(`Failed to create user record: ${error.message}`);
        }
      }
    }
    
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
    const { code, password, dateOfBirth } = req.body;
    
    if (!code || !password) {
      return res.status(400).json({ error: 'code and password are required' });
    }
    
    if (!dateOfBirth) {
      return res.status(400).json({ error: 'Date of birth is required' });
    }
    
    // Validate date format
    const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
    if (!dateRegex.test(dateOfBirth)) {
      return res.status(400).json({ error: 'Invalid date format. Please use YYYY-MM-DD format.' });
    }
    
    // Validate it's a valid date
    const parsedDate = new Date(dateOfBirth);
    if (isNaN(parsedDate.getTime())) {
      return res.status(400).json({ error: 'Invalid date of birth' });
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
    
    // Find existing user (should exist if invite was sent)
    const existingUser = User.findByEmail(codeData.Email);
    
    // If user doesn't exist or wasn't invited, return error
    if (!existingUser) {
      return res.status(400).json({ error: 'User not found. Please contact the administrator.' });
    }
    
    if (!existingUser.Invited) {
      return res.status(400).json({ error: 'Invalid invite code. This user was not invited.' });
    }
    
    // Check if already accepted
    if (existingUser.InviteAccepted) {
      return res.status(400).json({ error: 'This invitation has already been accepted. Please log in.' });
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
    
    // Update existing user with password, birthdate, and activate them
    db.prepare(`
      UPDATE Users 
      SET PasswordHash = ?,
          DateOfBirth = ?,
          Active = 1,
          InviteAccepted = 1,
          stytch_user_id = ?,
          auth_method = ?
      WHERE Email = ?
    `).run(
      passwordHash,
      dateOfBirth,
      stytchUserId || null,
      authMethod,
      codeData.Email
    );
    
    // Get updated user
    const updatedUser = User.findByEmail(codeData.Email);
    
    // Mark invite code as used
    InviteCode.markUsed(code.toUpperCase());
    
    res.status(201).json({
      message: 'Account activated successfully',
      username: updatedUser.Username,
      role: updatedUser.Role
    });
  } catch (error) {
    console.error('Invite registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/invites - Get all invites created by current user (Admin, AdminViewOnly, EventAdmin)
router.get('/', verifyToken, requireRole('Admin', 'AdminViewOnly', 'EventAdmin'), (req, res) => {
  try {
    const invites = InviteCode.findByCreatedBy(req.user.id);
    res.json(invites);
  } catch (error) {
    console.error('Error fetching invites:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/invites/user/:email - Get invite code for a user (Admin, AdminViewOnly, EventAdmin)
router.get('/user/:email', verifyToken, requireRole('Admin', 'AdminViewOnly', 'EventAdmin'), (req, res) => {
  try {
    const email = req.params.email;
    const user = User.findByEmail(email);
    
    if (!user || !user.Invited) {
      return res.status(404).json({ error: 'User not found or not invited' });
    }
    
    // Find the most recent unused invite code for this user
    const invite = db.prepare(`
      SELECT * FROM InviteCodes 
      WHERE Email = ? AND Used = 0
      ORDER BY CreatedAt DESC
      LIMIT 1
    `).get(email);
    
    if (!invite) {
      return res.status(404).json({ error: 'No active invite code found for this user' });
    }
    
    res.json(invite);
  } catch (error) {
    console.error('Error fetching user invite:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/invites/:code/reset - Reset invite time (Admin, EventAdmin)
router.put('/:code/reset', verifyToken, requireRole('Admin', 'EventAdmin'), (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const { expiresInDays } = req.body;
    const codeData = InviteCode.findByCode(code);
    
    if (!codeData) {
      return res.status(404).json({ error: 'Invite code not found' });
    }
    
    // Check if already used
    if (codeData.Used === 1) {
      return res.status(400).json({ error: 'Cannot reset time for an already used invite code' });
    }
    
    // Verify the user created this invite or is an Admin
    if (req.user.role !== 'Admin' && codeData.CreatedBy !== req.user.id) {
      return res.status(403).json({ error: 'You can only reset invites you created' });
    }
    
    const updatedInvite = InviteCode.resetTime(code, expiresInDays || 30);
    res.json(updatedInvite);
  } catch (error) {
    console.error('Error resetting invite time:', error);
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

