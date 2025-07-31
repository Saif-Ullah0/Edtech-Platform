// routes/admin/chapterAdminRoutes.js
const express = require('express');
const router = express.Router();
const requireAuth = require('../../middlewares/requireAuth');
const requireAdmin = require('../../middlewares/requireAdmin');
const chapterController = require('../../controllers/chapterController');

// Admin routes - can see all chapters including drafts
router.get('/module/:moduleId', requireAuth, requireAdmin, chapterController.getChaptersByModuleForAdmin);
router.get('/:id', requireAuth, requireAdmin, chapterController.getChapterByIdForAdmin);
router.post('/', requireAuth, requireAdmin, chapterController.createChapter);
router.put('/:id', requireAuth, requireAdmin, chapterController.updateChapter);
router.delete('/:id', requireAuth, requireAdmin, chapterController.deleteChapter);

module.exports = router;