const AWS = require("aws-sdk");
require("dotenv").config();

// Import email templates
const {
  formatDateWithTimezone,
  getInterviewBookingConfirmationTemplate,
  getInterviewBookingNotificationTemplate,
  getInterviewCancellationConfirmationTemplate,
  getInterviewCancellationNotificationTemplate,
  getInterviewReminderTemplates,
  getPaymentVerificationNotificationTemplate,
  getPaymentVerificationConfirmationTemplate,
  getFeedbackNotificationTemplates
} = require("./emailTemplates");

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || "us-east-1",
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
    console.log(
      "AWS credentials not configured. Email would have been sent to:",
      Array.isArray(to) ? to : [to]
    );
    console.log("Email subject:", subject);
    return {
      messageId: "mock-message-id",
      message: "Email sending skipped - AWS credentials not configured",
    };
  }

  // In development or if DISABLE_EMAILS is set, log instead of sending
  if (
    process.env.NODE_ENV !== "production" ||
    process.env.DISABLE_EMAILS === "true"
  ) {
    console.log(
      "Email sending disabled in development. Would have sent to:",
      Array.isArray(to) ? to : [to]
    );
    return {
      messageId: "mock-message-id",
      message: "Email sending skipped - in development mode",
    };
  }

  // Use a verified sender email address
  const verifiedSender =
    process.env.VERIFIED_EMAIL_SENDER || "jaspinder@thes30.com";

  const params = {
    Source: verifiedSender,
    Destination: {
      ToAddresses: Array.isArray(to) ? to : [to],
      CcAddresses: Array.isArray(cc) && cc.length > 0 ? cc : [],
    },
    Message: {
      Subject: {
        Data: subject,
      },
      Body: {
        Html: {
          Data: htmlBody,
        },
        Text: {
          Data: textBody,
        },
      },
    },
  };

  try {
    const result = await ses.sendEmail(params).promise();
    console.log("Email sent successfully:", result.MessageId);
    return result;
  } catch (error) {
    // Handle specific AWS SES errors
    if (
      error.code === "MessageRejected" &&
      error.message.includes("not verified")
    ) {
      console.error("Email address verification error:", error.message);
      // Log instructions for verifying email in AWS SES
      console.log(
        "To fix this issue, verify the email addresses in AWS SES console for the AP-SOUTH-1 region"
      );

      // Use environment variable for admin email fallback
      const adminEmail = process.env.ADMIN_EMAIL || "admin@example.com";

      // If we're in production, attempt to send to admin only
      if (process.env.NODE_ENV === "production") {
        try {
          // Create a new params object with only verified admin email
          const fallbackParams = {
            ...params,
            Destination: {
              ToAddresses: [adminEmail],
              CcAddresses: [],
            },
            Message: {
              ...params.Message,
              Subject: {
                Data: `[UNDELIVERED] ${subject}`,
              },
              Body: {
                ...params.Message.Body,
                Text: {
                  Data: `Original recipients: ${JSON.stringify(
                    params.Destination.ToAddresses
                  )}\n\n${textBody}`,
                },
              },
            },
          };

          // Try to send to admin only
          await ses.sendEmail(fallbackParams).promise();
        } catch (fallbackError) {
          console.error(
            "Failed to send fallback email to admin:",
            fallbackError
          );
        }
      }
    }

    console.error("Error sending email:", error);
    // Return a mock response instead of throwing to prevent application failures
    return {
      messageId: "error-message-id",
      message: "Email sending failed but application continues",
      error: error.message,
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
const sendFeedbackNotification = async (
  feedback,
  interview,
  candidate,
  interviewer,
  adminEmail
) => {
  const candidateSubject = "Feedback Received for Your Interview";
  const adminSubject = `New Feedback Submitted - ${candidate.name}'s Interview`;

  // Get email templates with proper timezone formatting
  const {
    candidateHtmlBody,
    candidateTextBody,
    adminHtmlBody,
    adminTextBody
  } = getFeedbackNotificationTemplates(feedback, interview, candidate, interviewer);

  // Send emails
  await Promise.all([
    sendEmail(
      candidate.email,
      candidateSubject,
      candidateHtmlBody,
      candidateTextBody
    ),
    sendEmail(adminEmail, adminSubject, adminHtmlBody, adminTextBody),
  ]);
};

/**
 * Send interview reminder emails to all parties
 * @param {Object} interview - The interview object
 * @param {Object} candidate - The candidate user object
 * @param {Object} interviewer - The interviewer user object
 * @param {String} adminEmail - Admin email address
 */
const sendInterviewReminder = async (
  interview,
  candidate,
  interviewer,
  adminEmail
) => {
  const subject = `Reminder: Interview in 30 Minutes`;

  // Get email templates with proper timezone formatting
  const {
    candidateHtmlBody,
    candidateTextBody,
    interviewerHtmlBody,
    interviewerTextBody,
    adminHtmlBody,
    adminTextBody
  } = getInterviewReminderTemplates(interview, candidate, interviewer);

  // Send reminder to candidate
  await sendEmail(
    candidate.email,
    subject,
    candidateHtmlBody,
    candidateTextBody
  );

  // Send reminder to interviewer
  await sendEmail(
    interviewer.email,
    subject,
    interviewerHtmlBody,
    interviewerTextBody
  );

  // Send notification to admin if provided
  if (adminEmail) {
    await sendEmail(
      adminEmail,
      `Interview Reminder: ${candidate.name} & ${interviewer.name}`,
      adminHtmlBody,
      adminTextBody
    );
  }
};

/**
 * Send interview booking notification to interviewer
 * @param {Object} interview - The interview object
 * @param {Object} candidate - The candidate user object
 * @param {Object} interviewer - The interviewer user object
 * @returns {Promise} - Promise that resolves to the SES response
 */
const sendInterviewBookingNotification = async (
  interview,
  candidate,
  interviewer,
  adminEmail
) => {
  const subject = "New Interview Booking Notification";

  // Get email template with proper timezone formatting
  const { htmlBody, textBody } = getInterviewBookingNotificationTemplate(interview, candidate, interviewer);

  return await sendEmail(
    interviewer.email,
    subject,
    htmlBody,
    textBody,
    adminEmail ? [adminEmail] : []
  );
};

/**
 * Send interview cancellation notification to interviewer
 * @param {Object} interview - The interview object
 * @param {Object} candidate - The candidate user object
 * @param {Object} interviewer - The interviewer user object
 * @returns {Promise} - Promise that resolves to the SES response
 */
const sendInterviewCancellationNotification = async (
  interview,
  candidate,
  interviewer,
  adminEmail
) => {
  const subject = "Interview Cancellation Notification";

  // Get email template with proper timezone formatting
  const { htmlBody, textBody } = getInterviewCancellationNotificationTemplate(interview, candidate, interviewer);

  return await sendEmail(
    interviewer.email,
    subject,
    htmlBody,
    textBody,
    adminEmail ? [adminEmail] : []
  );
};

/**
 * Send payment verification notification to interviewer
 * @param {Object} interview - The interview object
 * @param {Object} payment - The payment object
 * @param {Object} candidate - The candidate user object
 * @param {Object} interviewer - The interviewer user object
 * @returns {Promise} - Promise that resolves to the SES response
 */
const sendPaymentVerificationNotification = async (
  interview,
  payment,
  candidate,
  interviewer,
  adminEmail
) => {
  const subject = "Payment Verification Required";

  // Get email template with proper timezone formatting
  const { htmlBody, textBody } = getPaymentVerificationNotificationTemplate(interview, payment, candidate, interviewer);

  return await sendEmail(
    interviewer.email,
    subject,
    htmlBody,
    textBody,
    adminEmail ? [adminEmail] : []
  );
};

/**
 * Send interview booking confirmation to candidate
 * @param {Object} interview - The interview object
 * @param {Object} candidate - The candidate user object
 * @param {Object} interviewer - The interviewer user object
 * @param {String} adminEmail - Admin email address
 * @returns {Promise} - Promise that resolves to the SES response
 */
const sendInterviewBookingConfirmation = async (
  interview,
  candidate,
  interviewer,
  adminEmail
) => {
  const subject = "Interview Booking Confirmation";
  
  // Get email template with proper timezone formatting
  const { htmlBody, textBody } = getInterviewBookingConfirmationTemplate(interview, candidate, interviewer);

  return await sendEmail(
    candidate.email,
    subject,
    htmlBody,
    textBody,
    adminEmail
  );
};

/**
 * Send interview cancellation confirmation to candidate
 * @param {Object} interview - The interview object
 * @param {Object} candidate - The candidate user object
 * @param {Object} interviewer - The interviewer user object
 * @param {String} adminEmail - Admin email address
 * @returns {Promise} - Promise that resolves to the SES response
 */
const sendInterviewCancellationConfirmation = async (
  interview,
  candidate,
  interviewer,
  adminEmail
) => {
  const subject = "Interview Cancellation Confirmation";

  // Get email template with proper timezone formatting
  const { htmlBody, textBody } = getInterviewCancellationConfirmationTemplate(interview, candidate, interviewer);

  return await sendEmail(
    candidate.email,
    subject,
    htmlBody,
    textBody,
    adminEmail
  );
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
const sendPaymentVerificationConfirmation = async (
  interview,
  payment,
  candidate,
  interviewer,
  adminEmail
) => {
  const subject = "Payment Verification Confirmation";

  // Get email template with proper timezone formatting
  const { htmlBody, textBody } = getPaymentVerificationConfirmationTemplate(interview, payment, candidate, interviewer);

  return await sendEmail(
    candidate.email,
    subject,
    htmlBody,
    textBody,
    adminEmail
  );
};

/**
 * Send email verification link to user
 * @param {Object} user - The user object
 * @param {String} verificationToken - The verification token
 * @returns {Promise} - Promise that resolves to the SES response
 */
const sendVerificationEmail = async (user, verificationToken) => {
  const verificationLink = `${process.env.CLIENT_URL}/verify-email/${verificationToken}`;

  const subject = "Verify Your Email - S30 Mocks";

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #4a6ee0;">Email Verification</h2>
      <p>Hello ${user.name},</p>
      <p>Thank you for registering with S30 Mocks. Please verify your email address by clicking the button below:</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${verificationLink}" 
           style="background-color: #4a6ee0; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Verify Email
        </a>
      </div>
      <p>Or copy and paste this link in your browser:</p>
      <p>${verificationLink}</p>
      <p>This link will expire in 24 hours.</p>
      <p>If you didn't create an account with S30 Mocks, please ignore this email.</p>
      <p>Best regards,<br>S30 Mocks Team</p>
    </div>
  `;

  const textBody = `
    Email Verification
    
    Hello ${user.name},
    
    Thank you for registering with S30 Mocks. Please verify your email address by clicking the link below:
    
    ${verificationLink}
    
    This link will expire in 24 hours.
    
    If you didn't create an account with S30 Mocks, please ignore this email.
    
    Best regards,
    S30 Mocks Team
  `;

  return await sendEmail(user.email, subject, htmlBody, textBody);
};

/**
 * Send email verification success notification
 * @param {Object} user - The user object
 * @returns {Promise} - Promise that resolves to the SES response
 */
const sendVerificationSuccessEmail = async (user) => {
  const subject = "Email Verified Successfully - S30 Mocks";

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #27ae60;">Email Verified Successfully</h2>
      <p>Hello ${user.name},</p>
      <p>Your email has been successfully verified. You can now log in to your S30 Mocks account and access all features.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${process.env.CLIENT_URL}/login" 
           style="background-color: #27ae60; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block;">
          Login to Your Account
        </a>
      </div>
      <p>Thank you for choosing S30 Mocks!</p>
      <p>Best regards,<br>S30 Mocks Team</p>
    </div>
  `;

  const textBody = `
    Email Verified Successfully
    
    Hello ${user.name},
    
    Your email has been successfully verified. You can now log in to your S30 Mocks account and access all features.
    
    Login here: ${process.env.CLIENT_URL}/login
    
    Thank you for choosing S30 Mocks!
    
    Best regards,
    S30 Mocks Team
  `;

  return await sendEmail(user.email, subject, htmlBody, textBody);
};

/**
 * Send password reset email to user
 * @param {String} email - User's email address
 * @param {String} resetToken - Password reset token
 * @returns {Promise} - Promise that resolves to the SES response
 */
const sendPasswordResetEmail = async (email, resetToken) => {
  const clientUrl = process.env.NODE_ENV === 'production'
    ? 'https://s30mocks.vercel.app'
    : 'http://localhost:3000';

  const resetLink = `${clientUrl}/reset-password/${resetToken}`;

  const subject = 'Reset Your S30 Mocks Password';

  const htmlBody = `
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
      <h2 style="color: #333;">Reset Your Password</h2>
      <p>You requested a password reset for your S30 Mocks account.</p>
      <p>Please click the button below to reset your password. This link is valid for 1 hour.</p>
      <div style="text-align: center; margin: 30px 0;">
        <a href="${resetLink}" style="background-color: #4CAF50; color: white; padding: 12px 20px; text-decoration: none; border-radius: 4px; display: inline-block;">Reset Password</a>
      </div>
      <p>If you didn't request this password reset, you can safely ignore this email.</p>
      <p>If the button above doesn't work, copy and paste this link into your browser:</p>
      <p style="word-break: break-all;">${resetLink}</p>
      <hr style="border: 1px solid #eee; margin: 20px 0;">
      <p style="color: #777; font-size: 12px;">© ${new Date().getFullYear()} S30 Mocks. All rights reserved.</p>
    </div>
  `;

  const textBody = `
    Reset Your Password
    
    You requested a password reset for your S30 Mocks account.
    
    Please visit the following link to reset your password (valid for 1 hour):
    ${resetLink}
    
    If you didn't request this password reset, you can safely ignore this email.
  `;

  return sendEmail(email, subject, htmlBody, textBody);
};

/**
 * Send promotional email to candidates who haven't scheduled their first mock interview
 * @param {Array} candidates - Array of candidate user objects
 * @param {String} adminEmail - Admin email address to CC
 * @returns {Promise} - Promise that resolves to the SES response
 */
const sendPromotionalEmail = async (candidates, adminEmail) => {
  const subject = "Boost Your Interview Skills with Expert Interviewers from Amazon, Oracle, and Microsoft";
  const results = [];
  
  // Process candidates in smaller batches for logging purposes
  const batchSize = 10;
  
  for (let i = 0; i < candidates.length; i += batchSize) {
    const batch = candidates.slice(i, i + batchSize);
    
    // Send individual emails to each candidate
    const batchPromises = batch.map(async (candidate) => {
      try {
        const htmlBody = `
          <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #eee; border-radius: 5px;">
            <div style="text-align: center; margin-bottom: 20px;">
              <h1 style="color: #4a6ee0; margin-bottom: 5px;">S30 Mocks</h1>
              <p style="color: #666; font-size: 16px; margin-top: 0;">Prepare for Success</p>
            </div>
            
            <h2 style="color: #333;">Ready to Ace Your Next Interview?</h2>
            
            <p>Hello ${candidate.name},</p>
            
            <p>We noticed you've signed up for S30 Mocks but haven't scheduled your first mock interview yet. Don't miss this opportunity to practice with our exceptional interviewers from top tech companies like <strong>Amazon</strong>, <strong>Microsoft</strong>, and <strong>Oracle</strong>.</p>
            
            <div style="background-color: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
              <h3 style="color: #4a6ee0; margin-top: 0;">Why S30 Mocks?</h3>
              <ul style="padding-left: 20px; margin-bottom: 0;">
                <li>Practice with <strong>real interviewers</strong> from top tech companies</li>
                <li>Receive <strong>detailed feedback</strong> on your performance</li>
                <li>Improve your <strong>technical and communication skills</strong></li>
                <li>Gain confidence through <strong>realistic interview scenarios</strong></li>
                <li>Flexible scheduling to fit <strong>your availability</strong></li>
              </ul>
            </div>
            
            <p>Our interviewers have conducted hundreds of real technical interviews and know exactly what it takes to succeed at top companies.</p>
            
            <div style="text-align: center; margin: 25px 0;">
              <a href="${process.env.CLIENT_URL}/slots" style="background-color: #4a6ee0; color: white; padding: 12px 25px; text-decoration: none; border-radius: 4px; font-weight: bold; display: inline-block;">Schedule Your Mock Interview</a>
            </div>
            
            <p>Don't wait until your actual interview to practice. Start preparing now and give yourself the best chance of success!</p>
            
            <p>If you have any questions, simply reply to this email or contact our support team.</p>
            
            <p>Best regards,<br>The S30 Mocks Team</p>
            
            <hr style="border: 1px solid #eee; margin: 20px 0;">
            <p style="color: #999; font-size: 12px; text-align: center;">© ${new Date().getFullYear()} S30 Mocks. All rights reserved.</p>
          </div>
        `;

        const textBody = `
          S30 Mocks - Prepare for Success
          
          READY TO ACE YOUR NEXT INTERVIEW?
          
          Hello ${candidate.name},
          
          We noticed you've signed up for S30 Mocks but haven't scheduled your first mock interview yet. Don't miss this opportunity to practice with our exceptional interviewers from top tech companies like Amazon, Microsoft, and Oracle.
          
          WHY S30 MOCKS?
          * Practice with real interviewers from top tech companies
          * Receive detailed feedback on your performance
          * Improve your technical and communication skills
          * Gain confidence through realistic interview scenarios
          * Flexible scheduling to fit your availability
          
          Our interviewers have conducted hundreds of real technical interviews and know exactly what it takes to succeed at top companies.
          
          Schedule your mock interview now: ${process.env.CLIENT_URL}/slots
          
          Don't wait until your actual interview to practice. Start preparing now and give yourself the best chance of success!
          
          If you have any questions, simply reply to this email or contact our support team.
          
          Best regards,
          The S30 Mocks Team
          
          © ${new Date().getFullYear()} S30 Mocks. All rights reserved.
        `;

        // Send individual email to each candidate with admin CC'd
        const result = await sendEmail(candidate.email, subject, htmlBody, textBody, [adminEmail]);
        return { success: true, email: candidate.email, result };
      } catch (error) {
        console.error(`Error sending email to ${candidate.email}:`, error);
        return { success: false, email: candidate.email, error: error.message };
      }
    });
    
    // Wait for all emails in this batch to be sent
    const batchResults = await Promise.all(batchPromises);
    results.push(...batchResults);
  }
  
  return results;
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
  sendPaymentVerificationConfirmation,
  sendVerificationEmail,
  sendVerificationSuccessEmail,
  sendPasswordResetEmail,
  sendPromotionalEmail,
};
