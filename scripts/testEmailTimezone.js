/**
 * Test script to verify email timezone formatting
 */
const { 
  formatDateWithTimezone,
  getInterviewBookingConfirmationTemplate,
  getInterviewCancellationConfirmationTemplate
} = require('../utils/emailTemplates');

// Test data
const interview = {
  scheduledDate: new Date('2025-05-01T14:30:00Z'), // UTC time
  duration: 60,
  interviewType: 'System Design',
  timeZone: 'America/Los_Angeles', // Pacific Time
  meetingLink: 'https://zoom.us/test-meeting'
};

const candidate = {
  name: 'John Doe',
  email: 'john.doe@example.com'
};

const interviewer = {
  name: 'Jane Smith',
  email: 'jane.smith@example.com'
};

// Test timezone formatting
console.log('Testing timezone formatting:');
console.log('--------------------------');

// Test 1: Format date with Pacific timezone
console.log('Test 1: Pacific Time (America/Los_Angeles)');
console.log(formatDateWithTimezone(interview.scheduledDate, 'America/Los_Angeles'));
console.log();

// Test 2: Format date with Eastern timezone
console.log('Test 2: Eastern Time (America/New_York)');
console.log(formatDateWithTimezone(interview.scheduledDate, 'America/New_York'));
console.log();

// Test 3: Format date with Indian timezone
console.log('Test 3: Indian Time (Asia/Kolkata)');
console.log(formatDateWithTimezone(interview.scheduledDate, 'Asia/Kolkata'));
console.log();

// Test 4: Format date with default timezone (system timezone)
console.log('Test 4: Default (System) Timezone');
console.log(formatDateWithTimezone(interview.scheduledDate));
console.log();

// Test email templates
console.log('Testing email templates:');
console.log('--------------------------');

// Test booking confirmation template
console.log('Test 5: Interview Booking Confirmation Template');
const bookingTemplate = getInterviewBookingConfirmationTemplate(interview, candidate, interviewer);
console.log(bookingTemplate.textBody);
console.log();

// Test cancellation confirmation template
console.log('Test 6: Interview Cancellation Confirmation Template');
const cancellationTemplate = getInterviewCancellationConfirmationTemplate(interview, candidate, interviewer);
console.log(cancellationTemplate.textBody);
console.log();

console.log('All tests completed!');
