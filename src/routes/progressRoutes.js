// src/routes/progressRoutes.js
const express = require('express');
const router = express.Router();
const {
  getCourseProgress,
  updateModuleProgress,
  getAllProgress,
  resetCourseProgress
} = require('../controllers/progressController');
const requireAuth = require('../middlewares/requireAuth');

// Get progress for a specific course
router.get('/course/:courseId', requireAuth, getCourseProgress);

// Update module progress
router.put('/module', requireAuth, updateModuleProgress);

// Get progress for all enrolled courses
router.get('/all', requireAuth, getAllProgress);

// Reset course progress
router.delete('/course/:courseId', requireAuth, resetCourseProgress);

module.exports = router;