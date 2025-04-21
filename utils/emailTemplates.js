/**
 * Email templates with consistent timezone formatting
 */
const { DateTime } = require("luxon");

/**
 * Format date with timezone information
 * @param {String|Date} dateString - The date to format
 * @param {String} timezone - The timezone to use (defaults to system timezone)
 * @returns {String} - Formatted date string with timezone
 */
const formatDateWithTimezone = (dateString, timezone) => {
  // Always use Asia/Kolkata (IST) timezone for consistency
  // This ensures all emails show the correct IST time regardless of server timezone
  const tz = 'Asia/Kolkata';
  
  return DateTime.fromISO(new Date(dateString).toISOString())
    .setZone(tz)
    .toFormat("EEEE, MMMM d, yyyy 'at' h:mm a (z)");
};

/**
 * Generate interview booking confirmation email template
 */
const getInterviewBookingConfirmationTemplate = (interview, candidate, interviewer) => {
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4a6ee0;">Interview Booking Confirmation</h2>
      <p>Hello ${candidate.name},</p>
      <p>Your interview has been successfully booked. Here are the details:</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Interviewer:</strong> ${interviewer.name}</p>
        <p><strong>Interview Date:</strong> ${formatDateWithTimezone(interview.scheduledDate, interview.timeZone)}</p>
        <p><strong>Duration:</strong> ${interview.duration} minutes</p>
        <p><strong>Meeting Link:</strong> ${interview.meetingLink || "Will be provided by the interviewer"}</p>
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
    Date: ${formatDateWithTimezone(interview.scheduledDate, interview.timeZone)}
    Interview Date: ${DateTime.fromISO(new Date(interview.scheduledDate).toISOString()).toFormat("MMMM d, yyyy")}
    Duration: ${interview.duration} minutes
    Meeting Link: ${interview.meetingLink || "Will be provided by the interviewer"}
    
    Please make sure to complete the payment to confirm your interview slot. You can do this from your dashboard.
    
    We wish you all the best for your interview!
    
    Best regards,
    S30 Mocks Team
  `;

  return { htmlBody, textBody };
};

/**
 * Generate interview booking notification email template
 */
const getInterviewBookingNotificationTemplate = (interview, candidate, interviewer) => {
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4a6ee0;">New Interview Booking Notification</h2>
      <p>Hello ${interviewer.name},</p>
      <p>A new interview has been booked with you. Here are the details:</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Candidate:</strong> ${candidate.name}</p>
        <p><strong>Email:</strong> ${candidate.email}</p>
        <p><strong>Interview Date:</strong> ${formatDateWithTimezone(interview.scheduledDate, interview.timeZone)}</p>
        <p><strong>Duration:</strong> ${interview.duration} minutes</p>
        <p><strong>Meeting Link:</strong> ${interview.meetingLink || "To be provided"}</p>
      </div>
      <p>Please log in to your account to view more details and prepare for the interview.</p>
      <p>Thank you for being a part of our platform!</p>
      <p>Best regards,<br>S30 Mocks Team</p>
    </div>
  `;

  const textBody = `
    New Interview Booking Notification
    
    Hello ${interviewer.name},
    
    A new interview has been booked with you. Here are the details:
    
    Candidate: ${candidate.name}
    Email: ${candidate.email}
    Date: ${formatDateWithTimezone(interview.scheduledDate, interview.timeZone)}
    Duration: ${interview.duration} minutes
    Meeting Link: ${interview.meetingLink || "To be provided"}
    
    Please log in to your account to view more details and prepare for the interview.
    
    Thank you for being a part of our platform!
    
    Best regards,
    S30 Mocks Team
  `;

  return { htmlBody, textBody };
};

/**
 * Generate interview cancellation confirmation email template
 */
