const express = require('express');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const { createCheckoutSession } = require('../controllers/paymentController');
const { stripeWebhookHandler } = require('../controllers/paymentController');


router.post('/checkout', requireAuth, createCheckoutSession);
router.post('/webhook', express.raw({ type: 'application/json' }), stripeWebhookHandler);

module.exports = router;
