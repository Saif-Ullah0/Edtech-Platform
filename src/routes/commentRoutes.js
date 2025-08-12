// backend/src/routes/commentRoutes.js
const express = require('express');
const router = express.Router();
const {
  getComments,
  createComment,
  updateComment,
  deleteComment,
  toggleReaction
} = require('../controllers/commentController');
const requireAuth = require('../middlewares/requireAuth'); // ⚠️ CHECK THIS PATH

// Public routes
router.get('/:resourceType/:resourceId', getComments);

// Protected routes
router.use(requireAuth);
router.post('/', createComment);
router.put('/:id', updateComment);
router.delete('/:id', deleteComment);
router.post('/:id/react', toggleReaction);

module.exports = router; // ✅ Make sure this line exists