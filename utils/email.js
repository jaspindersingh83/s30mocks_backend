const AWS = require('aws-sdk');
require('dotenv').config();

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'us-east-1'
});

// Create SES service object
const ses = new AWS.SES();

/**
 * Send an email using AWS SES
 * @param {String} to - Recipient email address
 * @param {String} subject - Email subject
 * @param {String} htmlBody - HTML content of the email
 * @param {String} textBody - Plain text content of the email
 * @returns {Promise} - Promise that resolves to the SES response
 */
const sendEmail = async (to, subject, htmlBody, textBody, cc = []) => {
  // Skip sending emails if AWS credentials are not configured
  if (!process.env.AWS_ACCESS_KEY_ID || !process.env.AWS_SECRET_ACCESS_KEY) {
    console.log('AWS credentials not configured. Email would have been sent to:', Array.isArray(to) ? to : [to]);
    console.log('Email subject:', subject);
    return { 
      messageId: 'mock-message-id',
      message: 'Email sending skipped - AWS credentials not configured'
    };
  }
  
  // In development or if DISABLE_EMAILS is set, log instead of sending
  if (process.env.NODE_ENV !== 'production' || process.env.DISABLE_EMAILS === 'true') {
    console.log('Email sending disabled in development. Would have sent to:', Array.isArray(to) ? to : [to]);
    console.log('Email subject:', subject);
    console.log('Email content:', textBody);
    return { 
      messageId: 'mock-message-id',
      message: 'Email sending skipped - in development mode'
    };
  }

  // Use a verified sender email address
  const verifiedSender = process.env.VERIFIED_EMAIL_SENDER || 'jaspinder@thes30.com';
  
  const params = {
    Source: verifiedSender,
    Destination: {
      ToAddresses: Array.isArray(to) ? to : [to],
      CcAddresses: Array.isArray(cc) && cc.length > 0 ? cc : []
    },
    Message: {
      Subject: {
        Data: subject
      },
      Body: {
        Html: {
          Data: htmlBody
        },
        Text: {
          Data: textBody
        }
      }
    }
  };

  try {
    const result = await ses.sendEmail(params).promise();
    console.log('Email sent successfully:', result.MessageId);
    return result;
  } catch (error) {
    // Handle specific AWS SES errors
    if (error.code === 'MessageRejected' && error.message.includes('not verified')) {
      console.error('Email address verification error:', error.message);
      // Log instructions for verifying email in AWS SES
      console.log('To fix this issue, verify the email addresses in AWS SES console for the AP-SOUTH-1 region');
      
      // Use environment variable for admin email fallback
      const adminEmail = process.env.ADMIN_EMAIL || 'admin@example.com';
      
      // If we're in production, attempt to send to admin only
      if (process.env.NODE_ENV === 'production') {
        try {
          // Create a new params object with only verified admin email
          const fallbackParams = {
            ...params,
            Destination: {
              ToAddresses: [adminEmail],
              CcAddresses: []
            },
            Message: {
              ...params.Message,
              Subject: {
                Data: `[UNDELIVERED] ${subject}`
              },
              Body: {
                ...params.Message.Body,
                Text: {
                  Data: `Original recipients: ${JSON.stringify(params.Destination.ToAddresses)}\n\n${textBody}`
                }
              }
            }
          };
          
          // Try to send to admin only
          await ses.sendEmail(fallbackParams).promise();
          console.log('Fallback email sent to admin');
        } catch (fallbackError) {
          console.error('Failed to send fallback email to admin:', fallbackError);
        }
      }
    }
    
    console.error('Error sending email:', error);
    // Return a mock response instead of throwing to prevent application failures
    return { 
      messageId: 'error-message-id',
      message: 'Email sending failed but application continues',
      error: error.message
    };
  }
};

