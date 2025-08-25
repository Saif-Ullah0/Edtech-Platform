// backend/src/routes/paymentRoutes.js - UPDATED
// Changes:
// - No major changes needed; /checkout already exists and handles coupon via body.
// - Kept as is, since createCheckoutSession now handles coupon.

const express = require('express');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const { 
  // Course payment functions only
  fastEnrollment,
  createPaymentIntent,
  confirmEnrollment,
  createCheckoutSession, 
  verifySession, 
  stripeWebhookHandler,
  checkPaymentHealth,
  
  // Module payment functions
  getModuleDetails,
  purchaseModule,
  getUserModules
} = require('../controllers/paymentController');

// Health check
router.get('/health', checkPaymentHealth);

// Course payment routes
router.post('/fast-enroll', requireAuth, fastEnrollment);
router.post('/create-intent', requireAuth, createPaymentIntent);
router.post('/confirm-enrollment', requireAuth, confirmEnrollment);
router.post('/checkout', requireAuth, createCheckoutSession);

// Module payment routes
router.get('/modules/my-modules', requireAuth, getUserModules);
router.get('/modules/:moduleId', requireAuth, getModuleDetails);
router.post('/modules/purchase', requireAuth, purchaseModule);

// Verification and webhooks
router.post('/verify-session', requireAuth, verifySession);
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

module.exports = router;