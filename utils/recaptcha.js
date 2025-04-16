const axios = require('axios');

/**
 * Verify a reCAPTCHA token with Google's API
 * @param {string} token - The reCAPTCHA token from the client
 * @returns {Promise<Object>} - The verification result
 */
const verifyRecaptcha = async (token) => {
  try {
    const secretKey = process.env.RECAPTCHA_SECRET_KEY;
    
    if (!secretKey) {
      console.error('RECAPTCHA_SECRET_KEY is not set in environment variables');
      return { success: false, error: 'reCAPTCHA configuration error' };
    }
    
    const response = await axios.post(
      'https://www.google.com/recaptcha/api/siteverify',
      null,
      {
        params: {
          secret: secretKey,
          response: token
        }
      }
    );
    
    return response.data;
  } catch (error) {
    console.error('reCAPTCHA verification error:', error);
    return { success: false, error: 'reCAPTCHA verification failed' };
  }
};

module.exports = { verifyRecaptcha };