/**
 * Send feedback notification email to candidate and admin
 * @param {Object} feedback - The feedback object
 * @param {Object} interview - The interview object
 * @param {Object} candidate - The candidate user object
 * @param {Object} interviewer - The interviewer user object
 * @param {String} adminEmail - Admin email address
 */
const sendFeedbackNotification = async (feedback, interview, candidate, interviewer, adminEmail) => {
  const candidateSubject = 'Feedback Received for Your Interview';
  const adminSubject = `New Feedback Submitted - ${candidate.name}'s Interview`;

  const candidateHtmlBody = `
    <h2>Feedback Received</h2>
    <p>Hello ${candidate.name},</p>
    <p>Your interviewer, ${interviewer.name}, has submitted feedback for your interview on ${new Date(interview.scheduledDate).toLocaleString()}.</p>
    <p>You can now log in to view your feedback and complete the payment process.</p>
    <p>Thank you for using S30 Mocks!</p>
  `;

  const adminHtmlBody = `
    <h2>New Feedback Submitted</h2>
    <p>Hello Admin,</p>
    <p>${interviewer.name} has submitted feedback for ${candidate.name}'s interview.</p>
    <p>Interview Details:</p>
    <ul>
      <li>Interview Type: ${interview.interviewType}</li>
      <li>Date: ${new Date(interview.scheduledDate).toLocaleString()}</li>
      <li>Technical Score: ${feedback.technicalScore}/5</li>
      <li>Communication Score: ${feedback.communicationScore}/5</li>
      <li>Problem Solving Score: ${feedback.problemSolvingScore}/5</li>
    </ul>
    <p>Please log in to the admin dashboard for more details.</p>
  `;

  const candidateTextBody = `
    Feedback Received
    
    Hello ${candidate.name},
    
    Your interviewer, ${interviewer.name}, has submitted feedback for your interview on ${new Date(interview.scheduledDate).toLocaleString()}.
    
    You can now log in to view your feedback and complete the payment process.
    
    Thank you for using S30 Mocks!
  `;

  const adminTextBody = `
    New Feedback Submitted
    
    Hello Admin,
    
    ${interviewer.name} has submitted feedback for ${candidate.name}'s interview.
    
    Interview Details:
    - Interview Type: ${interview.interviewType}
    - Date: ${new Date(interview.scheduledDate).toLocaleString()}
    - Technical Score: ${feedback.technicalScore}/5
    - Communication Score: ${feedback.communicationScore}/5
    - Problem Solving Score: ${feedback.problemSolvingScore}/5
    
    Please log in to the admin dashboard for more details.
  `;

  // Send emails
  await Promise.all([
    sendEmail(candidate.email, candidateSubject, candidateHtmlBody, candidateTextBody),
    sendEmail(adminEmail, adminSubject, adminHtmlBody, adminTextBody)
  ]);
};

/**
 * Send interview reminder emails to all parties
 * @param {Object} interview - The interview object
 * @param {Object} candidate - The candidate user object
 * @param {Object} interviewer - The interviewer user object
 * @param {String} adminEmail - Admin email address
 */