const getInterviewCancellationConfirmationTemplate = (interview, candidate, interviewer) => {
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e74c3c;">Interview Cancellation Confirmation</h2>
      <p>Hello ${candidate.name},</p>
      <p>Your interview has been successfully cancelled. Here are the details of the cancelled interview:</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Interviewer:</strong> ${interviewer.name}</p>
        <p><strong>Duration:</strong> ${interview.duration} minutes</p>
      </div>
      <p>We hope to see you book another interview soon!</p>
      <p>Best regards,<br>S30 Mocks Team</p>
    </div>
  `;

  const textBody = `
    Interview Cancellation Confirmation
    
    Hello ${candidate.name},
    
    Your interview has been successfully cancelled. Here are the details of the cancelled interview:
    
    Interviewer: ${interviewer.name}
    Duration: ${interview.duration} minutes
    
    We hope to see you book another interview soon!
    
    Best regards,
    S30 Mocks Team
  `;

  return { htmlBody, textBody };
};

/**
 * Generate interview cancellation notification email template
 */
const getInterviewCancellationNotificationTemplate = (interview, candidate, interviewer) => {
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #e74c3c;">Interview Cancellation Notification</h2>
      <p>Hello ${interviewer.name},</p>
      <p>We regret to inform you that an interview has been cancelled by the candidate. Here are the details:</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Candidate:</strong> ${candidate.name}</p>
        <p><strong>Email:</strong> ${candidate.email}</p>
        <p><strong>Duration:</strong> ${interview.duration} minutes</p>
      </div>
      <p>Your time slot is now available for other bookings.</p>
      <p>Thank you for your understanding.</p>
      <p>Best regards,<br>S30 Mocks Team</p>
    </div>
  `;

  const textBody = `
    Interview Cancellation Notification
    
    Hello ${interviewer.name},
    
    We regret to inform you that an interview has been cancelled by the candidate. Here are the details:
    
    Candidate: ${candidate.name}
    Email: ${candidate.email}
    Duration: ${interview.duration} minutes
    
    Your time slot is now available for other bookings.
    
    Thank you for your understanding.
    
    Best regards,
    S30 Mocks Team
  `;

  return { htmlBody, textBody };
};

/**
 * Generate interview reminder email templates
 */
const getInterviewReminderTemplates = (interview, candidate, interviewer) => {
  const candidateHtmlBody = `
    <h2>Interview Reminder</h2>
    <p>Hello ${candidate.name},</p>
    <p>This is a reminder that your interview with ${
      interviewer.name
    } is scheduled to begin in 30 minutes.</p>
    <p>Please ensure you are prepared and ready to join the meeting on time.</p>
    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p><strong>Interview Details:</strong></p>
      <p><strong>Interviewer:</strong> ${interviewer.name}</p>
      <p><strong>Type:</strong> ${interview.interviewType}</p>
      <p><strong>Time:</strong> ${formatDateWithTimezone(interview.scheduledDate, interview.timeZone)}</p>
      <p><strong>Duration:</strong> ${interview.duration} minutes</p>
      <p><strong>Meeting Link:</strong> ${
        interview.meetingLink || "Check your dashboard for the meeting link"
      }</p>
    </div>
    <p>Good luck with your interview!</p>
    <p>Best regards,<br>S30 Mocks Team</p>
  `;

  const candidateTextBody = `
    Interview Reminder
    
    Hello ${candidate.name},
    
    This is a reminder that your interview with ${interviewer.name} is scheduled to begin in 30 minutes.
    
    Please ensure you are prepared and ready to join the meeting on time.
    
    Interview Details:
    - Interviewer: ${interviewer.name}
    - Type: ${interview.interviewType}
    - Time: ${formatDateWithTimezone(interview.scheduledDate, interview.timeZone)}
    - Duration: ${interview.duration} minutes
    - Meeting Link: ${interview.meetingLink || "Check your dashboard for the meeting link"}
    
    Good luck with your interview!
    
    Best regards,
    S30 Mocks Team
  `;

  const interviewerHtmlBody = `
    <h2>Interview Reminder</h2>
    <p>Hello ${interviewer.name},</p>
    <p>This is a reminder that you have an interview scheduled to begin in 30 minutes.</p>
    <p>Please ensure you are prepared and ready to conduct the interview on time.</p>
    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p><strong>Interview Details:</strong></p>
      <p><strong>Candidate:</strong> ${candidate.name} (${candidate.email})</p>
      <p><strong>Type:</strong> ${interview.interviewType}</p>
      <p><strong>Time:</strong> ${formatDateWithTimezone(interview.scheduledDate, interview.timeZone)}</p>
      <p><strong>Duration:</strong> ${interview.duration} minutes</p>
      <p><strong>Meeting Link:</strong> ${
        interview.meetingLink || "Please provide a meeting link to the candidate"
      }</p>
    </div>
    <p>Thank you for your contribution to our platform!</p>
    <p>Best regards,<br>S30 Mocks Team</p>
  `;

  const interviewerTextBody = `
    Interview Reminder
    
    Hello ${interviewer.name},
    
    This is a reminder that you have an interview scheduled to begin in 30 minutes.
    
    Please ensure you are prepared and ready to conduct the interview on time.
    
    Interview Details:
    - Candidate: ${candidate.name} (${candidate.email})
    - Type: ${interview.interviewType}
    - Time: ${formatDateWithTimezone(interview.scheduledDate, interview.timeZone)}
    - Duration: ${interview.duration} minutes
    - Meeting Link: ${interview.meetingLink || "Please provide a meeting link to the candidate"}
    
    Thank you for your contribution to our platform!
    
    Best regards,
    S30 Mocks Team
  `;

  const adminHtmlBody = `
    <h2>Interview Reminder - Admin Notification</h2>
    <p>Hello Admin,</p>
    <p>This is a notification that an interview is scheduled to begin in 30 minutes.</p>
    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p><strong>Interview Details:</strong></p>
      <p><strong>Candidate:</strong> ${candidate.name} (${candidate.email})</p>
      <p><strong>Interviewer:</strong> ${interviewer.name} (${interviewer.email})</p>
      <p><strong>Type:</strong> ${interview.interviewType}</p>
      <p><strong>Time:</strong> ${formatDateWithTimezone(interview.scheduledDate, interview.timeZone)}</p>
      <p><strong>Duration:</strong> ${interview.duration} minutes</p>
    </div>
    <p>This is an automated notification for monitoring purposes.</p>
    <p>Best regards,<br>S30 Mocks System</p>
  `;

  const adminTextBody = `
    Interview Reminder - Admin Notification
    
    Hello Admin,
    
    This is a notification that an interview is scheduled to begin in 30 minutes.
    
    Interview Details:
    - Candidate: ${candidate.name} (${candidate.email})
    - Interviewer: ${interviewer.name} (${interviewer.email})
    - Type: ${interview.interviewType}
    - Time: ${formatDateWithTimezone(interview.scheduledDate, interview.timeZone)}
    - Duration: ${interview.duration} minutes
    
    This is an automated notification for monitoring purposes.
    
    Best regards,
    S30 Mocks System
  `;

  return {
    candidateHtmlBody,
    candidateTextBody,
    interviewerHtmlBody,
    interviewerTextBody,
    adminHtmlBody,
    adminTextBody
  };
};

