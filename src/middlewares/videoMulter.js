// backend/src/middlewares/videoMulter.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const createUploadDir = (dirPath) => {
  if (!fs.existsSync(dirPath)) {
    fs.mkdirSync(dirPath, { recursive: true });
  }
};

// Storage configuration for videos with thumbnails
const videoStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    let uploadPath;
    
    if (file.fieldname === 'video') {
      const courseId = req.body.courseId || 'general';
      uploadPath = `uploads/videos/course_${courseId}`;
    } else if (file.fieldname === 'thumbnail') {
      uploadPath = 'uploads/videos/thumbnails';
    } else {
      return cb(new Error('Unexpected field'), false);
    }
    
    createUploadDir(uploadPath);
    cb(null, uploadPath);
  },
  filename: (req, file, cb) => {
    const uniqueName = `${Date.now()}_${Math.round(Math.random() * 1E9)}`;
    const fileExtension = path.extname(file.originalname);
    
    let prefix = '';
    if (file.fieldname === 'thumbnail') {
      prefix = 'thumb_';
    }
    
    cb(null, `${prefix}${uniqueName}${fileExtension}`);
  }
});

// File filter for videos and images
const fileFilter = (req, file, cb) => {
  if (file.fieldname === 'video') {
    // Allowed video formats
    const allowedVideoTypes = [
      'video/mp4',
      'video/mpeg',
      'video/quicktime',
      'video/x-msvideo', // .avi
      'video/x-ms-wmv',  // .wmv
      'video/webm'
    ];

    if (allowedVideoTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid video file type. Only MP4, MPEG, MOV, AVI, and WebM are allowed.'), false);
    }
  } else if (file.fieldname === 'thumbnail') {
    // Allowed image formats
    const allowedImageTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
    
    if (allowedImageTypes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Invalid image file type. Only JPEG, PNG, GIF, and WebP are allowed.'), false);
    }
  } else {
    cb(new Error('Unexpected field'), false);
  }
};

// Multer configuration
const uploadVideoWithThumbnail = multer({
  storage: videoStorage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit for videos
    files: 2 // Max 2 files (video + thumbnail)
  }
});

// Middleware for handling video upload with optional thumbnail
const handleVideoUpload = uploadVideoWithThumbnail.fields([
  { name: 'video', maxCount: 1 },
  { name: 'thumbnail', maxCount: 1 }
]);

// Error handling middleware specifically for video uploads
const handleVideoUploadError = (error, req, res, next) => {
  console.error('Video upload error:', error);

  // Handle Multer errors
  if (error instanceof multer.MulterError) {
    switch (error.code) {
      case 'LIMIT_FILE_SIZE':
        return res.status(400).json({ 
          error: 'File too large',
          message: 'Video file size should not exceed 500MB' 
        });
      case 'LIMIT_FILE_COUNT':
        return res.status(400).json({
          error: 'Too many files',
          message: 'Maximum 2 files allowed (1 video + 1 thumbnail)'
        });
      case 'LIMIT_UNEXPECTED_FILE':
        return res.status(400).json({ 
          error: 'Unexpected field',
          message: 'Only video and thumbnail fields are allowed' 
        });
      case 'LIMIT_PART_COUNT':
        return res.status(400).json({
          error: 'Too many parts',
          message: 'Too many form parts'
        });
      case 'LIMIT_FIELD_KEY':
        return res.status(400).json({
          error: 'Field name too long',
          message: 'Field name exceeds character limit'
        });
      case 'LIMIT_FIELD_VALUE':
        return res.status(400).json({
          error: 'Field value too long',
          message: 'Field value exceeds character limit'
        });
      case 'LIMIT_FIELD_COUNT':
        return res.status(400).json({
          error: 'Too many fields',
          message: 'Too many form fields'
        });
      default:
        return res.status(400).json({
          error: 'Upload error',
          message: error.message
        });
    }
  }

  // Handle file type validation errors
  if (error.message && error.message.includes('Invalid video file')) {
    return res.status(400).json({
      error: 'Invalid video file',
      message: error.message
    });
  }

  if (error.message && error.message.includes('Invalid image file')) {
    return res.status(400).json({
      error: 'Invalid image file', 
      message: error.message
    });
  }

  if (error.message && error.message.includes('Invalid file type')) {
    return res.status(400).json({
      error: 'Invalid file type',
      message: error.message
    });
  }

  // Pass other errors to the general error handler
  next(error);
};

module.exports = {
  handleVideoUpload,
  handleVideoUploadError
};