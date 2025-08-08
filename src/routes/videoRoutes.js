// src/routes/videoRoutes.js
const express = require('express');
const router = express.Router();
const {
  createVideo,
  getAllVideos,
  getVideosByCourse,
  getVideosByModule,
  getVideosByChapter,
  updateVideo,
  deleteVideo,
  streamVideo
} = require('../controllers/videoController');
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');
const { uploadSingleVideo } = require('../middlewares/videoUpload');

// Admin routes (protected)
router.post('/', requireAuth, requireAdmin, uploadSingleVideo, createVideo);
router.get('/admin/all', requireAuth, requireAdmin, getAllVideos);
router.put('/:id', requireAuth, requireAdmin, uploadSingleVideo, updateVideo);
router.delete('/:id', requireAuth, requireAdmin, deleteVideo);

// Public routes (for students)
router.get('/course/:courseId', getVideosByCourse);
router.get('/module/:moduleId', getVideosByModule);
router.get('/chapter/:chapterId', getVideosByChapter);

// Video streaming route
router.get('/stream/:filename', streamVideo);

module.exports = router;