const express = require('express');
const router = express.Router();
const requireAuth = require('../../middlewares/requireAuth');
const requireAdmin = require('../../middlewares/requireAdmin');
const { getAllEnrollments } = require('../../controllers/adminEnrollmentController');

router.get('/', requireAuth, requireAdmin, getAllEnrollments);

module.exports = router;
