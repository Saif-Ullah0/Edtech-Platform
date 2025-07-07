const express = require('express');
const router = express.Router();
const requireAuth = require('../../middlewares/requireAuth');
const requireAdmin = require('../../middlewares/requireAdmin');
const courseController = require('../../controllers/courseController');

router.post('/', requireAuth, requireAdmin, courseController.createCourse);

router.put('/:id', requireAuth, requireAdmin, courseController.updateCourse);

router.delete('/:id', requireAuth, requireAdmin, courseController.deleteCourse);

module.exports = router;
