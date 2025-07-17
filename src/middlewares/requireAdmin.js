// backend/src/middlewares/requireAdmin.js
const requireAdmin = (req, res, next) => {
  console.log('🔍 BACKEND requireAdmin: Middleware called');
  console.log('🔍 BACKEND requireAdmin: Request URL:', req.url);
  console.log('🔍 BACKEND requireAdmin: User from request:', req.user);

  // Check if user exists and has admin role
  if (!req.user) {
    console.log('❌ BACKEND requireAdmin: No user found on request');
    return res.status(401).json({ error: 'Access denied. User not authenticated.' });
  }

  // ✅ Check role from token payload
  const userRole = req.user.role;
  console.log('🔍 BACKEND requireAdmin: User role:', userRole);

  if (userRole !== 'ADMIN') {
    console.log('❌ BACKEND requireAdmin: User is not admin. Role:', userRole);
    return res.status(403).json({ error: 'Access denied. Admin privileges required.' });
  }

  console.log('✅ BACKEND requireAdmin: User is admin, proceeding...');
  next();
};

module.exports = requireAdmin;