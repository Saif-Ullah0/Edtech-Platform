// backend/src/middlewares/requireAuth.js
const jwt = require('jsonwebtoken');
const prisma = require('../../prisma/client');

const requireAuth = async (req, res, next) => {
  console.log('🔍 BACKEND requireAuth: Middleware called');
  console.log('🔍 BACKEND requireAuth: Request URL:', req.url);
  console.log('🔍 BACKEND requireAuth: Request method:', req.method);

  try {
    let token;

    // 🆕 FIXED: Check both Authorization header and cookies
    const authHeader = req.headers.authorization;
    
    if (authHeader && authHeader.startsWith('Bearer ')) {
      // Extract token from Authorization header
      token = authHeader.substring(7); // Remove 'Bearer ' prefix
      console.log('🔍 BACKEND requireAuth: Token found in Authorization header');
    } else if (req.cookies.token) {
      // Extract token from cookies (for browser requests)
      token = req.cookies.token;
      console.log('🔍 BACKEND requireAuth: Token found in cookies');
    }

    if (!token) {
      console.log('❌ BACKEND requireAuth: No token found in header or cookies');
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    console.log('🔍 BACKEND requireAuth: Token found:', token.substring(0, 20) + '...');

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('🔍 BACKEND requireAuth: Token decoded successfully:', decoded);

    // CHECK USER STATUS - Verify user is still active
    const user = await prisma.user.findUnique({
      where: { id: decoded.userId },
      select: {
        id: true,
        email: true,
        role: true,
        status: true
      }
    });

    if (!user) {
      console.log('❌ BACKEND requireAuth: User not found');
      return res.status(401).json({ error: 'User not found' });
    }

    if (user.status === 'BANNED') {
      console.log('❌ BACKEND requireAuth: User is banned');
      return res.status(403).json({ error: 'Account has been banned. Please contact support.' });
    }

    if (user.status === 'DELETED') {
      console.log('❌ BACKEND requireAuth: User is deleted');
      return res.status(403).json({ error: 'Account has been deactivated.' });
    }

    // Set user data on request object
    req.user = {
      userId: decoded.userId,
      id: decoded.userId,
      email: user.email,
      role: user.role,
      status: user.status
    };

    console.log('✅ BACKEND requireAuth: User authenticated:', req.user);
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