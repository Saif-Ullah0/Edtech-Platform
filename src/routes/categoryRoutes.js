const express = require('express');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const categoryController = require('../controllers/categoryController');
router.get('/public', categoryController.getCategories);

router.get('/', requireAuth, categoryController.getCategories);

const requireAdmin = require('../middlewares/requireAdmin');
router.post('/', requireAuth, requireAdmin, categoryController.createCategory);

module.exports = router;
