// backend/src/routes/bundleRoutes.js
const express = require('express');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const { 
  getBundleAnalytics,
  getAvailableCourses,
  getAvailableModules,
  createBundle,
  getBundles,
  getBundleById,
  updateBundle,
  deleteBundle,
  purchaseBundle
} = require('../controllers/bundleController');

// Debug middleware
router.use((req, res, next) => {
  console.log(`🔍 BUNDLE ROUTE: ${req.method} ${req.originalUrl}`);
  next();
});

// Public routes (no auth required)
router.get('/marketplace', getBundles); // Public marketplace
router.get('/:bundleId', getBundleById); // Bundle details (public/auth)

// Protected routes (auth required)
router.use(requireAuth); // All routes below require authentication

// Analytics
router.get('/analytics/my', getBundleAnalytics); // User's analytics
router.get('/analytics/admin', getBundleAnalytics); // Admin analytics (handled by controller)

// Bundle management
router.get('/', getBundles); // Get all bundles (user sees their own + public)
router.post('/', createBundle); // Create new bundle
router.put('/:bundleId', updateBundle); // Update bundle
router.delete('/:bundleId', deleteBundle); // Delete bundle

// Purchase
router.post('/purchase', purchaseBundle);

// Available items for bundle creation
router.get('/items/courses', getAvailableCourses);
router.get('/items/modules', getAvailableModules);

module.exports = router;