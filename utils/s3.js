const AWS = require('aws-sdk');
const path = require('path');
require('dotenv').config();

// Configure AWS SDK
AWS.config.update({
  accessKeyId: process.env.AWS_ACCESS_KEY_ID,
  secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
  region: process.env.AWS_REGION || 'ap-south-1'
});

// Create S3 service object
const s3 = new AWS.S3();

/**
 * Upload a file to S3
 * @param {Object} file - The file object from multer
 * @param {String} folder - The folder in the S3 bucket
 * @returns {Promise<String>} - The URL of the uploaded file
 */
const uploadToS3 = async (file, folder = 'qr-codes') => {
  const fileExtension = path.extname(file.originalname);
  const fileName = `${folder}/${Date.now()}-${Math.round(Math.random() * 1E9)}${fileExtension}`;
  
  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: fileName,
    Body: file.buffer,
    ContentType: file.mimetype
  };
  
  try {
    const result = await s3.upload(params).promise();
    return result.Location; // Return the URL of the uploaded file
  } catch (error) {
    console.error('Error uploading to S3:', error);
    throw error;
  }
};

/**
 * Delete a file from S3
 * @param {String} fileUrl - The URL of the file to delete
 * @returns {Promise<Object>} - The result of the delete operation
 */
const deleteFromS3 = async (fileUrl) => {
  // Extract the key from the URL
  const key = fileUrl.split('/').slice(3).join('/');
  
  const params = {
    Bucket: process.env.AWS_S3_BUCKET_NAME,
    Key: key
  };
  
  try {
    const result = await s3.deleteObject(params).promise();
    return result;
  } catch (error) {
    console.error('Error deleting from S3:', error);
    throw error;
  }
};

module.exports = {
  uploadToS3,
  deleteFromS3
};
