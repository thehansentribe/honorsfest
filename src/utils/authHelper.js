const crypto = require('crypto');

function determineAuthMethod(email) {
  const emailDomain = email.split('@')[1];
  
  // Force local auth for specific domains in development
  if (process.env.NODE_ENV === 'development' && 
      (emailDomain.includes('localhost') || emailDomain.includes('test.') || emailDomain.includes('example.'))) {
    return 'local';
  }

  // Environment variable overrides
  if (process.env.FORCE_LOCAL_AUTH === 'true') {
    return 'local';
  }
  if (process.env.FORCE_STYTCH_AUTH === 'true') {
    return 'stytch';
  }

  // Default to Stytch for production-like emails
  return 'stytch';
}

function generateDefaultPassword() {
  // Generate a strong random password for Stytch users
  return crypto.randomBytes(16).toString('hex');
}

module.exports = {
  determineAuthMethod,
  generateDefaultPassword
};

