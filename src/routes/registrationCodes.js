const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const RegistrationCode = require('../models/registrationCode');
const User = require('../models/user');
const bcrypt = require('bcrypt');
const StytchService = require('../services/stytch');
const { determineAuthMethod } = require('../utils/authHelper');

const router = express.Router();

// POST /api/codes - Generate a registration code (ClubDirector only)
router.post('/', verifyToken, requireRole('ClubDirector'), (req, res) => {
  try {
    const { clubId, eventId, expiresInDays } = req.body;
    const Club = require('../models/club');
    
    if (!clubId || !eventId) {
      return res.status(400).json({ error: 'clubId and eventId are required' });
    }
    
    // Verify the director is associated with this club
    if (req.user.clubId !== clubId) {
      return res.status(403).json({ error: 'You can only generate codes for your own club' });
    }
    
    // Ensure club is linked to event
    Club.addToEvent(clubId, eventId);
    
    const code = RegistrationCode.generate(clubId, eventId, req.user.id, expiresInDays || 30);
    res.status(201).json(code);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// GET /api/codes/:code - Validate a registration code (public)
router.get('/:code', (req, res) => {
  try {
    const result = RegistrationCode.validate(req.params.code.toUpperCase());
    
    if (!result.valid) {
      return res.status(400).json({ error: result.error });
    }
    
    // Get club and event details
    const { db } = require('../config/db');
    const codeDetails = RegistrationCode.findByCode(req.params.code.toUpperCase());
    const club = db.prepare('SELECT * FROM Clubs WHERE ID = ?').get(codeDetails.ClubID);
    const event = db.prepare('SELECT * FROM Events WHERE ID = ?').get(codeDetails.EventID);
    
    res.json({
      valid: true,
      club: {
        id: club.ID,
        name: club.Name
      },
      event: {
        id: event.ID,
        name: event.Name
      }
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// POST /api/codes/register - Create user from registration code (public)
router.post('/register', async (req, res) => {
  try {
    const { code, firstName, lastName, dateOfBirth, email, phone, role, investitureLevel, password } = req.body;
    
    if (!code || !firstName || !lastName || !email || !role || !password) {
      return res.status(400).json({ error: 'Missing required fields' });
    }
    
    // Validate password
    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }
    
    // Check password strength (basic validation)
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
    
    // Validate the code
    const validation = RegistrationCode.validate(code.toUpperCase());
    if (!validation.valid) {
      return res.status(400).json({ error: validation.error });
    }
    
    const codeData = validation.code;
    
    // Check if email is already in use
    const existingUser = User.findByEmail(email);
    if (existingUser) {
      return res.status(400).json({ error: 'An account with this email already exists. Please use a different email or log in if you have an existing account.' });
    }
    
    // Determine authentication method based on email
    const authMethod = determineAuthMethod(email);
    let stytchUserId = null;
    let passwordHash = '';
    
    if (authMethod === 'stytch') {
      try {
        // Create user in Stytch with password
        const stytchResult = await StytchService.createUser(email, password);
        stytchUserId = stytchResult.userId;
        // PasswordHash stays empty for Stytch users
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
      FirstName: firstName,
      LastName: lastName,
      DateOfBirth: dateOfBirth || null,
      Email: email,
      Phone: phone || null,
      PasswordHash: passwordHash,
      Role: role,
      InvestitureLevel: investitureLevel || 'None',
      ClubID: codeData.ClubID,
      EventID: codeData.EventID,
      Active: true,
      BackgroundCheck: false,
      stytch_user_id: stytchUserId,
      auth_method: authMethod
    });
    
    res.status(201).json({
      message: 'Account created successfully',
      username: user.Username,
      checkInNumber: user.CheckInNumber,
      clubId: user.ClubID,
      eventId: user.EventID
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: error.message });
  }
});

// GET /api/codes/club/:clubId - Get all codes for a club (ClubDirector only)
router.get('/club/:clubId', verifyToken, requireRole('ClubDirector'), (req, res) => {
  try {
    if (req.user.clubId !== parseInt(req.params.clubId)) {
      return res.status(403).json({ error: 'You can only view codes for your own club' });
    }
    
    const codes = RegistrationCode.findByClub(req.params.clubId);
    res.json(codes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/codes/:code - Delete a registration code (ClubDirector only)
router.delete('/:code', verifyToken, requireRole('ClubDirector'), (req, res) => {
  try {
    const code = req.params.code.toUpperCase();
    const codeData = RegistrationCode.findByCode(code);
    
    if (!codeData) {
      return res.status(404).json({ error: 'Registration code not found' });
    }
    
    // Verify the director is associated with this club
    if (req.user.clubId !== codeData.ClubID) {
      return res.status(403).json({ error: 'You can only delete codes for your own club' });
    }
    
    RegistrationCode.delete(code);
    res.json({ message: 'Registration code deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

