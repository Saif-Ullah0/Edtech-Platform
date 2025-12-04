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
  purchaseBundle,
  getFeaturedBundles
} = require('../controllers/bundleController');

// Debug middleware
router.use((req, res, next) => {
  console.log(`🔍 BUNDLE ROUTE: ${req.method} ${req.originalUrl}`);
  next();
});

/*
  IMPORTANT ORDER:
  - Register specific/static public routes FIRST (e.g. /featured, /marketplace, /items/*, /search)
  - Then protected routes (use requireAuth)
  - Finally register the dynamic catch-all :bundleId route LAST
*/

// Public static routes (no auth required)
router.get('/featured', getFeaturedBundles);      // <-- frontend calls /api/bundles/featured
router.get('/marketplace', getBundles);           // public marketplace

// If you want items endpoints public, keep them here; otherwise move below requireAuth
// Keep them public only if you want anonymous users to see what items are available.
router.get('/items/courses', getAvailableCourses);
router.get('/items/modules', getAvailableModules);

// Purchase endpoint should require auth — move it below requireAuth (see below)
// Analytics endpoints require auth — they will be registered after requireAuth

// Protected routes (auth required)
router.use(requireAuth);

// Analytics (protected)
router.get('/analytics/my', getBundleAnalytics);
router.get('/analytics/admin', getBundleAnalytics);

// Purchase (protected)
router.post('/purchase', purchaseBundle);

// Bundle management (protected)
router.get('/', getBundles);           // Get bundles (user-specific + public)
router.post('/', createBundle);        // Create new bundle
router.put('/:bundleId', updateBundle);
router.delete('/:bundleId', deleteBundle);

// Dynamic route LAST: Get single bundle by id (public access permitted in controller)
router.get('/:bundleId', getBundleById);

module.exports = router;
