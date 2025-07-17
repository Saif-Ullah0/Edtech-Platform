// backend/routes/debugRoutes.js
const express = require('express');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const {
  getUserEnrollments,
  getUserOrders,
  debugSession,
  forceCreateEnrollment,
  testWebhookProcessing
} = require('../controllers/debugController');

// Debug user data
router.get('/enrollments', requireAuth, getUserEnrollments);
router.get('/orders', requireAuth, getUserOrders);

// Debug specific session
router.get('/session/:sessionId', requireAuth, debugSession);

// Force create enrollment (for testing)
router.post('/force-enroll', requireAuth, forceCreateEnrollment);

// Test webhook processing manually
router.post('/test-webhook', requireAuth, testWebhookProcessing);

module.exports = router;