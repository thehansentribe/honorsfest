const express = require('express');
const { verifyToken, requireRole } = require('../middleware/auth');
const RegistrationCode = require('../models/registrationCode');
const User = require('../models/user');
const bcrypt = require('bcrypt');

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
router.post('/register', (req, res) => {
  try {
    const { code, firstName, lastName, dateOfBirth, email, phone, role, investitureLevel } = req.body;
    
    if (!code || !firstName || !lastName || !email || !role) {
      return res.status(400).json({ error: 'Missing required fields' });
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
      return res.status(400).json({ error: 'This email is already registered' });
    }
    
    // Hash the default password
    const passwordHash = bcrypt.hashSync('password123', 10);
    
    // Create the user
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
      BackgroundCheck: false
    });
    
    // Don't mark code as used - codes can be reused multiple times until expiration
    // The code will remain valid until the expiration date
    
    res.status(201).json({
      message: 'Account created successfully',
      username: user.Username,
      checkInNumber: user.CheckInNumber,
      clubId: user.ClubID,
      eventId: user.EventID
    });
  } catch (error) {
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

