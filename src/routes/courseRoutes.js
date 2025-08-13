// Updated courseRoutes.js with proper authentication

const express = require('express');
const router = express.Router();

// 🆕 NEW: Import authentication middleware
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');

const courseController = require('../controllers/courseController');

const {
  getCourses,
  getCoursesForAdmin,
  getCourseById,
  getCourseByIdForAdmin,
  createCourse,
  updateCourse,
  deleteCourse,
  searchCourses
} = courseController;

// Public routes (no auth required)
router.get('/', getCourses);                    // Browse courses
router.get('/search', searchCourses);           // Search courses

// 🆕 FIXED: Student routes (require auth to check enrollment)
router.get('/:id', requireAuth, getCourseById); // ← Added requireAuth here!

// Admin routes (require admin auth)
router.get('/admin', requireAdmin, getCoursesForAdmin);
router.get('/admin/:id', requireAdmin, getCourseByIdForAdmin);
router.post('/', requireAdmin, createCourse);
router.put('/:id', requireAdmin, updateCourse);
router.delete('/:id', requireAdmin, deleteCourse);

module.exports = router;