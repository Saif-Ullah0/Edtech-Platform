// src/routes/progressRoutes.js
const express = require('express');
const router = express.Router();
const {
  getCourseProgress,
  updateModuleProgress,
  updateChapterProgress, // NEW: Add chapter progress import
  getAllProgress,
  resetCourseProgress
} = require('../controllers/progressController');
const requireAuth = require('../middlewares/requireAuth');

// Get progress for a specific course
router.get('/course/:courseId', requireAuth, getCourseProgress);

// Update module progress (keep for backward compatibility)
router.put('/module', requireAuth, updateModuleProgress);

// NEW: Update chapter progress (main progress tracking endpoint)
router.put('/chapter', requireAuth, updateChapterProgress);

// Get progress for all enrolled courses
router.get('/all', requireAuth, getAllProgress);

// Reset course progress
router.delete('/course/:courseId', requireAuth, resetCourseProgress);

module.exports = router;
