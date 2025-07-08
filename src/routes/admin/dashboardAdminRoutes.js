const express = require('express');
const router = express.Router();
const requireAuth = require('../../middlewares/requireAuth');
const requireAdmin = require('../../middlewares/requireAdmin');
const { getDashboardSummary } = require('../../controllers/adminDashboardController');

router.get('/summary', requireAuth, requireAdmin, getDashboardSummary);

module.exports = router;
