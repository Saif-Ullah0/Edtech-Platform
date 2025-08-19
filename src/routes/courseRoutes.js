const express = require('express');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');
const {
  getCourses,
  getCoursesForAdmin,
  getCourseById,
  getCourseByIdForAdmin,
  createCourse,
  updateCourse,
  deleteCourse,
  searchCourses,
  purchaseCourse, // NEW
} = require('../controllers/courseController');

// Public routes (no auth required)
router.get('/', getCourses);                    // Browse courses
router.get('/search', searchCourses);           // Search courses

// Student routes (require auth)
router.get('/:id', requireAuth, getCourseById); // Get course details
router.post('/purchase', requireAuth, purchaseCourse); // NEW: Course purchase

// Admin routes (require admin auth)
router.get('/admin', requireAdmin, getCoursesForAdmin);
router.get('/admin/:id', requireAdmin, getCourseByIdForAdmin);
router.post('/', requireAdmin, createCourse);
router.put('/:id', requireAdmin, updateCourse);
router.delete('/:id', requireAdmin, deleteCourse);

module.exports = router;