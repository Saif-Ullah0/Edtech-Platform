// backend/routes/admin/userAdminRoutes.js
const express = require('express');
const router = express.Router();
const requireAuth = require('../../middlewares/requireAuth');
const requireAdmin = require('../../middlewares/requireAdmin');
const userController = require('../../controllers/adminUserController');

// GET /api/admin/users - Get all users
router.get('/', requireAuth, requireAdmin, userController.getAllUsers);

// POST /api/admin/users - Create new user
router.post('/', requireAuth, requireAdmin, userController.createUser);

// GET /api/admin/users/:id - Get user by ID
router.get('/:id', requireAuth, requireAdmin, userController.getUserById);

// PUT /api/admin/users/:id - Update user
router.put('/:id', requireAuth, requireAdmin, userController.updateUser);

// PUT /api/admin/users/:id/promote - Promote user to admin
router.put('/:id/promote', requireAuth, requireAdmin, userController.promoteUser);

// DELETE /api/admin/users/:id - Delete user (optional)
router.delete('/:id', requireAuth, requireAdmin, userController.deleteUser);

module.exports = router;