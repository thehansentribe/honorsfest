const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const multer = require('multer');
const { parse } = require('csv-parse/sync');
const { verifyToken, requireRole } = require('../middleware/auth');
const User = require('../models/user');
const StytchService = require('../services/stytch');
const { allowMultipleClubDirectors } = require('../config/features');

const router = express.Router();

// Configure multer for CSV file uploads (memory storage)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB limit
  },
  fileFilter: (req, file, cb) => {
    // Accept CSV files only
    if (file.mimetype === 'text/csv' || file.mimetype === 'application/vnd.ms-excel' || file.originalname.endsWith('.csv')) {
      cb(null, true);
    } else {
      cb(new Error('Only CSV files are allowed'), false);
    }
  }
});

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
router.get('/search', requireRole('Admin', 'AdminViewOnly'), (req, res) => {
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

// GET /api/users/checkin/:number - Get user by check-in number (Admin, AdminViewOnly, EventAdmin, ClubDirector)
router.get('/checkin/:number', requireRole('Admin', 'AdminViewOnly', 'EventAdmin', 'ClubDirector'), (req, res) => {
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

    // DateOfBirth is optional for AdminViewOnly, required for all other roles
    const dateOfBirthRequired = Role !== 'AdminViewOnly';
    if (!FirstName || !LastName || !Role || (dateOfBirthRequired && !DateOfBirth)) {
      const requiredFields = dateOfBirthRequired 
        ? 'FirstName, LastName, DateOfBirth, and Role are required'
        : 'FirstName, LastName, and Role are required (DateOfBirth is optional for AdminViewOnly)';
      return res.status(400).json({ error: `Missing required fields: ${requiredFields}` });
    }

    // Validate email requirement based on role
    // Email is required for Admin, AdminViewOnly, EventAdmin, and ClubDirector
    // Email is optional for Teacher, Student, and Staff
    const emailRequiredRoles = ['Admin', 'AdminViewOnly', 'EventAdmin', 'ClubDirector'];
    if (emailRequiredRoles.includes(Role) && !Email) {
      return res.status(400).json({ error: 'Email is required for ' + Role });
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

    // Validate only Admin or EventAdmin can set background check (not AdminViewOnly)
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

    try {
      const user = User.create(userData);
      res.status(201).json(user);
    } catch (error) {
      if (error.message.includes('unique username')) {
        return res.status(409).json({ 
          error: 'Username conflict detected. Please try again or contact administrator if the issue persists.' 
        });
      }
      throw error; // Re-throw other errors
    }
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

// PUT /api/users/me - Update current user's own profile (all authenticated users)
// NOTE: This route MUST come before /:id route to avoid "me" being treated as an ID
router.put('/me', verifyToken, async (req, res) => {
  try {
    const updates = req.body;
    const userId = req.user.id;
    const currentUser = User.findById(userId);

    if (!currentUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Users can only update: FirstName, LastName, Email, Phone, InvestitureLevel, Password
    const allowedFields = ['FirstName', 'LastName', 'Email', 'Phone', 'InvestitureLevel', 'Password'];
    const filteredUpdates = {};
    
    for (const [key, value] of Object.entries(updates)) {
      if (allowedFields.includes(key)) {
        filteredUpdates[key] = value;
      }
    }

    // Email validation for roles that require it
    const emailRequiredRoles = ['Admin', 'AdminViewOnly', 'EventAdmin', 'ClubDirector'];
    const newEmail = filteredUpdates.Email !== undefined ? filteredUpdates.Email : currentUser.Email;
    const oldEmail = currentUser.Email;
    const emailChanged = filteredUpdates.Email && filteredUpdates.Email !== oldEmail;
    const newRole = currentUser.Role; // Role shouldn't change, but use current role
    
    if (emailRequiredRoles.includes(newRole) && !newEmail) {
      return res.status(400).json({ error: 'Email is required for ' + newRole });
    }

    // Handle email update for Stytch users
    const authMethod = currentUser.auth_method || 'local';
    let emailUpdateVerificationSent = false;
    
    if (emailChanged && authMethod === 'stytch' && currentUser.stytch_user_id) {
      try {
        // For Stytch users, we need to send a verification email to the new address
        // The email will be updated in Stytch when the user verifies it via magic link
        const baseUrl = process.env.BASE_URL || req.protocol + '://' + req.get('host');
        const redirectUrl = `${baseUrl}/login?emailVerified=true`;
        
        await StytchService.sendEmailUpdateVerification(
          currentUser.stytch_user_id,
          filteredUpdates.Email,
          redirectUrl
        );
        
        emailUpdateVerificationSent = true;
        // Note: We'll update the local DB email, but Stytch email won't update until verification
        // The user will receive a magic link at the new email to verify it
      } catch (stytchError) {
        console.error('Error sending Stytch email update verification:', stytchError);
        // If Stytch verification fails, don't update the email in local DB
        delete filteredUpdates.Email;
        return res.status(400).json({ 
          error: `Failed to send email verification: ${stytchError.message}. Your email has not been updated.` 
        });
      }
    }

    // Handle password update - check auth method
    if (filteredUpdates.Password) {
      if (authMethod === 'stytch') {
        // For Stytch users, password must be changed via Stytch
        return res.status(400).json({ 
          error: 'Password must be changed through Stytch. Please use the "Forgot Password" feature or contact an administrator.' 
        });
      } else {
        // For local users, hash the password
        filteredUpdates.PasswordHash = bcrypt.hashSync(filteredUpdates.Password, 10);
        delete filteredUpdates.Password;
      }
    }

    // Prevent users from changing role, club, event, or other sensitive fields
    delete filteredUpdates.Role;
    delete filteredUpdates.ClubID;
    delete filteredUpdates.EventID;
    delete filteredUpdates.Active;
    delete filteredUpdates.BackgroundCheck;

    const updatedUser = User.update(userId, filteredUpdates);
    if (!updatedUser) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Add message about email verification if Stytch user
    if (emailUpdateVerificationSent) {
      updatedUser.emailVerificationSent = true;
      updatedUser.emailVerificationMessage = 'A verification email has been sent to your new email address. Please check your email and click the verification link to complete the email update in Stytch.';
    }

    // Refresh JWT token if name changed (so it reflects in the token)
    const token = jwt.sign(
      {
        id: updatedUser.ID,
        username: updatedUser.Username,
        firstName: updatedUser.FirstName,
        lastName: updatedUser.LastName,
        role: updatedUser.Role,
        clubId: updatedUser.ClubID,
        eventId: updatedUser.EventID
      },
      process.env.JWT_SECRET || 'your-secret-key',
      { expiresIn: '24h' }
    );

    res.json({ user: updatedUser, token });
  } catch (error) {
    console.error('Error updating user profile:', error);
    res.status(500).json({ error: error.message });
  }
});

// PUT /api/users/:id - Update user
router.put('/:id', requireRole('Admin', 'EventAdmin', 'ClubDirector'), async (req, res) => {
  try {
    const updates = req.body;
    const userId = parseInt(req.params.id);
    const currentRecord = User.findById(userId);

    if (!currentRecord) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Remove fields that shouldn't be updated via API
    delete updates.Username;
    
    // Handle password update - check auth method
    if (updates.Password) {
      const authMethod = currentRecord.auth_method || 'local';
      if (authMethod === 'stytch') {
        // For Stytch users, password must be changed via Stytch
        return res.status(400).json({ 
          error: 'Password must be changed through Stytch. Please use the "Forgot Password" feature or contact an administrator.' 
        });
      } else {
        // For local users, hash the password
        updates.PasswordHash = bcrypt.hashSync(updates.Password, 10);
        delete updates.Password;
      }
    }
    
    // Validate only Admin or EventAdmin can update background check (not AdminViewOnly)
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
    const resolvedEmail = updates.Email !== undefined ? updates.Email : currentRecord.Email;
    const oldEmail = currentRecord.Email;
    const emailChanged = updates.Email && updates.Email !== oldEmail;

    // Validate email requirement based on role
    // Email is required for Admin, AdminViewOnly, EventAdmin, and ClubDirector
    // Email is optional for Teacher, Student, and Staff
    const emailRequiredRoles = ['Admin', 'AdminViewOnly', 'EventAdmin', 'ClubDirector'];
    if (emailRequiredRoles.includes(resolvedRole) && !resolvedEmail) {
      return res.status(400).json({ error: 'Email is required for ' + resolvedRole });
    }

    // Handle email update for Stytch users
    const authMethod = currentRecord.auth_method || 'local';
    let emailUpdateVerificationSent = false;
    
    if (emailChanged && authMethod === 'stytch' && currentRecord.stytch_user_id) {
      try {
        // For Stytch users, we need to send a verification email to the new address
        // The email will be updated in Stytch when the user verifies it via magic link
        const baseUrl = process.env.BASE_URL || req.protocol + '://' + req.get('host');
        const redirectUrl = `${baseUrl}/login?emailVerified=true`;
        
        await StytchService.sendEmailUpdateVerification(
          currentRecord.stytch_user_id,
          updates.Email,
          redirectUrl
        );
        
        emailUpdateVerificationSent = true;
        // Note: We'll update the local DB email, but Stytch email won't update until verification
        // The user will receive a magic link at the new email to verify it
      } catch (stytchError) {
        console.error('Error sending Stytch email update verification:', stytchError);
        // If Stytch verification fails, don't update the email in local DB
        delete updates.Email;
        return res.status(400).json({ 
          error: `Failed to send email verification: ${stytchError.message}. Email has not been updated.` 
        });
      }
    }

    if (!allowMultipleClubDirectors && resolvedRole === 'ClubDirector' && resolvedClubId) {
      if (User.hasDirectorConflict(resolvedClubId, currentRecord.ID)) {
        return res.status(409).json({ error: 'This club already has a director assigned.' });
      }
    }

    const user = User.update(userId, updates);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    
    // Add message about email verification if Stytch user
    if (emailUpdateVerificationSent) {
      user.emailVerificationSent = true;
      user.emailVerificationMessage = 'A verification email has been sent to the new email address. The user must check their email and click the verification link to complete the email update in Stytch.';
    }
    
    res.json(user);
  } catch (error) {
    console.error('Error updating user:', error);
    res.status(500).json({ error: error.message });
  }
});

// DELETE /api/users/:id/permanent - Permanently delete user (Admin only)
router.delete('/:id/permanent', requireRole('Admin'), async (req, res) => {
  try {
    const userId = parseInt(req.params.id);
    const user = User.findById(userId);
    
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Get user's registrations/classes before deletion
    const Registration = require('../models/registration');
    const registrations = Registration.findByUser(userId);
    const classesCount = registrations.length;

    // Delete from Stytch if user has stytch_user_id
    if (user.stytch_user_id) {
      try {
        await StytchService.deleteUser(user.stytch_user_id);
      } catch (stytchError) {
        // Log error but continue with database deletion
        console.error('Error deleting user from Stytch:', stytchError.message);
        // Don't fail the entire operation if Stytch deletion fails
      }
    }

    // Permanently delete from database
    const deletedUser = User.deletePermanently(userId);
    
    if (!deletedUser) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      message: 'User permanently deleted successfully', 
      user: deletedUser,
      classesRemoved: classesCount
    });
  } catch (error) {
    console.error('Error permanently deleting user:', error);
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

// GET /api/users/import/sample - Download sample CSV (ClubDirector only)
router.get('/import/sample', requireRole('ClubDirector'), (req, res) => {
  try {
    const headers = [
      'FirstName',
      'LastName',
      'DateOfBirth',
      'Email',
      'Phone',
      'Role',
      'InvestitureLevel',
      'Active',
      'BackgroundCheck'
    ];

    const sampleRows = [
      ['John', 'Doe', '2010-05-15', 'john.doe@example.com', '555-0101', 'Student', 'Explorer', '1', '0'],
      ['Jane', 'Smith', '1985-03-20', 'jane.smith@example.com', '555-0102', 'Teacher', 'MasterGuide', '1', '1'],
      ['Bob', 'Johnson', '1990-07-10', 'bob.johnson@example.com', '555-0103', 'Staff', 'Ranger', '1', '0']
    ];

    // Helper function to escape CSV values
    const escapeCsvValue = (value) => {
      if (value === null || value === undefined) {
        return '';
      }
      const stringValue = String(value);
      // If value contains comma, quote, or newline, wrap in quotes and escape quotes
      if (stringValue.includes(',') || stringValue.includes('"') || stringValue.includes('\n')) {
        return `"${stringValue.replace(/"/g, '""')}"`;
      }
      return stringValue;
    };

    const csvLines = [];
    csvLines.push(headers.map(escapeCsvValue).join(',')); // Add headers
    sampleRows.forEach(row => {
      csvLines.push(row.map(escapeCsvValue).join(','));
    });

    const csv = csvLines.join('\n');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=user-import-sample.csv');
    res.send(csv);
  } catch (error) {
    console.error('Error generating sample CSV:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/users/import/validate - Validate CSV file without importing (ClubDirector only)
router.post('/import/validate', requireRole('ClubDirector'), upload.single('csvFile'), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No CSV file uploaded' });
    }

    const userRole = req.user.role;
    const userClubId = req.user.clubId;
    const userEventId = req.user.eventId;

    if (!userClubId || !userEventId) {
      return res.status(400).json({ error: 'Club Director must have a club and event assigned' });
    }

    // Parse CSV file
    let records;
    try {
      records = parse(req.file.buffer.toString('utf8'), {
        columns: true,
        skip_empty_lines: true,
        trim: true,
        relax_column_count: true
      });
    } catch (parseError) {
      return res.status(400).json({ error: `CSV parsing error: ${parseError.message}` });
    }

    if (records.length === 0) {
      return res.status(400).json({ error: 'CSV file is empty or has no valid rows' });
    }

    if (records.length > 1000) {
      return res.status(400).json({ error: 'CSV file contains too many rows. Maximum 1000 users per import.' });
    }

    const validUsers = [];
    const errors = [];
    const warnings = [];
    const emailSet = new Set();

    // Valid roles for Club Directors
    const allowedRoles = ['Student', 'Teacher', 'Staff'];
    const validInvestitureLevels = ['Friend', 'Companion', 'Explorer', 'Ranger', 'Voyager', 'Guide', 'MasterGuide', 'None'];

    records.forEach((row, index) => {
      const rowNumber = index + 2; // +2 because row 1 is header, and index is 0-based
      const rowErrors = [];
      const rowWarnings = [];

      // Required fields validation
      if (!row.FirstName || !row.FirstName.trim()) {
        rowErrors.push({ field: 'FirstName', message: 'First name is required' });
      }
      if (!row.LastName || !row.LastName.trim()) {
        rowErrors.push({ field: 'LastName', message: 'Last name is required' });
      }
      if (!row.DateOfBirth || !row.DateOfBirth.trim()) {
        rowErrors.push({ field: 'DateOfBirth', message: 'Date of birth is required' });
      }
      if (!row.Role || !row.Role.trim()) {
        rowErrors.push({ field: 'Role', message: 'Role is required' });
      }

      // Role validation - Club Directors can only import Student, Teacher, or Staff
      if (row.Role && !allowedRoles.includes(row.Role.trim())) {
        rowErrors.push({ field: 'Role', message: 'Club Directors can only import Student, Teacher, or Staff roles' });
      }

      // DateOfBirth format validation (YYYY-MM-DD)
      if (row.DateOfBirth) {
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(row.DateOfBirth.trim())) {
          rowErrors.push({ field: 'DateOfBirth', message: 'Date of birth must be in YYYY-MM-DD format' });
        } else {
          // Validate it's a valid date
          const date = new Date(row.DateOfBirth.trim());
          if (isNaN(date.getTime())) {
            rowErrors.push({ field: 'DateOfBirth', message: 'Date of birth is not a valid date' });
          }
        }
      }

      // Email format validation (if provided)
      if (row.Email && row.Email.trim()) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(row.Email.trim())) {
          rowErrors.push({ field: 'Email', message: 'Invalid email format' });
        }
      }

      // InvestitureLevel validation
      if (row.InvestitureLevel && row.InvestitureLevel.trim() && !validInvestitureLevels.includes(row.InvestitureLevel.trim())) {
        rowErrors.push({ field: 'InvestitureLevel', message: `Investiture level must be one of: ${validInvestitureLevels.join(', ')}` });
      }

      // Active validation (should be 0 or 1, or true/false)
      let active = true;
      if (row.Active !== undefined && row.Active !== null && row.Active !== '') {
        const activeStr = String(row.Active).trim().toLowerCase();
        if (activeStr === '0' || activeStr === 'false' || activeStr === 'no') {
          active = false;
        } else if (activeStr !== '1' && activeStr !== 'true' && activeStr !== 'yes') {
          rowErrors.push({ field: 'Active', message: 'Active must be 1/0, true/false, or yes/no' });
        }
      }

      // BackgroundCheck validation (should be 0 or 1, or true/false)
      let backgroundCheck = false;
      if (row.BackgroundCheck !== undefined && row.BackgroundCheck !== null && row.BackgroundCheck !== '') {
        const bgStr = String(row.BackgroundCheck).trim().toLowerCase();
        if (bgStr === '1' || bgStr === 'true' || bgStr === 'yes') {
          backgroundCheck = true;
        } else if (bgStr !== '0' && bgStr !== 'false' && bgStr !== 'no') {
          rowErrors.push({ field: 'BackgroundCheck', message: 'BackgroundCheck must be 1/0, true/false, or yes/no' });
        }
      }

      // Check for duplicate emails in CSV
      if (row.Email && row.Email.trim()) {
        const emailLower = row.Email.trim().toLowerCase();
        if (emailSet.has(emailLower)) {
          rowWarnings.push({ field: 'Email', message: 'Duplicate email in CSV file' });
        } else {
          emailSet.add(emailLower);
        }

        // Check if user already exists in database
        const existingUser = User.findByEmail(emailLower);
        if (existingUser) {
          rowWarnings.push({ field: 'Email', message: `User with email ${emailLower} already exists in database` });
        }
      }

      if (rowErrors.length > 0) {
        errors.push({
          row: rowNumber,
          errors: rowErrors
        });
      } else {
        // Build valid user object
        const userData = {
          FirstName: row.FirstName.trim(),
          LastName: row.LastName.trim(),
          DateOfBirth: row.DateOfBirth.trim(),
          Email: row.Email ? row.Email.trim() : null,
          Phone: row.Phone ? row.Phone.trim() : null,
          Role: row.Role.trim(),
          InvestitureLevel: row.InvestitureLevel ? row.InvestitureLevel.trim() : 'None',
          Active: active,
          BackgroundCheck: backgroundCheck,
          ClubID: userClubId,
          EventID: userEventId,
          PasswordHash: bcrypt.hashSync('password123', 10) // Default password
        };

        validUsers.push({
          row: rowNumber,
          data: userData,
          warnings: rowWarnings
        });
      }

      // Add warnings to errors array if there are any
      if (rowWarnings.length > 0 && rowErrors.length === 0) {
        warnings.push({
          row: rowNumber,
          warnings: rowWarnings
        });
      }
    });

    res.json({
      validUsers: validUsers.map(v => v.data),
      validUsersWithMetadata: validUsers,
      errors,
      warnings,
      summary: {
        total: records.length,
        valid: validUsers.length,
        errors: errors.length,
        warnings: warnings.length
      }
    });
  } catch (error) {
    console.error('Error validating CSV:', error);
    res.status(500).json({ error: error.message });
  }
});

// POST /api/users/import/finalize - Finalize import after preview (ClubDirector only)
router.post('/import/finalize', requireRole('ClubDirector'), (req, res) => {
  try {
    const { validUsers } = req.body;

    if (!Array.isArray(validUsers) || validUsers.length === 0) {
      return res.status(400).json({ error: 'No valid users to import' });
    }

    if (validUsers.length > 1000) {
      return res.status(400).json({ error: 'Too many users to import. Maximum 1000 users per import.' });
    }

    const userRole = req.user.role;
    const userClubId = req.user.clubId;
    const userEventId = req.user.eventId;

    // Verify all users have correct ClubID and EventID
    for (const user of validUsers) {
      if (user.ClubID !== userClubId || user.EventID !== userEventId) {
        return res.status(403).json({ error: 'Cannot import users for different club or event' });
      }

      // Ensure role is allowed
      const allowedRoles = ['Student', 'Teacher', 'Staff'];
      if (!allowedRoles.includes(user.Role)) {
        return res.status(403).json({ error: 'Club Directors can only import Student, Teacher, or Staff roles' });
      }
    }

    // Use bulkCreate to import users
    const createdUsers = User.bulkCreate(validUsers);

    res.json({
      message: `Successfully imported ${createdUsers.length} user(s)`,
      count: createdUsers.length,
      users: createdUsers
    });
  } catch (error) {
    console.error('Error finalizing import:', error);
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;

