// routes/admin/dashboardAdminRoutes.js - SIMPLE VERSION
const express = require('express');
const router = express.Router();

// Import only the existing functions that work
const { 
  getDashboardStats, 
  getUserGrowthStats, 
  getCourseStats, 
  getRevenueStats
  // Remove debugRevenue for now
} = require('../../controllers/adminDashboardController');

// Existing dashboard routes
router.get('/', getDashboardStats);
router.get('/users/growth', getUserGrowthStats);
router.get('/courses', getCourseStats);
router.get('/revenue', getRevenueStats);

// Remove the debug route temporarily
// router.get('/debug/revenue', debugRevenue);

module.exports = router;