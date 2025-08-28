const express = require('express');
const { register, login, logout, googleAuth, googleAuthCallback, facebookAuth, facebookAuthCallback } = require('../controllers/authController');

const router = express.Router();

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
router.get('/google', googleAuth);              // New: Google auth route
router.get('/google/callback', googleAuthCallback); // New: Google callback route
router.get('/facebook', facebookAuth);          // New: Facebook auth route
router.get('/facebook/callback', facebookAuthCallback); // New: Facebook callback route

module.exports = router;