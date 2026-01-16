const stytch = require('stytch');

// Initialize Stytch client
let client;
let stytchEnv = 'test'; // default

// Auto-detect environment from Project ID if provided
const projectId = process.env.STYTCH_PROJECT_ID;
if (projectId) {
  if (projectId.startsWith('project-live-')) {
    stytchEnv = 'live';
  } else if (projectId.startsWith('project-test-')) {
    stytchEnv = 'test';
  }
}

// Warn if there's a mismatch between Project ID and Secret
const secret = process.env.STYTCH_SECRET;
if (projectId && secret) {
  const isLiveProject = projectId.startsWith('project-live-');
  const isLiveSecret = secret.startsWith('secret-live-');
  const isTestSecret = secret.startsWith('secret-test-');
  
  if (isLiveProject && !isLiveSecret) {
    console.warn('⚠️  WARNING: LIVE Project ID detected but non-LIVE secret provided!');
  }
  if (!isLiveProject && !isTestSecret) {
    console.warn('⚠️  WARNING: TEST Project ID detected but non-TEST secret provided!');
  }
}

try {
  // For Stytch SDK v12+, use the base URL from stytch.envs
  const envValue = stytchEnv === 'live' ? stytch.envs.live : stytch.envs.test;
  client = new stytch.Client({
    project_id: process.env.STYTCH_PROJECT_ID,
    secret: process.env.STYTCH_SECRET,
    env: envValue,
  });
  // Stytch client initialized
} catch (error) {
  console.error('Failed to initialize Stytch client:', error.message);
  console.error('Make sure STYTCH_PROJECT_ID and STYTCH_SECRET are set in .env');
}

class StytchService {
  /**
   * Create a new user with email and password
   * @param {string} email - User's email address
   * @param {string} password - User's password
   * @returns {Promise<Object>} User ID and email
   */
  static async createUser(email, password) {
    try {
      const params = {
        email: email.toLowerCase().trim(),
        password: password,
        session_duration_minutes: 60,
      };

      const response = await client.passwords.create(params);
      
      return {
        userId: response.user_id,
        email: response.email,
      };
    } catch (error) {
      console.error('Stytch createUser error:', error.message || error);
      
      // Provide more specific error messages
      if (error.status_code === 404) {
        throw new Error('Project not found. Please check your Stytch configuration. Error: Project ID and Secret must match the same environment (Live or Test).');
      } else if (error.status_code === 400 && error.error_type === 'weak_password') {
        throw new Error('Password does not meet strength requirements. Please choose a stronger password.');
      } else if (error.status_code === 409 && error.error_type === 'duplicate_email') {
        throw new Error('An account with this email address already exists.');
      }
      
      throw new Error(`Failed to create Stytch user: ${error.message || JSON.stringify(error)}`);
    }
  }

  /**
   * Check password strength
   * @param {string} password - Password to check
   * @returns {Promise<Object>} Strength check result
   */
  static async checkPasswordStrength(password) {
    try {
      const params = { password };
      const response = await client.passwords.strengthCheck(params);
      return {
        validPassword: response.valid_password,
        score: response.score,
        breachDetection: response.breach_detection,
      };
    } catch (error) {
      console.error('Stytch checkPasswordStrength error:', error.message || error);
      // Return a default "weak" result if the check fails
      return {
        validPassword: false,
        score: 0,
        breachDetection: { isBreached: false },
      };
    }
  }

  /**
   * Authenticate user with email and password
   * @param {string} email - User's email address
   * @param {string} password - User's password
   * @returns {Promise<Object>} User ID and email
   */
  static async authenticatePassword(email, password) {
    try {
      const params = {
        email: email.toLowerCase().trim(),
        password: password,
      };

      const response = await client.passwords.authenticate(params);
      
      return {
        userId: response.user_id,
        email: response.email,
      };
    } catch (error) {
      console.error('Stytch authenticatePassword error:', error.message || error);
      throw new Error(`Failed to authenticate password: ${error.message}`);
    }
  }

  /**
   * Send password reset email to user
   * @param {string} email - User's email address
   * @param {string} resetPasswordRedirectUrl - URL to redirect after reset
   * @returns {Promise<Object>} Response with email_id
   */
  static async sendPasswordResetEmail(email, resetPasswordRedirectUrl) {
    try {
      const params = {
        email: email.toLowerCase().trim(),
        reset_password_redirect_url: resetPasswordRedirectUrl,
      };

      const response = await client.passwords.email.resetStart(params);
      
      return {
        emailId: response.email_id,
        statusCode: response.status_code,
      };
    } catch (error) {
      console.error('Stytch sendPasswordResetEmail error:', error.message || error);
      
      // Provide more specific error messages
      if (error.status_code === 404) {
        throw new Error('User not found in authentication system. Please contact support.');
      } else if (error.status_code === 400 && error.error_type === 'query_params_do_not_match') {
        throw new Error('Redirect URL configuration error. The reset password redirect URL is not properly configured in the authentication system. Please contact support.');
      } else if (error.status_code === 400 && error.error_type === 'invalid_request_error') {
        throw new Error('Invalid request. Please verify your email address and try again.');
      }
      
      throw new Error(`Failed to send password reset email: ${error.message || JSON.stringify(error)}`);
    }
  }

