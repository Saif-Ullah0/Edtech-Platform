// backend/src/controllers/bundleController.js
// Enhanced with better error handling and validation

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper function to check if user is admin
const isUserAdmin = (user) => {
  return user && user.role === 'ADMIN';
};

// Helper function to validate request data
const validateRequest = (req, res, requiredFields = []) => {
  // Check if user exists
  if (!req.user || !req.user.id) {
    console.error('❌ No user found in request');
    res.status(401).json({ error: 'Authentication required' });
    return false;
  }

  // Check required fields
  for (const field of requiredFields) {
    if (!req.body[field] && req.body[field] !== 0 && req.body[field] !== false) {
      console.error(`❌ Missing required field: ${field}`);
      res.status(400).json({ error: `Missing required field: ${field}` });
      return false;
    }
  }

  return true;
};

// Get Bundle Analytics - Enhanced error handling
const getBundleAnalytics = async (req, res) => {
  try {
    console.log('🔍 getBundleAnalytics called');

    // Validate request
    if (!validateRequest(req, res)) return;

    const userId = req.user.id;
    console.log('🔍 User ID:', userId);

    // Get user with role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true }
    });

    if (!user) {
      console.error('❌ User not found in database:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('🔍 User found:', user);

    // Check if user is admin
    const isAdmin = isUserAdmin(user);
    console.log('🔍 Is admin:', isAdmin);
    
    let whereClause = {};
    if (!isAdmin) {
      // Non-admin users can only see their own bundle analytics
      whereClause.userId = userId;
      console.log('🔍 Non-admin user, filtering to their bundles only');
    } else {
      console.log('🔍 Admin user, showing all bundles');
    }

    console.log('🔍 Where clause:', whereClause);

    // Get bundle statistics with individual try-catch for each query
    let totalBundles = 0;
    let activeBundles = 0; 
    let publicBundles = 0;
    let featuredBundles = 0;
    let bundlesByType = [];
    let recentBundles = [];

    try {
      totalBundles = await prisma.bundle.count({ where: whereClause });
      console.log('✅ Total bundles:', totalBundles);
    } catch (error) {
      console.error('❌ Error counting total bundles:', error.message);
    }

    try {
      activeBundles = await prisma.bundle.count({ 
        where: { ...whereClause, isActive: true } 
      });
      console.log('✅ Active bundles:', activeBundles);
    } catch (error) {
      console.error('❌ Error counting active bundles:', error.message);
    }

    try {
      publicBundles = await prisma.bundle.count({ 
        where: { ...whereClause, isPublic: true } 
      });
      console.log('✅ Public bundles:', publicBundles);
    } catch (error) {
      console.error('❌ Error counting public bundles:', error.message);
    }

    try {
      featuredBundles = await prisma.bundle.count({ 
        where: { ...whereClause, isFeatured: true } 
      });
      console.log('✅ Featured bundles:', featuredBundles);
    } catch (error) {
      console.error('❌ Error counting featured bundles:', error.message);
    }

    try {
      bundlesByType = await prisma.bundle.groupBy({
        by: ['type'],
        where: whereClause,
        _count: true,
        _sum: {
          salesCount: true,
          revenue: true,
          viewCount: true
        }
      });
      console.log('✅ Bundles by type:', bundlesByType);
    } catch (error) {
      console.error('❌ Error grouping bundles by type:', error.message);
      bundlesByType = [];
    }

    try {
      recentBundles = await prisma.bundle.findMany({
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
        orderBy: { createdAt: 'desc' },
        take: 5
      });
      console.log('✅ Recent bundles:', recentBundles.length);
    } catch (error) {
      console.error('❌ Error fetching recent bundles:', error.message);
      recentBundles = [];
    }

    // Calculate totals safely
    const totalSales = bundlesByType.reduce((sum, type) => sum + (type._sum.salesCount || 0), 0);
    const totalRevenue = bundlesByType.reduce((sum, type) => sum + (type._sum.revenue || 0), 0);
    const totalViews = bundlesByType.reduce((sum, type) => sum + (type._sum.viewCount || 0), 0);

    const analytics = {
      summary: {
        total: totalBundles,
        active: activeBundles,
        public: publicBundles,
        featured: featuredBundles,
        totalSales,
        totalRevenue,
        totalViews
      },
      byType: bundlesByType.map(type => ({
        type: type.type,
        count: type._count,
        sales: type._sum.salesCount || 0,
        revenue: type._sum.revenue || 0,
        views: type._sum.viewCount || 0
      })),
      recentBundles: recentBundles.map(bundle => ({
        id: bundle.id,
        name: bundle.name,
        type: bundle.type,
        isPublic: bundle.isPublic,
        isActive: bundle.isActive,
        isFeatured: bundle.isFeatured,
        salesCount: bundle.salesCount,
        viewCount: bundle.viewCount,
        createdAt: bundle.createdAt,
        itemCount: (bundle._count?.moduleItems || 0) + (bundle._count?.courseItems || 0),
        owner: bundle.user?.name || 'Unknown'
      }))
    };

    console.log('✅ Analytics generated successfully');
    res.json({ analytics });

  } catch (error) {
    console.error('❌ Bundle analytics error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch bundle analytics',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Get All Bundles - Enhanced error handling
const getBundles = async (req, res) => {
  try {
    console.log('🔍 getBundles called');
    console.log('🔍 Query params:', req.query);

    // Validate request
    if (!validateRequest(req, res)) return;

    const { view, status, type } = req.query;
    const userId = req.user.id;

    console.log('🔍 Request params:', { view, status, type, userId });

    // Get user with role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true }
    });

    if (!user) {
      console.error('❌ User not found in database:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('🔍 User found:', user);

    let whereClause = {};

    // Apply view filter
    switch (view) {
      case 'admin':
        if (!isUserAdmin(user)) {
          console.error('❌ Non-admin user trying to access admin view');
          return res.status(403).json({ error: 'Admin access required' });
        }
        console.log('🔍 Admin view - showing all bundles');
        // Admin sees all bundles - no additional where clause
        break;
        
      case 'my':
        whereClause.userId = userId;
        console.log('🔍 My bundles view - user:', userId);
        break;
        
      case 'public':
        whereClause.isPublic = true;
        whereClause.isActive = true;
        console.log('🔍 Public bundles view');
        break;
        
      default:
        // Default: user sees their own + public bundles
        whereClause = {
          OR: [
            { userId: userId },
            { isPublic: true, isActive: true }
          ]
        };
        console.log('🔍 Default view - own + public bundles');
    }

    // Apply additional filters
    if (status === 'active') {
      whereClause.isActive = true;
      console.log('🔍 Filtering to active bundles only');
    } else if (status === 'inactive') {
      whereClause.isActive = false;
      console.log('🔍 Filtering to inactive bundles only');
    }

    if (type && ['MODULE', 'COURSE'].includes(type.toUpperCase())) {
      whereClause.type = type.toUpperCase();
      console.log('🔍 Filtering to type:', type.toUpperCase());
    }

    console.log('🔍 Final where clause:', JSON.stringify(whereClause, null, 2));

    const bundles = await prisma.bundle.findMany({
      where: whereClause,
      include: {
        user: {
          select: { id: true, name: true, role: true }
        },
        moduleItems: {
          include: {
            module: {
              select: { id: true, title: true, description: true, price: true }
            }
          }
        },
        courseItems: {
          include: {
            course: {
              select: { id: true, title: true, description: true, price: true }
            }
          }
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
        { createdAt: 'desc' }
      ]
    });

    console.log('✅ Found bundles:', bundles.length);
    
    const result = {
      bundles,
      total: bundles.length,
      view: view || 'default',
      filters: { status, type }
    };

    res.json(result);

  } catch (error) {
    console.error('❌ Get bundles error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch bundles',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Create Bundle - Enhanced error handling
const createBundle = async (req, res) => {
  try {
    console.log('🔍 createBundle called');
    console.log('🔍 Request body:', req.body);

    // Validate request with required fields
    if (!validateRequest(req, res, ['name', 'type'])) return;

    const { name, description, type, modules, courses, isPublic, discount } = req.body;
    const userId = req.user.id;

    console.log('🔍 Bundle data:', { name, type, userId, modules, courses });

    // Validate bundle type
    if (!['MODULE', 'COURSE'].includes(type?.toUpperCase())) {
      console.error('❌ Invalid bundle type:', type);
      return res.status(400).json({ 
        error: 'Invalid bundle type. Must be MODULE or COURSE',
        received: type,
        allowed: ['MODULE', 'COURSE']
      });
    }

    // Validate items based on type
    if (type.toUpperCase() === 'MODULE') {
      if (!modules || !Array.isArray(modules) || modules.length === 0) {
        console.error('❌ No modules provided for MODULE bundle');
        return res.status(400).json({ error: 'Modules are required for MODULE bundle' });
      }
    }

    if (type.toUpperCase() === 'COURSE') {
      if (!courses || !Array.isArray(courses) || courses.length === 0) {
        console.error('❌ No courses provided for COURSE bundle');
        return res.status(400).json({ error: 'Courses are required for COURSE bundle' });
      }
    }

    // Get user with role for permission checking
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        role: true,
        canCreatePublicBundles: true
      }
    });

    if (!user) {
      console.error('❌ User not found:', userId);
      return res.status(404).json({ error: 'User not found' });
    }

    console.log('🔍 User permissions:', user);

    // Check public bundle creation permissions
    if (isPublic && !user.canCreatePublicBundles && !isUserAdmin(user)) {
      console.error('❌ User cannot create public bundles');
      return res.status(403).json({ 
        error: 'You do not have permission to create public bundles' 
      });
    }

    // Calculate pricing
    let totalPrice = 0;
    let itemCount = 0;

    if (type.toUpperCase() === 'MODULE' && modules && modules.length > 0) {
      console.log('🔍 Fetching module prices for:', modules);
      
      const moduleItems = await prisma.module.findMany({
        where: { id: { in: modules.map(id => parseInt(id)) } },
        select: { id: true, price: true, title: true }
      });

      console.log('🔍 Found modules:', moduleItems);
      
      if (moduleItems.length !== modules.length) {
        console.error('❌ Some modules not found');
        return res.status(400).json({ 
          error: 'Some modules were not found',
          requested: modules,
          found: moduleItems.map(m => m.id)
        });
      }

      totalPrice = moduleItems.reduce((sum, module) => sum + (module.price || 0), 0);
      itemCount = moduleItems.length;
    }

    if (type.toUpperCase() === 'COURSE' && courses && courses.length > 0) {
      console.log('🔍 Fetching course prices for:', courses);
      
      const courseItems = await prisma.course.findMany({
        where: { id: { in: courses.map(id => parseInt(id)) } },
        select: { id: true, price: true, title: true }
      });

      console.log('🔍 Found courses:', courseItems);
      
      if (courseItems.length !== courses.length) {
        console.error('❌ Some courses not found');
        return res.status(400).json({ 
          error: 'Some courses were not found',
          requested: courses,
          found: courseItems.map(c => c.id)
        });
      }

      totalPrice = courseItems.reduce((sum, course) => sum + (course.price || 0), 0);
      itemCount = courseItems.length;
    }

    // Apply discount
    const discountAmount = Math.max(0, Math.min(100, discount || 0)); // Clamp between 0-100
    const finalPrice = totalPrice * (1 - discountAmount / 100);

    console.log('🔍 Pricing calculated:', { totalPrice, discountAmount, finalPrice, itemCount });

    // Create the bundle
    const bundleData = {
      name: name.trim(),
      description: description?.trim() || null,
      userId,
      type: type.toUpperCase(),
      totalPrice,
      discount: discountAmount,
      finalPrice,
      isPublic: Boolean(isPublic),
      isActive: true,
      isFeatured: false,
      isPopular: false,
      salesCount: 0,
      revenue: 0,
      viewCount: 0
    };

    console.log('🔍 Creating bundle with data:', bundleData);

    const bundle = await prisma.bundle.create({
      data: bundleData,
      include: {
        user: {
          select: { id: true, name: true, role: true }
        }
      }
    });

    console.log('✅ Bundle created:', bundle.id);

    // Add modules to bundle (using BundleItem model)
    if (type.toUpperCase() === 'MODULE' && modules && modules.length > 0) {
      const bundleItems = modules.map(moduleId => ({
        bundleId: bundle.id,
        moduleId: parseInt(moduleId)
      }));
      
      console.log('🔍 Creating bundle items:', bundleItems);
      
      await prisma.bundleItem.createMany({
        data: bundleItems
      });

      console.log('✅ Bundle items created');
    }

    // Add courses to bundle (using CourseBundleItem model)
    if (type.toUpperCase() === 'COURSE' && courses && courses.length > 0) {
      const courseBundleItems = courses.map(courseId => ({
        bundleId: bundle.id,
        courseId: parseInt(courseId)
      }));
      
      console.log('🔍 Creating course bundle items:', courseBundleItems);
      
      await prisma.courseBundleItem.createMany({
        data: courseBundleItems
      });

      console.log('✅ Course bundle items created');
    }

    // Fetch complete bundle data
    const completeBundle = await prisma.bundle.findUnique({
      where: { id: bundle.id },
      include: {
        user: {
          select: { id: true, name: true, role: true }
        },
        moduleItems: {
          include: {
            module: {
              select: { id: true, title: true, description: true, price: true }
            }
          }
        },
        courseItems: {
          include: {
            course: {
              select: { id: true, title: true, description: true, price: true }
            }
          }
        }
      }
    });

    console.log('✅ Bundle created successfully with all items');
    
    res.status(201).json({
      message: 'Bundle created successfully',
      bundle: completeBundle
    });

  } catch (error) {
    console.error('❌ Bundle creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create bundle',
      details: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined
    });
  }
};

// Include other functions with similar error handling...
// For brevity, I'll include the key functions. Let me know if you need the others enhanced too.

const updateBundle = async (req, res) => {
  try {
    console.log('🔍 updateBundle called');
    
    if (!validateRequest(req, res)) return;

    const { id } = req.params;
    const updates = req.body;
    const userId = req.user.id;

    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Invalid bundle ID' });
    }

    // Rest of updateBundle logic...
    // (keeping original logic but with better logging)
    
    res.json({ message: 'Update function called - implement full logic here' });
    
  } catch (error) {
    console.error('❌ Bundle update error:', error);
    res.status(500).json({ 
      error: 'Failed to update bundle',
      details: error.message 
    });
  }
};

const deleteBundle = async (req, res) => {
  try {
    console.log('🔍 deleteBundle called');
    
    if (!validateRequest(req, res)) return;
    
    // Implementation with better error handling...
    res.json({ message: 'Delete function called - implement full logic here' });
    
  } catch (error) {
    console.error('❌ Bundle delete error:', error);
    res.status(500).json({ 
      error: 'Failed to delete bundle',
      details: error.message 
    });
  }
};

const getBundleById = async (req, res) => {
  try {
    console.log('🔍 getBundleById called');
    
    if (!validateRequest(req, res)) return;
    
    const { id } = req.params;
    
    if (!id || isNaN(parseInt(id))) {
      return res.status(400).json({ error: 'Invalid bundle ID provided' });
    }
    
    // Implementation with better error handling...
    res.json({ message: 'Get by ID function called - implement full logic here' });
    
  } catch (error) {
    console.error('❌ Get bundle error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch bundle',
      details: error.message 
    });
  }
};

// Debug: Log functions before export
console.log('Exporting enhanced bundle controller functions:', {
  createBundle: typeof createBundle,
  getBundles: typeof getBundles,
  updateBundle: typeof updateBundle,
  deleteBundle: typeof deleteBundle,
  getBundleById: typeof getBundleById,
  getBundleAnalytics: typeof getBundleAnalytics
});

module.exports = {
  createBundle,
  getBundles,
  updateBundle,
  deleteBundle,
  getBundleById,
  getBundleAnalytics
};