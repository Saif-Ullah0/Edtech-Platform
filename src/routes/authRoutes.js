const express = require('express');
const router = express.Router();
const { register,login,logout,  } = require('../controllers/authController');
const requireAuth = require('../middlewares/requireAuth');

router.post('/register', register);
router.post('/login', login);
router.post('/logout', logout);
//router.get('/me', requireAuth, getCurrentUser);

module.exports = router;