const sendInterviewReminder = async (interview, candidate, interviewer, adminEmail) => {
  const subject = `Reminder: Interview in 30 Minutes`;
  
  const candidateHtmlBody = `
    <h2>Interview Reminder</h2>
    <p>Hello ${candidate.name},</p>
    <p>This is a reminder that your interview with ${interviewer.name} is scheduled to begin in 30 minutes.</p>
    <p>Interview Details:</p>
    <ul>
      <li>Type: ${interview.interviewType}</li>
      <li>Time: ${new Date(interview.scheduledDate).toLocaleString()}</li>
      <li>Duration: ${interview.duration} minutes</li>
      ${interview.meetingLink ? `<li>Meeting Link: <a href="${interview.meetingLink}">${interview.meetingLink}</a></li>` : ''}
      ${interview.meetingPassword ? `<li>Meeting Password: ${interview.meetingPassword}</li>` : ''}
    </ul>
    <p>Please be ready on time and ensure your internet connection and equipment are working properly.</p>
    <p>Good luck!</p>
  `;

  const interviewerHtmlBody = `
    <h2>Interview Reminder</h2>
    <p>Hello ${interviewer.name},</p>
    <p>This is a reminder that you have an interview with ${candidate.name} scheduled to begin in 30 minutes.</p>
    <p>Interview Details:</p>
    <ul>
      <li>Type: ${interview.interviewType}</li>
      <li>Time: ${new Date(interview.scheduledDate).toLocaleString()}</li>
      <li>Duration: ${interview.duration} minutes</li>
      ${interview.meetingLink ? `<li>Meeting Link: <a href="${interview.meetingLink}">${interview.meetingLink}</a></li>` : ''}
      ${interview.meetingPassword ? `<li>Meeting Password: ${interview.meetingPassword}</li>` : ''}
    </ul>
    <p>Please be ready on time and ensure your internet connection and equipment are working properly.</p>
  `;

  const adminHtmlBody = `
    <h2>Interview Reminder</h2>
    <p>Hello Admin,</p>
    <p>This is a reminder that an interview is scheduled to begin in 30 minutes.</p>
    <p>Interview Details:</p>
    <ul>
      <li>Candidate: ${candidate.name} (${candidate.email})</li>
      <li>Interviewer: ${interviewer.name} (${interviewer.email})</li>
      <li>Type: ${interview.interviewType}</li>
      <li>Time: ${new Date(interview.scheduledDate).toLocaleString()}</li>
      <li>Duration: ${interview.duration} minutes</li>
    </ul>
  `;

  const candidateTextBody = `
    Interview Reminder
    
    Hello ${candidate.name},
    
    This is a reminder that your interview with ${interviewer.name} is scheduled to begin in 30 minutes.
    
    Interview Details:
    - Type: ${interview.interviewType}
    - Time: ${new Date(interview.scheduledDate).toLocaleString()}
    - Duration: ${interview.duration} minutes
    ${interview.meetingLink ? `- Meeting Link: ${interview.meetingLink}` : ''}
    ${interview.meetingPassword ? `- Meeting Password: ${interview.meetingPassword}` : ''}
    
    Please be ready on time and ensure your internet connection and equipment are working properly.
    
    Good luck!
  `;

  const interviewerTextBody = `
    Interview Reminder
    
    Hello ${interviewer.name},
    
    This is a reminder that you have an interview with ${candidate.name} scheduled to begin in 30 minutes.
    
    Interview Details:
    - Type: ${interview.interviewType}
    - Time: ${new Date(interview.scheduledDate).toLocaleString()}
    - Duration: ${interview.duration} minutes
    ${interview.meetingLink ? `- Meeting Link: ${interview.meetingLink}` : ''}
    ${interview.meetingPassword ? `- Meeting Password: ${interview.meetingPassword}` : ''}
    
    Please be ready on time and ensure your internet connection and equipment are working properly.
  `;

  const adminTextBody = `
    Interview Reminder
    
    Hello Admin,
    
    This is a reminder that an interview is scheduled to begin in 30 minutes.
    
    Interview Details:
    - Candidate: ${candidate.name} (${candidate.email})
    - Interviewer: ${interviewer.name} (${interviewer.email})
    - Type: ${interview.interviewType}
    - Time: ${new Date(interview.scheduledDate).toLocaleString()}
    - Duration: ${interview.duration} minutes
  `;

  // Send emails
  await Promise.all([
    sendEmail(candidate.email, subject, candidateHtmlBody, candidateTextBody),
    sendEmail(interviewer.email, subject, interviewerHtmlBody, interviewerTextBody),
    sendEmail(adminEmail, subject, adminHtmlBody, adminTextBody)
  ]);
};

/**
 * Send interview booking notification to interviewer
 * @param {Object} interview - The interview object
 * @param {Object} candidate - The candidate user object
 * @param {Object} interviewer - The interviewer user object
 * @returns {Promise} - Promise that resolves to the SES response
 */
