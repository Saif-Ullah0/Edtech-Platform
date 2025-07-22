// backend/src/routes/paymentRoutes.js - UPDATED VERSION
const express = require('express');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const { 
  // Existing course payment functions
  fastEnrollment,
  createPaymentIntent,
  confirmEnrollment,
  createCheckoutSession, 
  verifySession, 
  stripeWebhookHandler,
  checkPaymentHealth,
  
  // New module payment functions
  getModuleDetails,
  purchaseModule,
  getUserModules,
  
  // New bundle functions
  createBundle,
  getUserBundles,
  purchaseBundle,
  deleteBundle
} = require('../controllers/paymentController');

// 🔍 HEALTH: Check Stripe connection (no auth needed for debugging)
router.get('/health', checkPaymentHealth);

// 🚀 FAST: Direct enrollment (recommended)
router.post('/fast-enroll', requireAuth, fastEnrollment);

// 🚀 FAST: Create payment intent for frontend confirmation
router.post('/create-intent', requireAuth, createPaymentIntent);

// 🚀 FAST: Confirm enrollment after payment
router.post('/confirm-enrollment', requireAuth, confirmEnrollment);

// 🐌 SLOW: Checkout session (fallback)
router.post('/checkout', requireAuth, createCheckoutSession);

// Verification and webhooks
router.post('/verify-session', requireAuth, verifySession);
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

// ================================
// NEW MODULE PAYMENT ROUTES
// ================================

// Module routes
router.get('/modules/my-modules', requireAuth, getUserModules);
router.get('/modules/:moduleId', requireAuth, getModuleDetails);
router.post('/modules/purchase', requireAuth, purchaseModule);

// ================================
// NEW BUNDLE ROUTES
// ================================

// Bundle routes
router.get('/bundles', requireAuth, getUserBundles);
router.post('/bundles/create', requireAuth, createBundle);
router.post('/bundles/purchase', requireAuth, purchaseBundle);
router.delete('/bundles/:bundleId', requireAuth, deleteBundle);

module.exports = router;