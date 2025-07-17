// backend/src/middlewares/requireAuth.js
const jwt = require('jsonwebtoken');

const requireAuth = (req, res, next) => {
  console.log('🔍 BACKEND requireAuth: Middleware called');
  console.log('🔍 BACKEND requireAuth: Request URL:', req.url);
  console.log('🔍 BACKEND requireAuth: Request method:', req.method);
  console.log('🔍 BACKEND requireAuth: All cookies:', req.cookies);

  try {
    const token = req.cookies.token;

    if (!token) {
      console.log('❌ BACKEND requireAuth: No token found');
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    console.log('🔍 BACKEND requireAuth: Token found:', token.substring(0, 20) + '...');
    console.log('🔍 BACKEND requireAuth: About to verify token...');

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    
    console.log('🔍 BACKEND requireAuth: Token decoded successfully:', decoded);

    // ✅ Set user data on request object with correct structure
    req.user = {
      userId: decoded.userId,  // ✅ Use userId from token
      id: decoded.userId,      // ✅ Also set as id for compatibility
      email: decoded.email,
      role: decoded.role
    };

    console.log('✅ BACKEND requireAuth: User set on request:', req.user);
    next();

  } catch (error) {
    console.log('❌ BACKEND requireAuth: Token verification failed:', error.message);
    
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    
    return res.status(401).json({ error: 'Token verification failed' });
  }
};

module.exports = requireAuth;