const sendInterviewBookingNotification = async (interview, candidate, interviewer, adminEmail) => {
  const subject = 'New Interview Booking Notification';
  
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4a6ee0;">New Interview Booking</h2>
      <p>Hello ${interviewer.name},</p>
      <p>A new interview has been booked with you. Here are the details:</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Candidate:</strong> ${candidate.name}</p>
        <p><strong>Email:</strong> ${candidate.email}</p>
        <p><strong>Date & Time:</strong> ${new Date(interview.scheduledDate).toLocaleString()}</p>
        <p><strong>Duration:</strong> ${interview.duration} minutes</p>
        <p><strong>Meeting Link:</strong> ${interview.meetingLink || 'To be provided'}</p>
      </div>
      <p>Please log in to your account to view more details and prepare for the interview.</p>
      <p>Thank you for being a part of our platform!</p>
      <p>Best regards,<br>S30 Mocks Team</p>
    </div>
  `;
  
  const textBody = `
    New Interview Booking
    
    Hello ${interviewer.name},
    
    A new interview has been booked with you. Here are the details:
    
    Candidate: ${candidate.name}
    Email: ${candidate.email}
    Date & Time: ${new Date(interview.scheduledDate).toLocaleString()}
    Duration: ${interview.duration} minutes
    Meeting Link: ${interview.meetingLink || 'To be provided'}
    
    Please log in to your account to view more details and prepare for the interview.
    
    Thank you for being a part of our platform!
    
    Best regards,
    S30 Mocks Team
  `;
  
  return await sendEmail(interviewer.email, subject, htmlBody, textBody, adminEmail);
};

/**
 * Send interview cancellation notification to interviewer
 * @param {Object} interview - The interview object
 * @param {Object} candidate - The candidate user object
 * @param {Object} interviewer - The interviewer user object
 * @returns {Promise} - Promise that resolves to the SES response
 */
const sendInterviewCancellationNotification = async (interview, candidate, interviewer, adminEmail) => {
  const subject = 'Interview Cancellation Notification';
  
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e74c3c;">Interview Cancelled</h2>
      <p>Hello ${interviewer.name},</p>
      <p>We regret to inform you that an interview has been cancelled by the candidate. Here are the details:</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Candidate:</strong> ${candidate.name}</p>
        <p><strong>Email:</strong> ${candidate.email}</p>
        <p><strong>Originally Scheduled:</strong> ${new Date(interview.scheduledDate).toLocaleString()}</p>
        <p><strong>Duration:</strong> ${interview.duration} minutes</p>
      </div>
      <p>Your time slot is now available for other bookings.</p>
      <p>Thank you for your understanding.</p>
      <p>Best regards,<br>S30 Mocks Team</p>
    </div>
  `;
  
  const textBody = `
    Interview Cancelled
    
    Hello ${interviewer.name},
    
    We regret to inform you that an interview has been cancelled by the candidate. Here are the details:
    
    Candidate: ${candidate.name}
    Email: ${candidate.email}
    Originally Scheduled: ${new Date(interview.scheduledDate).toLocaleString()}
    Duration: ${interview.duration} minutes
    
    Your time slot is now available for other bookings.
    
    Thank you for your understanding.
    
    Best regards,
    S30 Mocks Team
  `;
  
  return await sendEmail(interviewer.email, subject, htmlBody, textBody, adminEmail);
};

/**
 * Send payment verification notification to interviewer
 * @param {Object} interview - The interview object
 * @param {Object} payment - The payment object
 * @param {Object} candidate - The candidate user object
 * @param {Object} interviewer - The interviewer user object
 * @returns {Promise} - Promise that resolves to the SES response
 */
