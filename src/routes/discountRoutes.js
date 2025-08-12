// backend/src/routes/discountRoutes.js
const express = require('express');
const router = express.Router();
const {
  validateDiscountCode,
  applyDiscountCode,
  createDiscountCode,
  getDiscountCodes
} = require('../controllers/discountController');
const requireAuth = require('../middlewares/requireAuth'); // ⚠️ CHECK THIS PATH
const requireAdmin = require('../middlewares/requireAdmin'); // ⚠️ CHECK THIS PATH

// User routes (require auth)
router.use(requireAuth);
router.post('/validate', validateDiscountCode);
router.post('/apply', applyDiscountCode);

// Admin routes
router.use(requireAdmin);
router.post('/', createDiscountCode);
router.get('/', getDiscountCodes);

module.exports = router; // ✅ Make sure this line exists