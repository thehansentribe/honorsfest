const express = require('express');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const User = require('../models/user');
const StytchService = require('../services/stytch');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;

  if (!username || !password) {
    return res.status(400).json({ error: 'Username and password required' });
  }

  const user = User.findByUsername(username);

  if (!user || !user.Active) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Determine authentication method (default to 'local' for backward compatibility)
  const authMethod = user.auth_method || 'local';
  
  let authenticated = false;

  // Try local authentication first
  if (authMethod === 'local' || !authMethod) {
    if (user.PasswordHash && bcrypt.compareSync(password, user.PasswordHash)) {
      authenticated = true;
    }
  }

  // If local auth failed or user uses Stytch, try Stytch password authentication
  if (!authenticated && authMethod === 'stytch') {
    if (!user.Email) {
      return res.status(401).json({ error: 'Invalid credentials - email required for Stytch authentication' });
    }

    try {
      // Authenticate with Stytch using email and password
      const stytchResult = await StytchService.authenticatePassword(user.Email, password);
      
      // Verify Stytch user ID matches our user
      if (stytchResult.userId === user.stytch_user_id) {
        authenticated = true;
      } else {
        // Update stytch_user_id if it doesn't match (for users created before linking)
        if (!user.stytch_user_id) {
          User.update(user.ID, { stytch_user_id: stytchResult.userId });
        }
        authenticated = true;
      }
    } catch (stytchError) {
      // Stytch authentication failed - fall through to return error
      return res.status(401).json({ error: 'Invalid credentials' });
    }
  }

  if (!authenticated) {
    return res.status(401).json({ error: 'Invalid credentials' });
  }

  // Generate JWT token
  const token = jwt.sign(
    {
      id: user.ID,
      username: user.Username,
      role: user.Role,
      firstName: user.FirstName,
      lastName: user.LastName,
      clubId: user.ClubID,
      eventId: user.EventID,
      investitureLevel: user.InvestitureLevel,
      authMethod: authMethod
    },
    process.env.JWT_SECRET,
    { expiresIn: '24h' }
  );

  res.json({
    token,
    user: {
      id: user.ID,
      username: user.Username,
      role: user.Role,
      firstName: user.FirstName,
      lastName: user.LastName,
      clubId: user.ClubID,
      eventId: user.EventID,
      investitureLevel: user.InvestitureLevel,
      authMethod: authMethod
    }
  });
});