const sendPaymentVerificationNotification = async (interview, payment, candidate, interviewer, adminEmail) => {
  const subject = 'Payment Verification Required';
  
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f39c12;">Payment Verification Required</h2>
      <p>Hello ${interviewer.name},</p>
      <p>A candidate has submitted payment for an upcoming interview with you. Please verify this payment:</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Candidate:</strong> ${candidate.name}</p>
        <p><strong>Email:</strong> ${candidate.email}</p>
        <p><strong>Interview Date:</strong> ${new Date(interview.scheduledDate).toLocaleString()}</p>
        <p><strong>Amount:</strong> ${payment.currency} ${payment.amount}</p>
        <p><strong>Transaction ID:</strong> ${payment.transactionId || 'Not provided'}</p>
      </div>
      <p>Please log in to your account to verify this payment. The candidate has uploaded proof of payment which you can review on the platform.</p>
      <p>Thank you for your prompt attention to this matter.</p>
      <p>Best regards,<br>S30 Mocks Team</p>
    </div>
  `;
  
  const textBody = `
    Payment Verification Required
    
    Hello ${interviewer.name},
    
    A candidate has submitted payment for an upcoming interview with you. Please verify this payment:
    
    Candidate: ${candidate.name}
    Email: ${candidate.email}
    Interview Date: ${new Date(interview.scheduledDate).toLocaleString()}
    Amount: ${payment.currency} ${payment.amount}
    Transaction ID: ${payment.transactionId || 'Not provided'}
    
    Please log in to your account to verify this payment. The candidate has uploaded proof of payment which you can review on the platform.
    
    Thank you for your prompt attention to this matter.
    
    Best regards,
    S30 Mocks Team
  `;
  
  return await sendEmail(interviewer.email, subject, htmlBody, textBody, adminEmail);
};

/**
 * Send interview booking confirmation to candidate
 * @param {Object} interview - The interview object
 * @param {Object} candidate - The candidate user object
 * @param {Object} interviewer - The interviewer user object
 * @param {String} adminEmail - Admin email address
 * @returns {Promise} - Promise that resolves to the SES response
 */
const sendInterviewBookingConfirmation = async (interview, candidate, interviewer, adminEmail) => {
  const subject = 'Interview Booking Confirmation';
  
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4a6ee0;">Interview Booking Confirmation</h2>
      <p>Hello ${candidate.name},</p>
      <p>Your interview has been successfully booked. Here are the details:</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Interviewer:</strong> ${interviewer.name}</p>
        <p><strong>Date & Time:</strong> ${new Date(interview.scheduledDate).toLocaleString()}</p>
        <p><strong>Duration:</strong> ${interview.duration} minutes</p>
        <p><strong>Meeting Link:</strong> ${interview.meetingLink || 'Will be provided by the interviewer'}</p>
      </div>
      <p>Please make sure to complete the payment to confirm your interview slot. You can do this from your dashboard.</p>
      <p>We wish you all the best for your interview!</p>
      <p>Best regards,<br>S30 Mocks Team</p>
    </div>
  `;
  
  const textBody = `
    Interview Booking Confirmation
    
    Hello ${candidate.name},
    
    Your interview has been successfully booked. Here are the details:
    
    Interviewer: ${interviewer.name}
    Date & Time: ${new Date(interview.scheduledDate).toLocaleString()}
    Duration: ${interview.duration} minutes
    Meeting Link: ${interview.meetingLink || 'Will be provided by the interviewer'}
    
    Please make sure to complete the payment to confirm your interview slot. You can do this from your dashboard.
    
    We wish you all the best for your interview!
    
    Best regards,
    S30 Mocks Team
  `;
  
  return await sendEmail(candidate.email, subject, htmlBody, textBody, adminEmail);
};

/**
 * Send interview cancellation confirmation to candidate
 * @param {Object} interview - The interview object
 * @param {Object} candidate - The candidate user object
 * @param {Object} interviewer - The interviewer user object
 * @param {String} adminEmail - Admin email address
 * @returns {Promise} - Promise that resolves to the SES response
 */
