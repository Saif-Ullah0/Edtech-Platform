const express = require('express');
const router = express.Router();
const {
  validateDiscountCode,
  applyDiscountCode,
  createDiscountCode,
  getDiscountCodes,
  updateDiscountCode,
  deleteDiscountCode,
  getDiscountAnalytics,
  getGeneralAnalytics, // 🆕 NEW: Added for general analytics
} = require('../controllers/discountController');
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');

// User routes (require authentication)
router.use(requireAuth);
router.post('/validate', validateDiscountCode);
router.post('/apply', applyDiscountCode);

// Admin routes (require admin privileges)
router.use(requireAdmin);
router.post('/', createDiscountCode);
router.get('/', getDiscountCodes);
router.put('/:id', updateDiscountCode);
router.delete('/:id', deleteDiscountCode);
router.get('/analytics/:id', getDiscountAnalytics);
router.get('/analytics', getGeneralAnalytics); // 🆕 NEW: Added route for general analytics

module.exports = router;