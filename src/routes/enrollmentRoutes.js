const express = require('express');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const enrollmentController = require('../controllers/enrollmentController');

// Enrollment routes
router.post('/enroll', requireAuth, enrollmentController.enrollInCourse);
router.get('/my-enrollments', requireAuth, enrollmentController.getUserEnrollments);

// 🆕 NEW: Categorized courses endpoint for the updated My Courses page
router.get('/my-courses', requireAuth, enrollmentController.getMyCourses);

// Course access routes
router.get('/courses/:courseId/modules', requireAuth, enrollmentController.getModulesForCourse);
router.get('/courses/:courseId/status', requireAuth, enrollmentController.getEnrollmentStatus);

module.exports = router;