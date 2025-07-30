const jwt = require('jsonwebtoken');
const prisma = require('../../prisma/client'); // 🆕 Added prisma import

const requireAuth = async (req, res, next) => { // 🆕 Made async
  console.log('🔍 BACKEND requireAuth: Middleware called');
  console.log('🔍 BACKEND requireAuth: Request URL:', req.url);
  console.log('🔍 BACKEND requireAuth: Request method:', req.method);

  try {
    const token = req.cookies.token;

    if (!token) {
      console.log('❌ BACKEND requireAuth: No token found');
      return res.status(401).json({ error: 'Access denied. No token provided.' });
    }

    console.log('🔍 BACKEND requireAuth: Token found:', token.substring(0, 20) + '...');

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    console.log('🔍 BACKEND requireAuth: Token decoded successfully:', decoded);

    // 🆕 CHECK USER STATUS - Verify user is still active
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
      email: user.email,    // 🆕 Use fresh data from DB
      role: user.role,      // 🆕 Use fresh data from DB
      status: user.status   // 🆕 Include status
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