  /**
   * Reset password using token from email
   * @param {string} passwordResetToken - Token from password reset email
   * @param {string} newPassword - New password
   * @returns {Promise<Object>} Reset response
   */
  static async resetPassword(passwordResetToken, newPassword) {
    try {
      const params = {
        token: passwordResetToken,
        password: newPassword,
      };

      const response = await client.passwords.email.reset(params);
      return response;
    } catch (error) {
      console.error('Stytch resetPassword error:', error.message || error);
      
      // Provide more specific error messages
      if (error.status_code === 400 && error.error_type === 'weak_password') {
        throw new Error('Password does not meet strength requirements. Please choose a stronger password that meets all requirements.');
      } else if (error.status_code === 400 && error.error_message) {
        // Check if error message contains password-related information
        if (error.error_message.toLowerCase().includes('password') || 
            error.error_message.toLowerCase().includes('weak') ||
            error.error_message.toLowerCase().includes('strength')) {
          throw new Error(`Password does not meet requirements: ${error.error_message}`);
        }
      }
      
      throw new Error(`Failed to reset password: ${error.message}`);
    }
  }

  /**
   * Send magic link email to user (optional, for passwordless login)
   * @param {string} email - User's email address
   * @param {string} redirectUrl - URL to redirect after authentication (must match dashboard Login/Signup URL)
   * @param {number} expirationMinutes - Link expiration time (default 60)
   * @returns {Promise<Object>} Stytch response with email_id
   */
  static async sendMagicLink(email, redirectUrl, expirationMinutes = 60) {
    try {
      // Use the same URL for both login and signup magic links
      // This URL must be registered in the Stytch dashboard
      const params = {
        email: email.toLowerCase().trim(),
        login_magic_link_url: redirectUrl,
        login_expiration_minutes: expirationMinutes,
        signup_magic_link_url: redirectUrl,  // Same URL for both
        signup_expiration_minutes: expirationMinutes,
      };

      const response = await client.magicLinks.email.loginOrCreate(params);
      
      return {
        emailId: response.email_id,
        statusCode: response.status_code,
      };
    } catch (error) {
      console.error('Stytch sendMagicLink error:', error.message || error);
      
      // Provide more specific error messages
      if (error.status_code === 404) {
        throw new Error('Project not found. Please contact support.');
      } else if (error.status_code === 400 && error.error_type === 'query_params_do_not_match') {
        throw new Error('Redirect URL configuration error. The magic link redirect URL is not properly configured in the authentication system. Please contact support.');
      } else if (error.status_code === 400 && error.error_message && error.error_message.includes('did not match any redirect URLs')) {
        throw new Error(`Redirect URL mismatch. The URL "${redirectUrl}" is not registered in the Stytch dashboard. Please add it to https://stytch.com/dashboard/redirect-urls and ensure it's configured for both Login and Signup.`);
      } else if (error.status_code === 400) {
        throw new Error(`Invalid request: ${error.error_message || error.message}`);
      }
      
      throw new Error(`Failed to send magic link: ${error.message || JSON.stringify(error)}`);
    }
  }

  /**
   * Verify and authenticate magic link token
   * @param {string} token - Magic link token from email
   * @param {number} sessionDurationMinutes - Session duration (default 60)
   * @returns {Promise<Object>} Session and user information
   */
  static async authenticateMagicLink(token, sessionDurationMinutes = 60) {
    try {
      const params = {
        token: token,
        session_duration_minutes: sessionDurationMinutes,
      };

      const response = await client.magicLinks.authenticate(params);
      
      return {
        userId: response.user_id,
        email: response.email,
      };
    } catch (error) {
      console.error('Stytch authenticateMagicLink error:', error.message || error);
      throw new Error(`Failed to authenticate magic link: ${error.message}`);
    }
  }

  /**
   * Send email update verification to new email address
   * This sends a magic link to the new email that, when verified, will add it to the existing user
   * @param {string} userId - Stytch user ID
   * @param {string} newEmail - New email address to add
   * @param {string} redirectUrl - URL to redirect after email verification
   * @returns {Promise<Object>} Response with email_id
   */
  static async sendEmailUpdateVerification(userId, newEmail, redirectUrl) {
    try {
      const params = {
        user_id: userId,
        email: newEmail.toLowerCase().trim(),
        login_magic_link_url: redirectUrl,
        login_expiration_minutes: 60,
        signup_magic_link_url: redirectUrl,
        signup_expiration_minutes: 60,
      };

      // Use magicLinks.email.send with user_id to add email to existing user
      const response = await client.magicLinks.email.send(params);
      
      return {
        emailId: response.email_id,
        statusCode: response.status_code,
      };
    } catch (error) {
      console.error('Stytch sendEmailUpdateVerification error:', error.message || error);
      
      // Provide more specific error messages
      if (error.status_code === 404) {
        throw new Error('User not found in Stytch. Please contact support.');
      } else if (error.status_code === 409 && error.error_type === 'duplicate_email') {
        throw new Error('This email address is already associated with another account.');
      } else if (error.status_code === 400 && error.error_message && error.error_message.includes('did not match any redirect URLs')) {
        throw new Error(`Redirect URL mismatch. The URL "${redirectUrl}" is not registered in the Stytch dashboard.`);
      }
      
      throw new Error(`Failed to send email update verification: ${error.message || JSON.stringify(error)}`);
    }
  }

  /**
   * Delete a user from Stytch
   * @param {string} userId - Stytch user ID
   * @returns {Promise<Object>} Delete response
   */
  static async deleteUser(userId) {
    try {
      const params = {
        user_id: userId
      };

      const response = await client.users.delete(params);
      
      return {
        success: true,
        statusCode: response.status_code
      };
    } catch (error) {
      console.error('Stytch deleteUser error:', error.message || error);
      
      // Provide more specific error messages
      if (error.status_code === 404) {
        throw new Error('User not found in Stytch.');
      }
      
      throw new Error(`Failed to delete Stytch user: ${error.message || JSON.stringify(error)}`);
    }
  }
}

module.exports = StytchService;

