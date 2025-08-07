// backend/src/routes/bundleRoutes.js
// Comprehensive routes with debug logging to identify missing endpoints

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import middleware
const requireAuth = require('../middlewares/requireAuth');

// Import bundle controller functions
const {
  createBundle,
  getBundles,
  updateBundle,
  deleteBundle,
  getBundleById,
  getBundleAnalytics
} = require('../controllers/bundleController');

// Debug middleware to log all requests
router.use((req, res, next) => {
  console.log(`🔍 BUNDLE ROUTE DEBUG: ${req.method} ${req.originalUrl}`);
  console.log('🔍 Query params:', req.query);
  console.log('🔍 Body:', req.body);
  console.log('🔍 User:', req.user?.id);
  next();
});

// ===== DEBUG ROUTES =====
// GET /api/bundles/debug/auth - Test authentication
router.get('/debug/auth', requireAuth, (req, res) => {
  console.log('🔍 Auth debug route hit');
  console.log('🔍 User from auth:', req.user);
  
  res.json({
    message: 'Authentication working',
    user: req.user,
    timestamp: new Date().toISOString()
  });
});

// ===== ANALYTICS ROUTES =====
// GET /api/bundles/analytics - Get bundle analytics (must come FIRST before /:id)
router.get('/analytics', requireAuth, (req, res, next) => {
  console.log('🎯 Analytics route hit');
  getBundleAnalytics(req, res, next);
});

// ===== CREATION ROUTES (POST) =====
// POST /api/bundles/create/modules - Create module bundle
router.post('/create/modules', requireAuth, (req, res, next) => {
  console.log('🎯 Create module bundle via /create/modules');
  console.log('🎯 Request body:', req.body);
  
  // Map moduleIds to modules field and set type
  if (req.body.moduleIds) {
    req.body.modules = req.body.moduleIds;
    delete req.body.moduleIds;
  }
  req.body.type = 'MODULE';
  
  createBundle(req, res, next);
});

// POST /api/bundles/create/courses - Create course bundle  
router.post('/create/courses', requireAuth, (req, res, next) => {
  console.log('🎯 Create course bundle via /create/courses');
  console.log('🎯 Request body:', req.body);
  
  // Map courseIds to courses field and set type
  if (req.body.courseIds) {
    req.body.courses = req.body.courseIds;
    delete req.body.courseIds;
  }
  req.body.type = 'COURSE';
  
  createBundle(req, res, next);
});

// ===== USER-SPECIFIC ROUTES =====
// (my-bundles route moved above to come before /:id route)
// GET /api/bundles/create/modules - Get available modules for bundle creation
router.get('/create/modules', requireAuth, async (req, res) => {
  try {
    console.log('🎯 Get modules for bundle creation');
    const userId = req.user.id;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let whereClause = {
      isPublished: true,
      publishStatus: 'PUBLISHED'
    };

    // Admin sees all modules
    if (user.role !== 'ADMIN') {
      // Regular users see published modules only
      whereClause = {
        ...whereClause,
        // Add any additional filters for regular users
      };
    }

    const modules = await prisma.module.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        isFree: true,
        isPublished: true,
        publishStatus: true,
        type: true
      },
      orderBy: { title: 'asc' }
    });

    console.log('✅ Found modules:', modules.length);
    res.json({ modules });

  } catch (error) {
    console.error('❌ Get modules error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch modules', 
      details: error.message 
    });
  }
});

// GET /api/bundles/create/courses - Get available courses for bundle creation
router.get('/create/courses', requireAuth, async (req, res) => {
  try {
    console.log('🎯 Get courses for bundle creation');
    const userId = req.user.id;
    
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    let whereClause = {
      publishStatus: 'PUBLISHED',
      isDeleted: false
    };

    const courses = await prisma.course.findMany({
      where: whereClause,
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        imageUrl: true,
        publishStatus: true,
        isPaid: true
      },
      orderBy: { title: 'asc' }
    });

    console.log('✅ Found courses:', courses.length);
    res.json({ courses });

  } catch (error) {
    console.error('❌ Get courses error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch courses', 
      details: error.message 
    });
  }
});

// ===== MARKETPLACE ROUTES =====
// GET /api/bundles/marketplace - Public bundles for marketplace
router.get('/marketplace', requireAuth, async (req, res) => {
  try {
    console.log('🎯 Get marketplace bundles');
    
    const bundles = await prisma.bundle.findMany({
      where: {
        isPublic: true,
        isActive: true
      },
      include: {
        user: {
          select: { id: true, name: true, role: true }
        },
        _count: {
          select: {
            moduleItems: true,
            courseItems: true
          }
        }
      },
      orderBy: [
        { isFeatured: 'desc' },
        { isPopular: 'desc' },
        { salesCount: 'desc' }
      ]
    });

    console.log('✅ Found marketplace bundles:', bundles.length);
    res.json({ bundles });

  } catch (error) {
    console.error('❌ Get marketplace bundles error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch marketplace bundles',
      details: error.message
    });
  }
});

// GET /api/bundles/featured - Featured bundles
router.get('/featured', requireAuth, async (req, res) => {
  try {
    console.log('🎯 Get featured bundles');
    
    const bundles = await prisma.bundle.findMany({
      where: {
        isPublic: true,
        isActive: true,
        isFeatured: true
      },
      include: {
        user: {
          select: { id: true, name: true, role: true }
        },
        _count: {
          select: {
            moduleItems: true,
            courseItems: true
          }
        }
      },
      orderBy: { salesCount: 'desc' },
      take: 10
    });

    console.log('✅ Found featured bundles:', bundles.length);
    res.json({ bundles });

  } catch (error) {
    console.error('❌ Get featured bundles error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch featured bundles',
      details: error.message 
    });
  }
});

