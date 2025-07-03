const express = require('express');
const requireAuth = require('../middlewares/requireAuth');
const { user } = require('../../prisma/client');
const router = express.Router();

router.get('/me', requireAuth, (req, res) => {
  res.json({
    message : 'Protected route accessed successfully',
    user : req.user
  });
});

module.exports = router;