const sendInterviewCancellationConfirmation = async (interview, candidate, interviewer, adminEmail) => {
  const subject = 'Interview Cancellation Confirmation';
  
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e74c3c;">Interview Cancellation Confirmation</h2>
      <p>Hello ${candidate.name},</p>
      <p>Your interview has been successfully cancelled. Here are the details of the cancelled interview:</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Interviewer:</strong> ${interviewer.name}</p>
        <p><strong>Originally Scheduled:</strong> ${new Date(interview.scheduledDate).toLocaleString()}</p>
        <p><strong>Duration:</strong> ${interview.duration} minutes</p>
      </div>
      <p>If you've already made a payment for this interview, please contact us regarding the refund process.</p>
      <p>We hope to see you book another interview soon!</p>
      <p>Best regards,<br>S30 Mocks Team</p>
    </div>
  `;
  
  const textBody = `
    Interview Cancellation Confirmation
    
    Hello ${candidate.name},
    
    Your interview has been successfully cancelled. Here are the details of the cancelled interview:
    
    Interviewer: ${interviewer.name}
    Originally Scheduled: ${new Date(interview.scheduledDate).toLocaleString()}
    Duration: ${interview.duration} minutes
    
    If you've already made a payment for this interview, please contact us regarding the refund process.
    
    We hope to see you book another interview soon!
    
    Best regards,
    S30 Mocks Team
  `;
  
  return await sendEmail(candidate.email, subject, htmlBody, textBody, adminEmail);
};

/**
 * Send payment verification confirmation to candidate
 * @param {Object} interview - The interview object
 * @param {Object} payment - The payment object
 * @param {Object} candidate - The candidate user object
 * @param {Object} interviewer - The interviewer user object
 * @param {String} adminEmail - Admin email address
 * @returns {Promise} - Promise that resolves to the SES response
 */
const sendPaymentVerificationConfirmation = async (interview, payment, candidate, interviewer, adminEmail) => {
  const subject = 'Payment Verification Confirmation';
  
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #27ae60;">Payment Verified Successfully</h2>
      <p>Hello ${candidate.name},</p>
      <p>Your payment for the upcoming interview has been verified successfully. Your interview is now confirmed!</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Interviewer:</strong> ${interviewer.name}</p>
        <p><strong>Interview Date:</strong> ${new Date(interview.scheduledDate).toLocaleString()}</p>
        <p><strong>Amount Paid:</strong> ${payment.currency} ${payment.amount}</p>
        <p><strong>Transaction ID:</strong> ${payment.transactionId || 'Not provided'}</p>
      </div>
      <p>Please make sure to join the interview on time using the meeting link provided in your dashboard.</p>
      <p>We wish you all the best for your interview!</p>
      <p>Best regards,<br>S30 Mocks Team</p>
    </div>
  `;
  
  const textBody = `
    Payment Verified Successfully
    
    Hello ${candidate.name},
    
    Your payment for the upcoming interview has been verified successfully. Your interview is now confirmed!
    
    Interviewer: ${interviewer.name}
    Interview Date: ${new Date(interview.scheduledDate).toLocaleString()}
    Amount Paid: ${payment.currency} ${payment.amount}
    Transaction ID: ${payment.transactionId || 'Not provided'}
    
    Please make sure to join the interview on time using the meeting link provided in your dashboard.
    
    We wish you all the best for your interview!
    
    Best regards,
    S30 Mocks Team
  `;
  
  return await sendEmail(candidate.email, subject, htmlBody, textBody, adminEmail);
};

module.exports = {
  sendEmail,
  sendFeedbackNotification,
  sendInterviewReminder,
  sendInterviewBookingNotification,
  sendInterviewCancellationNotification,
  sendPaymentVerificationNotification,
  sendInterviewBookingConfirmation,
  sendInterviewCancellationConfirmation,
  sendPaymentVerificationConfirmation
};
