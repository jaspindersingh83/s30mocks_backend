// Helper function to ensure admin is CC'd on payment verification confirmation emails
const { sendPaymentVerificationConfirmation } = require('./email');

/**
 * Send payment verification confirmation to candidate with admin CC'd
 * This is a wrapper around the original sendPaymentVerificationConfirmation function
 * that ensures the admin is properly CC'd
 * 
 * @param {Object} interview - The interview object
 * @param {Object} payment - The payment object
 * @param {Object} candidate - The candidate user object
 * @param {Object} interviewer - The interviewer user object
 * @param {String} adminEmail - Admin email address
 * @returns {Promise} - Promise that resolves to the SES response
 */
const sendPaymentVerificationConfirmationWithAdminCC = async (
  interview,
  payment,
  candidate,
  interviewer,
  adminEmail
) => {
  // Convert adminEmail to array to ensure proper CC
  const ccList = adminEmail ? [adminEmail] : [];
  
  // Call the original function with the CC list
  return await sendPaymentVerificationConfirmation(
    interview,
    payment,
    candidate,
    interviewer,
    ccList
  );
};

module.exports = {
  sendPaymentVerificationConfirmationWithAdminCC
};