/**
 * Generate payment verification notification email template
 */
const getPaymentVerificationNotificationTemplate = (interview, payment, candidate, interviewer) => {
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #f39c12;">Payment Verification Required</h2>
      <p>Hello ${interviewer.name},</p>
      <p>A candidate has submitted payment for an interview with you. Please verify the payment details:</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Candidate:</strong> ${candidate.name}</p>
        <p><strong>Email:</strong> ${candidate.email}</p>
        <p><strong>Interview Date:</strong> ${formatDateWithTimezone(interview.scheduledDate, interview.timeZone)}</p>
        <p><strong>Amount:</strong> ${payment.currency} ${payment.amount}</p>
        <p><strong>Transaction ID:</strong> ${payment.transactionId || "Not provided"}</p>
      </div>
      <p>Please log in to your account to verify this payment. The candidate has uploaded proof of payment which you can review on the platform.</p>
      <p>Thank you for your prompt attention to this matter.</p>
      <p>Best regards,<br>S30 Mocks Team</p>
    </div>
  `;

  const textBody = `
    Payment Verification Required
    
    Hello ${interviewer.name},
    
    A candidate has submitted payment for an interview with you. Please verify the payment details:
    
    Candidate: ${candidate.name}
    Email: ${candidate.email}
    Interview Date: ${formatDateWithTimezone(interview.scheduledDate, interview.timeZone)}
    Amount: ${payment.currency} ${payment.amount}
    Transaction ID: ${payment.transactionId || "Not provided"}
    
    Please log in to your account to verify this payment. The candidate has uploaded proof of payment which you can review on the platform.
    
    Thank you for your prompt attention to this matter.
    
    Best regards,
    S30 Mocks Team
  `;

  return { htmlBody, textBody };
};

/**
 * Generate payment verification confirmation email template
 */
const getPaymentVerificationConfirmationTemplate = (interview, payment, candidate, interviewer) => {
  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #27ae60;">Payment Verification Confirmation</h2>
      <p>Hello ${candidate.name},</p>
      <p>Your payment for the upcoming interview has been verified. Here are the details:</p>
      <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
        <p><strong>Interviewer:</strong> ${interviewer.name}</p>
        <p><strong>Interview Date:</strong> ${formatDateWithTimezone(interview.scheduledDate, interview.timeZone)}</p>
        <p><strong>Amount Paid:</strong> ${payment.currency} ${payment.amount}</p>
        <p><strong>Transaction ID:</strong> ${payment.transactionId || "Not provided"}</p>
      </div>
      <p>Please make sure to join the interview on time using the meeting link provided in your dashboard.</p>
      <p>We wish you all the best for your interview!</p>
      <p>Best regards,<br>S30 Mocks Team</p>
    </div>
  `;

  const textBody = `
    Payment Verification Confirmation
    
    Hello ${candidate.name},
    
    Your payment for the upcoming interview has been verified. Here are the details:
    
    Interviewer: ${interviewer.name}
    Interview Date: ${formatDateWithTimezone(interview.scheduledDate, interview.timeZone)}
    Amount Paid: ${payment.currency} ${payment.amount}
    Transaction ID: ${payment.transactionId || "Not provided"}
    
    Please make sure to join the interview on time using the meeting link provided in your dashboard.
    
    We wish you all the best for your interview!
    
    Best regards,
    S30 Mocks Team
  `;

  return { htmlBody, textBody };
};

