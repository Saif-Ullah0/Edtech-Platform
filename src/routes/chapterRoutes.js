// routes/chapterRoutes.js
const express = require('express');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const chapterController = require('../controllers/chapterController');

// Student routes - published chapters only
router.get('/module/:moduleId', chapterController.getChaptersByModule);
router.get('/course/:courseId', chapterController.getChaptersByCourse);
router.get('/:id', chapterController.getChapterById);

// Authenticated user routes
router.put('/:id/progress', requireAuth, chapterController.updateChapterProgress);

module.exports = router;