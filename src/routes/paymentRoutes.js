const express = require('express');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const { 
  fastEnrollment,
  createPaymentIntent,
  confirmEnrollment,
  createCheckoutSession, 
  verifySession, 
  stripeWebhookHandler,
  checkPaymentHealth
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

module.exports = router;