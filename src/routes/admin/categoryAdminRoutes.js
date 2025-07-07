const express = require('express');
const router = express.Router();
const requireAuth = require('../../middlewares/requireAuth');
const requireAdmin = require('../../middlewares/requireAdmin');
const categoryController = require('../../controllers/categoryController');

router.get('/', requireAuth, requireAdmin, categoryController.getCategories);

router.get('/:id', requireAuth, requireAdmin, categoryController.getCategoryById);

router.put('/:id', requireAuth, requireAdmin, categoryController.updateCategory);

router.delete('/:id', requireAuth, requireAdmin, categoryController.deleteCategory);

module.exports = router;
