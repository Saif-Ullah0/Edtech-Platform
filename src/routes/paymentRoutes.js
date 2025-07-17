const express = require('express');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const { createCheckoutSession, verifySession, stripeWebhookHandler } = require('../controllers/paymentController');

// ✅ Create checkout session (existing)
router.post('/checkout', requireAuth, createCheckoutSession);

// ✅ NEW: Verify payment session
router.post('/verify-session', requireAuth, verifySession);

// ✅ Stripe webhook (existing)
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

module.exports = router;