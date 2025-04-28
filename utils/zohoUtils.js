const axios = require('axios');

// Zoho authentication token management
let authToken = null;
let tokenExpiry = null;

/**
 * Get a valid Zoho Books API authentication token
 * @returns {Promise<string>} The authentication token
 */
const getZohoAuthToken = async () => {
  // Check if we have a valid token
  if (authToken && tokenExpiry && new Date() < tokenExpiry) {
    return authToken;
  }
 

  try {
    // Request a new token
    const response = await axios.post('https://accounts.zoho.in/oauth/v2/token', null, {
      params: {
        refresh_token: process.env.ZOHO_REFRESH_TOKEN,
        client_id: process.env.ZOHO_CLIENT_ID,
        client_secret: process.env.ZOHO_CLIENT_SECRET,
        grant_type: 'refresh_token'
      }
    });
    // Set the token and its expiry
    authToken = response.data.access_token;
    // Token typically expires in 3600 seconds (1 hour)
    tokenExpiry = new Date(Date.now() + (response.data.expires_in * 1000));
    return authToken;
  } catch (error) {
    console.error('Error getting Zoho auth token:', error.response?.data || error.message);
    throw new Error('Failed to authenticate with Zoho');
  }
};

/**
 * Call the Zoho Books API
 * @param {string} method - HTTP method (GET, POST, PUT, DELETE)
 * @param {string} endpoint - API endpoint
 * @param {Object} data - Request data (for POST/PUT)
 * @returns {Promise<Object>} API response
 */
const callZohoAPI = async (method, endpoint, data = null) => {
  try {
    const token = await getZohoAuthToken();
    const organizationId = process.env.ZOHO_ORGANIZATION_ID;
    // Try with the zohoapis.in domain first (India data center)
    const url = `https://www.zohoapis.in/books/v3${endpoint}`;
    console.log(`Making ${method} request to: ${url}`);
    if (data) {
      console.log('Request data:', JSON.stringify(data, null, 2));
    }
    
    const response = await axios({
      method,
      url,
      data,
      headers: {
        'Authorization': `Zoho-oauthtoken ${token}`,
        'Content-Type': 'application/json'
      },
      params: {
        organization_id: organizationId
      }
    });
    
    return response.data;
  } catch (error) {
    console.error('Zoho API error details:', {
      status: error.response?.status,
      statusText: error.response?.statusText,
      data: error.response?.data,
      message: error.message
    });
    throw new Error(`Zoho API error: ${error.response?.data?.message || error.message}`);
  }
};

/**
 * Create a vendor in Zoho Books
 * @param {Object} user - User object from MongoDB
 * @returns {Promise<string>} The Zoho vendor ID
 */
const createZohoVendor = async (user) => {
  try {
    // Prepare vendor data
    const vendorData = {
      contact_name: user.name,
      company_name: `${user.name} - Interviewer`,
      contact_type: "vendor",
      email: user.email,
      phone: user.phone || '',
      contact_persons: [
        {
          first_name: user.name.split(' ')[0],
          last_name: user.name.split(' ').slice(1).join(' ') || '',
          email: user.email,
          phone: user.phone || ''
        }
      ],
      notes: "Created automatically when promoted to interviewer role"
    };
    
    // Call Zoho Books API to create vendor
    const response = await callZohoAPI('POST', '/contacts', vendorData);
    
    if (!response.contact || !response.contact.contact_id) {
      throw new Error('Failed to create vendor in Zoho Books');
    }
    
    return response.contact.contact_id;
  } catch (error) {
    console.error('Error creating Zoho vendor:', error);
    throw error;
  }
};



module.exports = {
  getZohoAuthToken,
  callZohoAPI,
  createZohoVendor
};
