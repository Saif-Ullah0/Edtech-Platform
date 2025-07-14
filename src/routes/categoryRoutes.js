const express = require('express');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');
const categoryController = require('../controllers/categoryController');

// 🔓 Public route
router.get('/public', categoryController.getCategories);

// 🔐 Authenticated user route
router.get('/', requireAuth, categoryController.getCategories);

// ✅ Get category by ID (for category/[id] page)
router.get('/:id', categoryController.getCategoryById);  // <-- ADD THIS LINE

// 🔐 Admin-only route
router.post('/', requireAuth, requireAdmin, categoryController.createCategory);

module.exports = router;
