const express = require('express');
const router = express.Router();
const requireAuth = require('../../middlewares/requireAuth');
const requireAdmin = require('../../middlewares/requireAdmin');
const courseController = require('../../controllers/courseController');

router.get('/', requireAuth, requireAdmin, courseController.getCourses);

router.post('/', requireAuth, requireAdmin, courseController.createCourse);

router.get('/:id', requireAuth, requireAdmin, courseController.getCourseById);

router.put('/:id', requireAuth, requireAdmin, courseController.updateCourse);

router.delete('/:id', requireAuth, requireAdmin, courseController.deleteCourse);

module.exports = router;