const express = require('express');
const router = express.Router();
const {
  validateDiscountCode,
  applyDiscountCode,
  createDiscountCode,
  getDiscountCodes,
  updateDiscountCode,
  deleteDiscountCode,
  getDiscountAnalytics, // NEW
} = require('../controllers/discountController');
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');

// User routes (require auth)
router.use(requireAuth);
router.post('/validate', validateDiscountCode);
router.post('/apply', applyDiscountCode);

// Admin routes
router.use(requireAdmin);
router.post('/', createDiscountCode);
router.get('/', getDiscountCodes);
router.put('/:id', updateDiscountCode);
router.delete('/:id', deleteDiscountCode);
router.get('/analytics/:id', getDiscountAnalytics); // NEW

module.exports = router;