// src/routes/admin/dashboardAdminRoutes.js
const express = require('express');
const router = express.Router();
const {
  getDashboardStats,
  getUserGrowthStats,
  getCourseStats,
  getRevenueStats
} = require('../../controllers/adminDashboardController');

// Main dashboard stats (auth & admin check already handled in server.js)
router.get('/', getDashboardStats);

// Additional analytics endpoints
router.get('/user-growth', getUserGrowthStats);
router.get('/course-stats', getCourseStats);
router.get('/revenue-stats', getRevenueStats);

module.exports = router;