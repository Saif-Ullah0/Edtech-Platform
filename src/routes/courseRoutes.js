const express = require('express');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const courseController = require('../controllers/courseController');

router.get('/', courseController.getCourses);
router.get('/search', courseController.searchCourses);

router.get('/:id', courseController.getCourseById);

module.exports = router;
