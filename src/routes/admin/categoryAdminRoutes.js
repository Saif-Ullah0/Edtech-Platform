const express = require('express');
const router = express.Router();
const requireAuth = require('../../middlewares/requireAuth');
const requireAdmin = require('../../middlewares/requireAdmin');
const categoryController = require('../../controllers/categoryController');

// GET /api/admin/categories - Get all categories
router.get('/', requireAuth, requireAdmin, categoryController.getCategories);

// POST /api/admin/categories - Create new category (MISSING ROUTE - ADD THIS!)
router.post('/', requireAuth, requireAdmin, categoryController.createCategory);

// GET /api/admin/categories/:id - Get category by ID
router.get('/:id', requireAuth, requireAdmin, categoryController.getCategoryById);

// PUT /api/admin/categories/:id - Update category
router.put('/:id', requireAuth, requireAdmin, categoryController.updateCategory);

// DELETE /api/admin/categories/:id - Delete category
router.delete('/:id', requireAuth, requireAdmin, categoryController.deleteCategory);

module.exports = router;