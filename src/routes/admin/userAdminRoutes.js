const express = require('express');
const router = express.Router();
const requireAuth = require('../../middlewares/requireAuth');
const requireAdmin = require('../../middlewares/requireAdmin');
const { getAllUsers, promoteToAdmin } = require('../../controllers/adminUserController');

// GET /api/admin/users
router.get('/', requireAuth, requireAdmin, getAllUsers);

// PUT /api/admin/users/:id/promote
router.put('/:id/promote', requireAuth, requireAdmin, promoteToAdmin);

module.exports = router;
