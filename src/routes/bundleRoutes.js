// backend/src/routes/bundleRoutes.js - FIXED VERSION
// Replace your current bundleRoutes.js with this

const express = require('express');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const {
  getAllBundles,
  getFeaturedBundles,
  getPopularBundles,
  createModuleBundle,
  createCourseBundle,
  purchaseBundle,
  getUserBundles,
  deleteBundle,
  getBundleAnalytics,
  getBundleDetails
} = require('../controllers/bundleController');

// ================================
// PUBLIC BUNDLE ROUTES
// ================================

// Get all bundles with filters
router.get('/', getAllBundles);

// Get featured bundles (for homepage)
router.get('/featured', getFeaturedBundles);

// Get popular bundles
router.get('/popular', getPopularBundles);

// ================================
// USER BUNDLE ROUTES (AUTH REQUIRED) - PUT BEFORE :bundleId ROUTE
// ================================

// 🔧 FIXED: Put specific routes BEFORE parameterized routes
// Get user's created bundles
router.get('/my-bundles', requireAuth, getUserBundles);

// Get user's bundle analytics
router.get('/my-analytics', requireAuth, getBundleAnalytics);

// Create bundles
router.post('/create/modules', requireAuth, createModuleBundle);
router.post('/create/courses', requireAuth, createCourseBundle);

// Purchase bundle
router.post('/purchase', requireAuth, purchaseBundle);

// ================================
// PARAMETERIZED ROUTES (PUT LAST)
// ================================

// 🔧 FIXED: Put :bundleId route AFTER specific routes
// Get single bundle details
router.get('/:bundleId', getBundleDetails);

// Delete user's bundle
router.delete('/:bundleId', requireAuth, deleteBundle);

module.exports = router;