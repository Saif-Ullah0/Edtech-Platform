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
  purchaseCourse,
  getBundles, // NEW
  enrollFreeCourse, // NEW
  checkEnrollment, // NEW
  purchaseBundle, // NEW
} = require('../controllers/courseController');

// Public routes (no auth required)
router.get('/', getCourses);                    // Browse courses
router.get('/search', searchCourses);           // Search courses

// Student routes (require auth)
router.get('/:id', requireAuth, getCourseById); // Get course details
router.get('/enrollments/course/:courseId', requireAuth, checkEnrollment); // NEW: Check enrollment
router.post('/enrollments/enroll', requireAuth, enrollFreeCourse); // NEW: Free course enrollment
router.post('/payment/checkout', requireAuth, purchaseCourse); // NEW: Map to purchaseCourse
router.post('/purchase', requireAuth, purchaseCourse); // Keep existing for backward compatibility
router.get('/bundles', requireAuth, getBundles); // NEW: Get bundles
router.post('/bundles/purchase', requireAuth, purchaseBundle); // NEW: Purchase bundle

// Admin routes (require admin auth)
router.get('/admin', requireAdmin, getCoursesForAdmin);
router.get('/admin/:id', requireAdmin, getCourseByIdForAdmin);
router.post('/', requireAdmin, createCourse);
router.put('/:id', requireAdmin, updateCourse);
router.delete('/:id', requireAdmin, deleteCourse);

module.exports = router;