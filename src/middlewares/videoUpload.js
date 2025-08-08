// src/middlewares/videoUpload.js
const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '../../uploads/videos');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}

// Storage configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    // Generate unique filename with timestamp and random string
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const extension = path.extname(file.originalname);
    cb(null, `video-${uniqueSuffix}${extension}`);
  }
});

// File filter for video files only
const fileFilter = (req, file, cb) => {
  console.log('🔍 Video upload - File type:', file.mimetype);
  
  // Allowed video MIME types
  const allowedTypes = [
    'video/mp4',
    'video/avi',
    'video/quicktime', // .mov files
    'video/x-msvideo', // .avi files
    'video/x-ms-wmv',  // .wmv files
    'video/x-flv',     // .flv files
    'video/webm',      // .webm files
    'video/x-matroska' // .mkv files
  ];
  
  if (allowedTypes.includes(file.mimetype)) {
    console.log('✅ Video upload - File type accepted:', file.mimetype);
    cb(null, true);
  } else {
    console.log('❌ Video upload - File type rejected:', file.mimetype);
    cb(new Error(`Invalid file type. Only video files are allowed. Received: ${file.mimetype}`), false);
  }
};

// Multer configuration
const upload = multer({
  storage: storage,
  fileFilter: fileFilter,
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit for videos
  }
});

// Single video upload middleware
const uploadSingleVideo = upload.single('videoFile');

// Handle multer errors
const handleVideoUploadErrors = (error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    console.error('❌ Video upload - Multer error:', error);
    
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({
        error: 'File too large. Maximum video file size is 500MB.'
      });
    }
    
    if (error.code === 'LIMIT_UNEXPECTED_FILE') {
      return res.status(400).json({
        error: 'Unexpected file field. Use "videoFile" as the field name.'
      });
    }
    
    return res.status(400).json({
      error: `Upload error: ${error.message}`
    });
  }
  
  if (error) {
    console.error('❌ Video upload - General error:', error);
    return res.status(400).json({
      error: error.message || 'Video upload failed'
    });
  }
  
  next();
};

// Wrapper middleware that handles errors
const uploadVideoWithErrorHandling = (req, res, next) => {
  uploadSingleVideo(req, res, (error) => {
    handleVideoUploadErrors(error, req, res, next);
  });
};

module.exports = {
  uploadSingleVideo: uploadVideoWithErrorHandling,
  handleVideoUploadErrors
};