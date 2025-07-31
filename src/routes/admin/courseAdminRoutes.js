const express = require('express');
const router = express.Router();
const requireAuth = require('../../middlewares/requireAuth');
const requireAdmin = require('../../middlewares/requireAdmin');
const courseController = require('../../controllers/courseController');

// 🆕 FIXED: Use admin-specific functions
router.get('/', requireAuth, requireAdmin, courseController.getCoursesForAdmin);

router.post('/', requireAuth, requireAdmin, courseController.createCourse);

// 🆕 FIXED: Use admin-specific functions  
router.get('/:id', requireAuth, requireAdmin, courseController.getCourseByIdForAdmin);

router.put('/:id', requireAuth, requireAdmin, courseController.updateCourse);

router.delete('/:id', requireAuth, requireAdmin, courseController.deleteCourse);

module.exports = router;