// ===== MAIN BUNDLE CRUD ROUTES =====
// GET /api/bundles/my-bundles - Get current user's bundles (must come before /:id)
router.get('/my-bundles', requireAuth, (req, res, next) => {
  console.log('🎯 Get my bundles route hit');
  console.log('🎯 Query params:', req.query);
  
  // Set view to 'my' and pass to getBundles
  req.query.view = 'my';
  getBundles(req, res, next);
});

// GET /api/bundles - Get all bundles with filters
router.get('/', requireAuth, (req, res, next) => {
  console.log('🎯 Get all bundles route hit');
  console.log('🎯 Query params:', req.query);
  getBundles(req, res, next);
});

// GET /api/bundles/:id - Get single bundle by ID (must come after specific routes)
router.get('/:id', requireAuth, (req, res, next) => {
  console.log('🎯 Get bundle by ID route hit:', req.params.id);
  getBundleById(req, res, next);
});

// POST /api/bundles - Create new bundle
router.post('/', requireAuth, (req, res, next) => {
  console.log('🎯 Create bundle route hit');
  console.log('🎯 Request body:', req.body);
  createBundle(req, res, next);
});

// POST /api/bundles/create - Alternative create endpoint
router.post('/create', requireAuth, (req, res, next) => {
  console.log('🎯 Create bundle (alternative) route hit');
  console.log('🎯 Request body:', req.body);
  createBundle(req, res, next);
});

// POST /api/bundles/module - Create module bundle (specific endpoint)
router.post('/module', requireAuth, (req, res, next) => {
  console.log('🎯 Create module bundle route hit');
  // Ensure type is set to MODULE
  req.body.type = 'MODULE';
  createBundle(req, res, next);
});

// POST /api/bundles/course - Create course bundle (specific endpoint)
router.post('/course', requireAuth, (req, res, next) => {
  console.log('🎯 Create course bundle route hit');
  // Ensure type is set to COURSE
  req.body.type = 'COURSE';
  createBundle(req, res, next);
});

// PUT /api/bundles/:id - Update bundle
router.put('/:id', requireAuth, (req, res, next) => {
  console.log('🎯 Update bundle route hit:', req.params.id);
  console.log('🎯 Update data:', req.body);
  updateBundle(req, res, next);
});

// PATCH /api/bundles/:id - Alternative update endpoint
router.patch('/:id', requireAuth, (req, res, next) => {
  console.log('🎯 Patch bundle route hit:', req.params.id);
  updateBundle(req, res, next);
});

// DELETE /api/bundles/:id - Delete bundle
router.delete('/:id', requireAuth, (req, res, next) => {
  console.log('🎯 Delete bundle route hit:', req.params.id);
  deleteBundle(req, res, next);
});

// ===== ADDITIONAL COMMON ROUTES =====

// GET /api/bundles/user/:userId - Get bundles by user ID
router.get('/user/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const requestingUserId = req.user.id;
    
    console.log('🎯 Get bundles by user ID:', userId);

    // Check if requesting user can see these bundles
    let whereClause = { userId: parseInt(userId) };
    
    // If not the owner, only show public bundles
    if (parseInt(userId) !== requestingUserId) {
      whereClause.isPublic = true;
      whereClause.isActive = true;
    }

    const bundles = await prisma.bundle.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, name: true, role: true }
        },
        _count: {
          select: {
            moduleItems: true,
            courseItems: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    console.log('✅ Found user bundles:', bundles.length);
    res.json({ bundles });

  } catch (error) {
    console.error('❌ Get user bundles error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch user bundles',
      details: error.message 
    });
  }
});

// ===== CATCH-ALL DEBUG ROUTE =====
// This should be LAST to catch any unmatched routes
router.all('*', (req, res) => {
  console.log('❌ UNMATCHED BUNDLE ROUTE:', req.method, req.originalUrl);
  console.log('❌ Available routes: GET /debug/auth, GET /analytics, GET /create/modules, GET /create/courses, GET /marketplace, GET /featured, GET /my-bundles, GET /, GET /:id, POST /create/modules, POST /create/courses, POST /, POST /create, POST /module, POST /course, PUT /:id, DELETE /:id');
  
  res.status(404).json({
    error: 'Route not found',
    message: `The requested route ${req.originalUrl} does not exist`,
    method: req.method,
    availableRoutes: [
      'GET /api/bundles/debug/auth',
      'GET /api/bundles/analytics',
      'GET /api/bundles/create/modules', 
      'GET /api/bundles/create/courses',
      'GET /api/bundles/marketplace',
      'GET /api/bundles/featured',
      'GET /api/bundles/my-bundles',
      'GET /api/bundles',
      'GET /api/bundles/:id',
      'POST /api/bundles/create/modules',
      'POST /api/bundles/create/courses', 
      'POST /api/bundles',
      'POST /api/bundles/create',
      'POST /api/bundles/module',
      'POST /api/bundles/course',
      'PUT /api/bundles/:id',
      'DELETE /api/bundles/:id'
    ]
  });
});

module.exports = router;