// POST /api/auth/magic/send - Send magic link to user's email (optional, for Stytch users)
router.post('/magic/send', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user by email (case-insensitive)
    let user;
    try {
      user = User.findByEmail(email);
    } catch (dbError) {
      console.error('Database error finding user:', dbError.message || dbError);
      return res.status(500).json({ error: 'Database error. Please try again.' });
    }
    if (!user) {
      // Don't reveal if email exists - security best practice
      return res.status(200).json({ 
        message: 'If an account exists with this email, a magic link has been sent.' 
      });
    }

    // Normalize auth_method (handle old 'password' value as 'local')
    const authMethod = user.auth_method === 'password' ? 'local' : (user.auth_method || 'local');

    // Check if user uses Stytch authentication
    if (authMethod !== 'stytch') {
      return res.status(400).json({ 
        error: 'This account uses password authentication. Please use your username and password to log in, or request a password reset if you forgot your password.' 
      });
    }

    // Check if user has Stytch ID (required for magic link)
    if (!user.stytch_user_id) {
      return res.status(400).json({ 
        error: 'This account is not properly linked to email authentication. Please use your username and password to log in.' 
      });
    }

    // Send magic link
    // Note: The redirect URL must match exactly what's in Stytch dashboard
    // For magic links, we use /authenticate.html for both login and signup
    // Ensure HTTPS in production (Render and other platforms use X-Forwarded-Proto)
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : req.protocol;
    const baseUrl = `${protocol}://${req.get('host')}`;
    const redirectUrl = `${baseUrl}/authenticate.html`;
    
    try {
      await StytchService.sendMagicLink(email, redirectUrl);
      
      res.status(200).json({ 
        message: 'If an account exists with this email, a magic link has been sent.' 
      });
    } catch (stytchError) {
      console.error('Stytch magic link error:', stytchError.message || stytchError);
      
      // Extract error message from various possible formats
      const errorMsg = stytchError?.message || stytchError?.error_message || stytchError?.toString() || 'Unknown error';
      
      // Provide more helpful error messages based on error type
      let errorMessage = 'Unable to send magic link. Please try again later or use your username and password to log in.';
      
      if (errorMsg.includes('Redirect URL configuration error')) {
        errorMessage = errorMsg; // Use the specific error message from Stytch service
      } else if (errorMsg.includes('not found') || errorMsg.includes('404')) {
        errorMessage = 'Unable to send magic link. This account may not be set up for email authentication. Please use your username and password to log in.';
      } else if (errorMsg.includes('email') || errorMsg.includes('invalid')) {
        errorMessage = 'Unable to send magic link to this email address. Please verify your email and try again.';
      }
      
      return res.status(500).json({ error: errorMessage });
    }
  } catch (error) {
    console.error('Magic link send error:', error.message || error);
    res.status(500).json({ 
      error: 'An error occurred. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/auth/password-reset/request - Request password reset (public)
router.post('/password-reset/request', async (req, res) => {
  try {
    const { email } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email is required' });
    }

    // Find user by email (case-insensitive)
    let user;
    try {
      user = User.findByEmail(email);
    } catch (dbError) {
      console.error('Database error finding user:', dbError.message || dbError);
      return res.status(500).json({ error: 'Database error. Please try again.' });
    }
    if (!user) {
      // Don't reveal if email exists - security best practice
      return res.status(200).json({ 
        message: 'If an account exists with this email, a password reset link has been sent.' 
      });
    }

    // Normalize auth_method (handle old 'password' value as 'local')
    const authMethod = user.auth_method === 'password' ? 'local' : (user.auth_method || 'local');

    // Only Stytch users can reset password via Stytch
    // Local users would need admin assistance or a different method
    if (authMethod !== 'stytch') {
      // For local users, inform them they need admin help
      return res.status(400).json({ 
        error: 'Password reset is only available for accounts using email authentication. Please contact an administrator for assistance with password reset.' 
      });
    }

    // Check if user has Stytch ID (required for password reset)
    if (!user.stytch_user_id) {
      return res.status(400).json({ 
        error: 'This account is not properly linked to email authentication. Please contact an administrator for assistance.' 
      });
    }

    // Send password reset email via Stytch
    // Note: The redirect URL must be registered in Stytch dashboard exactly as shown
    // It must NOT include query parameters - Stytch will append the token automatically
    // Ensure HTTPS in production (Render and other platforms use X-Forwarded-Proto)
    const protocol = req.secure || req.headers['x-forwarded-proto'] === 'https' ? 'https' : req.protocol;
    const baseUrl = `${protocol}://${req.get('host')}`;
    const resetPasswordRedirectUrl = `${baseUrl}/reset-password.html`;
    
    try {
      await StytchService.sendPasswordResetEmail(email, resetPasswordRedirectUrl);
      
      res.status(200).json({ 
        message: 'If an account exists with this email, a password reset link has been sent. Please check your email.' 
      });
    } catch (stytchError) {
      console.error('Stytch password reset error:', stytchError.message || stytchError);
      
      // Extract error message from various possible formats
      const errorMsg = stytchError?.message || stytchError?.error_message || stytchError?.toString() || 'Unknown error';
      
      // Provide more helpful error messages based on error type
      let errorMessage = 'Unable to send password reset email. Please try again later or contact support.';
      
      if (errorMsg.includes('Redirect URL configuration error')) {
        errorMessage = errorMsg; // Use the specific error message from Stytch service
      } else if (errorMsg.includes('not found') || errorMsg.includes('404')) {
        errorMessage = 'Unable to send password reset email. This account may not be set up for email authentication. Please contact support for assistance.';
      } else if (errorMsg.includes('email') || errorMsg.includes('invalid')) {
        errorMessage = 'Unable to send password reset email to this email address. Please verify your email and try again.';
      }
      
      // Don't reveal Stytch-specific errors to user - security best practice
      return res.status(500).json({ 
        error: errorMessage
      });
    }
  } catch (error) {
    console.error('Password reset request error:', error.message || error);
    // Return user-friendly error message
    return res.status(500).json({ 
      error: 'An error occurred while processing your request. Please try again.',
      details: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// POST /api/auth/password-reset/confirm - Confirm password reset (public)
router.post('/password-reset/confirm', async (req, res) => {
  try {
    const { token, password } = req.body;

    if (!token || !password) {
      return res.status(400).json({ error: 'Token and password are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters long' });
    }

    // Reset password via Stytch
    await StytchService.resetPassword(token, password);

    res.status(200).json({ 
      message: 'Your password has been reset successfully. You can now log in with your new password.' 
    });
  } catch (error) {
    console.error('Password reset confirm error:', error.message || error);
    res.status(400).json({ 
      error: 'Failed to reset password. The reset link may have expired or is invalid. Please request a new password reset link.' 
    });
  }
});

// POST /api/auth/stytch/callback - Authenticate magic link token
router.post('/stytch/callback', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ error: 'Token is required' });
    }

    // Authenticate with Stytch
    const stytchResult = await StytchService.authenticateMagicLink(token);
    
    // Find user by Stytch user ID
    let user = User.findByStytchUserId(stytchResult.userId);
    
    // If user not found by Stytch ID, try by email (for users created before Stytch ID was linked)
    if (!user && stytchResult.email) {
      user = User.findByEmail(stytchResult.email);
      // Link Stytch ID to existing user
      if (user && user.auth_method === 'stytch') {
        User.update(user.ID, { stytch_user_id: stytchResult.userId });
      }
    }

    if (!user || !user.Active) {
      return res.status(401).json({ error: 'User not found or inactive' });
    }

    // Generate JWT token
    const jwtToken = jwt.sign(
      {
        id: user.ID,
        username: user.Username,
        role: user.Role,
        firstName: user.FirstName,
        lastName: user.LastName,
        clubId: user.ClubID,
        eventId: user.EventID
      },
      process.env.JWT_SECRET,
      { expiresIn: '24h' }
    );

    res.json({
      token: jwtToken,
      user: {
        id: user.ID,
        username: user.Username,
        role: user.Role,
        firstName: user.FirstName,
        lastName: user.LastName,
        clubId: user.ClubID,
        eventId: user.EventID,
        investitureLevel: user.InvestitureLevel
      }
    });
  } catch (error) {
    res.status(401).json({ error: 'Invalid or expired magic link token' });
  }
});

module.exports = router;
