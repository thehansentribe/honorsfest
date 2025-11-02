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
  console.log(`✓ Stytch client initialized (${stytchEnv.toUpperCase()} environment)`);
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
      console.log('Stytch user created:', response.user_id);
      
      return {
        userId: response.user_id,
        email: response.email,
      };
    } catch (error) {
      console.error('Stytch createUser error:', error);
      
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
      console.error('Stytch checkPasswordStrength error:', error);
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
      console.error('Stytch authenticatePassword error:', error);
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

      console.log('Sending password reset to Stytch with params:', { email: params.email, redirectUrl: resetPasswordRedirectUrl });
      const response = await client.passwords.email.resetStart(params);
      console.log('Stytch password reset response:', { emailId: response.email_id, statusCode: response.status_code });
      
      return {
        emailId: response.email_id,
        statusCode: response.status_code,
      };
    } catch (error) {
      console.error('Stytch sendPasswordResetEmail error:', error);
      console.error('Stytch sendPasswordResetEmail error type:', typeof error);
      console.error('Stytch sendPasswordResetEmail error constructor:', error?.constructor?.name);
      console.error('Stytch sendPasswordResetEmail error details:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      
      // Log Stytch-specific error properties
      if (error.status_code) {
        console.error('Stytch status_code:', error.status_code);
      }
      if (error.error_type) {
        console.error('Stytch error_type:', error.error_type);
      }
      if (error.error_message) {
        console.error('Stytch error_message:', error.error_message);
      }
      
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
      console.error('Stytch resetPassword error:', error);
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

      console.log('=== Sending magic link to Stytch ===');
      console.log('Email:', params.email);
      console.log('Redirect URL (used for both login and signup):', redirectUrl);
      console.log('Full params:', JSON.stringify(params, null, 2));
      
      const response = await client.magicLinks.email.loginOrCreate(params);
      console.log('Stytch magic link response:', { emailId: response.email_id, statusCode: response.status_code });
      
      return {
        emailId: response.email_id,
        statusCode: response.status_code,
      };
    } catch (error) {
      console.error('=== Stytch sendMagicLink Error ===');
      console.error('Error type:', typeof error);
      console.error('Error constructor:', error?.constructor?.name);
      console.error('Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
      
      // Log Stytch-specific error properties
      if (error.status_code) {
        console.error('Status code:', error.status_code);
      }
      if (error.error_type) {
        console.error('Error type:', error.error_type);
      }
      if (error.error_message) {
        console.error('Error message:', error.error_message);
      }
      
      console.error('=== URL Sent to Stytch ===');
      console.error('Redirect URL:', redirectUrl);
      console.error('');
      console.error('=== Expected in Dashboard ===');
      console.error('This URL must be registered in Stytch dashboard:');
      console.error('  ', redirectUrl);
      console.error('');
      console.error('Note: The URL should be registered for BOTH Login and Signup in the dashboard.');
      console.error('');
      
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
      console.error('Stytch authenticateMagicLink error:', error);
      throw new Error(`Failed to authenticate magic link: ${error.message}`);
    }
  }
}

module.exports = StytchService;