/**
 * Generate feedback notification email templates
 */
const getFeedbackNotificationTemplates = (feedback, interview, candidate, interviewer) => {
  const candidateHtmlBody = `
    <h2>Feedback Received for Your Interview</h2>
    <p>Hello ${candidate.name},</p>
    <p>Your interviewer has provided feedback for your recent interview. Here's a summary:</p>
    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p><strong>Interview Type:</strong> ${interview.interviewType}</p>
      <p><strong>Date:</strong> ${formatDateWithTimezone(interview.scheduledDate, interview.timeZone)}</p>
      <p><strong>Technical Score:</strong> ${feedback.codingAndDebugging}/5</p>
      <p><strong>Communication Score:</strong> ${feedback.communicationScore}/5</p>
      <p><strong>Problem Solving Score:</strong> ${feedback.problemSolvingScore}/5</p>
    </div>
    <p>Please log in to your account to view the detailed feedback, including strengths and areas for improvement.</p>
    <p>We hope this feedback helps you in your interview preparation journey!</p>
    <p>Best regards,<br>S30 Mocks Team</p>
  `;

  const candidateTextBody = `
    Feedback Received for Your Interview
    
    Hello ${candidate.name},
    
    Your interviewer has provided feedback for your recent interview. Here's a summary:
    
    Interview Type: ${interview.interviewType}
    Date: ${formatDateWithTimezone(interview.scheduledDate, interview.timeZone)}
    Technical Score: ${feedback.codingAndDebugging}/5
    Communication Score: ${feedback.communicationScore}/5
    Problem Solving Score: ${feedback.problemSolvingScore}/5
    
    Please log in to your account to view the detailed feedback, including strengths and areas for improvement.
    
    We hope this feedback helps you in your interview preparation journey!
    
    Best regards,
    S30 Mocks Team
  `;

  const adminHtmlBody = `
    <h2>New Feedback Submitted - ${candidate.name}'s Interview</h2>
    <p>Hello Admin,</p>
    <p>A new feedback has been submitted by ${interviewer.name} for ${candidate.name}'s interview.</p>
    <div style="background-color: #f5f5f5; padding: 15px; border-radius: 5px; margin: 20px 0;">
      <p><strong>Interview Details:</strong></p>
      <p><strong>Interview Type:</strong> ${interview.interviewType}</p>
      <p><strong>Date:</strong> ${formatDateWithTimezone(interview.scheduledDate, interview.timeZone)}</p>
      <p><strong>Technical Score:</strong> ${feedback.codingAndDebugging}/5</p>
      <p><strong>Communication Score:</strong> ${feedback.communicationScore}/5</p>
      <p><strong>Problem Solving Score:</strong> ${feedback.problemSolvingScore}/5</p>
    </div>
    <p>Please log in to the admin dashboard for more details.</p>
    <p>Best regards,<br>S30 Mocks System</p>
  `;

  const adminTextBody = `
    New Feedback Submitted - ${candidate.name}'s Interview
    
    Hello Admin,
    
    A new feedback has been submitted by ${interviewer.name} for ${candidate.name}'s interview.
    
    Interview Details:
    - Interview Type: ${interview.interviewType}
    - Date: ${formatDateWithTimezone(interview.scheduledDate, interview.timeZone)}
    - Technical Score: ${feedback.codingAndDebugging}/5
    - Communication Score: ${feedback.communicationScore}/5
    - Problem Solving Score: ${feedback.problemSolvingScore}/5
    
    Please log in to the admin dashboard for more details.
    
    Best regards,
    S30 Mocks System
  `;

  return {
    candidateHtmlBody,
    candidateTextBody,
    adminHtmlBody,
    adminTextBody
  };
};

module.exports = {
  formatDateWithTimezone,
  getInterviewBookingConfirmationTemplate,
  getInterviewBookingNotificationTemplate,
  getInterviewCancellationConfirmationTemplate,
  getInterviewCancellationNotificationTemplate,
  getInterviewReminderTemplates,
  getPaymentVerificationNotificationTemplate,
  getPaymentVerificationConfirmationTemplate,
  getFeedbackNotificationTemplates
};
