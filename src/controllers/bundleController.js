const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper function to check if user is admin
const isUserAdmin = (user) => {
  return user && user.role === 'ADMIN';
};

// Get Bundle Analytics - FIXED endpoint
const getBundleAnalytics = async (req, res) => {
  try {
    console.log('🔍 getBundleAnalytics called for user:', req.user.id);

    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user.id;
    
    // Get user with role
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isAdmin = isUserAdmin(user);
    
    // Build where clause based on user role
    let whereClause = {};
    if (!isAdmin) {
      whereClause.userId = userId; // Non-admin sees only their bundles
    }

    // Get analytics data
    const [
      totalBundles,
      activeBundles,
      featuredBundles,
      popularBundles,
      bundleTypeStats,
      topBundles,
      recentPurchases
    ] = await Promise.all([
      prisma.bundle.count({ where: whereClause }),
      prisma.bundle.count({ where: { ...whereClause, isActive: true } }),
      prisma.bundle.count({ where: { ...whereClause, isFeatured: true } }),
      prisma.bundle.count({ where: { ...whereClause, isPopular: true } }),
      prisma.bundle.groupBy({
        by: ['type'],
        where: whereClause,
        _count: { id: true },
        _sum: { revenue: true, salesCount: true }
      }),
      prisma.bundle.findMany({
        where: { ...whereClause, salesCount: { gt: 0 } },
        orderBy: { salesCount: 'desc' },
        take: 5,
        select: { id: true, name: true, salesCount: true, revenue: true, viewCount: true }
      }),
      prisma.bundlePurchase.findMany({
        where: isAdmin ? {} : { bundle: { userId } },
        take: 5,
        orderBy: { createdAt: 'desc' },
        include: {
          bundle: { select: { id: true, name: true, type: true } },
          user: { select: { id: true, name: true, email: true } }
        }
      })
    ]);

    const totalSales = bundleTypeStats.reduce((sum, stat) => sum + (stat._sum.salesCount || 0), 0);
    const totalRevenue = bundleTypeStats.reduce((sum, stat) => sum + (stat._sum.revenue || 0), 0);

    const analytics = {
      overview: {
        totalBundles,
        activeBundles,
        featuredBundles,
        popularBundles,
        totalSales,
        totalRevenue
      },
      bundleTypeStats,
      topBundles,
      recentPurchases
    };

    console.log('✅ Analytics generated successfully');
    res.json({ 
      success: true,
      dashboard: analytics  // Frontend expects 'dashboard' property
    });

  } catch (error) {
    console.error('❌ Bundle analytics error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch bundle analytics',
      details: error.message
    });
  }
};

// Get My Bundles Analytics - For regular users
const getMyBundleAnalytics = async (req, res) => {
  try {
    console.log('🔍 getMyBundleAnalytics called for user:', req.user.id);

    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const userId = req.user.id;
    const whereClause = { userId };

    // Get user's bundle analytics
    const [
      totalBundles,
      activeBundles,
      featuredBundles,
      popularBundles,
      bundleTypeStats
    ] = await Promise.all([
      prisma.bundle.count({ where: whereClause }),
      prisma.bundle.count({ where: { ...whereClause, isActive: true } }),
      prisma.bundle.count({ where: { ...whereClause, isFeatured: true } }),
      prisma.bundle.count({ where: { ...whereClause, isPopular: true } }),
      prisma.bundle.groupBy({
        by: ['type'],
        where: whereClause,
        _count: { id: true },
        _sum: { revenue: true, salesCount: true, viewCount: true }
      })
    ]);

    const totalSales = bundleTypeStats.reduce((sum, stat) => sum + (stat._sum.salesCount || 0), 0);
    const totalRevenue = bundleTypeStats.reduce((sum, stat) => sum + (stat._sum.revenue || 0), 0);
    const totalViews = bundleTypeStats.reduce((sum, stat) => sum + (stat._sum.viewCount || 0), 0);

    const analytics = {
      overview: {
        totalBundles,
        activeBundles,
        featuredBundles,
        popularBundles,
        totalSales,
        totalRevenue,
        totalViews
      },
      bundleTypeStats
    };

    res.json({ 
      success: true,
      analytics
    });

  } catch (error) {
    console.error('❌ My bundle analytics error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch analytics',
      details: error.message
    });
  }
};

// Get Available Courses for Bundle Creation - SIMPLIFIED
const getAvailableCourses = async (req, res) => {
  try {
    console.log('🔍 getAvailableCourses called');

    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Get published courses only
    const courses = await prisma.course.findMany({
      where: {
        publishStatus: 'PUBLISHED',
        isDeleted: false
      },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        isPaid: true,        // Show if course is free or paid
        imageUrl: true,
        category: {
          select: { id: true, name: true }
        }
      },
      orderBy: { title: 'asc' }
    });

    console.log('✅ Found courses for bundle creation:', courses.length);
    res.json({ 
      success: true,
      courses 
    });

  } catch (error) {
    console.error('❌ Get available courses error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch available courses',
      details: error.message
    });
  }
};

// Create Course Bundle - SIMPLIFIED
const createCourseBundle = async (req, res) => {
  try {
    console.log('🔍 createCourseBundle called');
    console.log('🔍 Request body:', req.body);

    if (!req.user || !req.user.id) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const { name, description, courseIds, isPublic, discount } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!name || !courseIds || !Array.isArray(courseIds) || courseIds.length === 0) {
      return res.status(400).json({ 
        error: 'Bundle name and at least one course are required' 
      });
    }

    // Get user permissions
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true, role: true, canCreatePublicBundles: true }
    });

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    // Check public bundle creation permissions
    if (isPublic && !user.canCreatePublicBundles && !isUserAdmin(user)) {
      return res.status(403).json({ 
        error: 'You do not have permission to create public bundles' 
      });
    }

    // Validate courses exist and calculate pricing
    const courses = await prisma.course.findMany({
      where: { 
        id: { in: courseIds.map(id => parseInt(id)) },
        publishStatus: 'PUBLISHED',
        isDeleted: false
      },
      select: { id: true, title: true, price: true, isPaid: true }
    });

    if (courses.length !== courseIds.length) {
      return res.status(400).json({ 
        error: 'Some courses were not found or are not published' 
      });
    }

    // Calculate total price (only paid courses)
    const totalPrice = courses
      .filter(course => course.isPaid)
      .reduce((sum, course) => sum + course.price, 0);

    // Apply discount
    const discountAmount = Math.max(0, Math.min(100, discount || 0));
    const finalPrice = totalPrice * (1 - discountAmount / 100);

    console.log('🔍 Pricing calculated:', { totalPrice, discountAmount, finalPrice });

    // Create the bundle
    const bundle = await prisma.bundle.create({
      data: {
        name: name.trim(),
        description: description?.trim() || null,
        userId,
        type: 'COURSE',
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
      }
    });

    // Add courses to bundle
    const courseBundleItems = courseIds.map(courseId => ({
      bundleId: bundle.id,
      courseId: parseInt(courseId)
    }));

    await prisma.courseBundleItem.createMany({
      data: courseBundleItems
    });

    console.log('✅ Course bundle created successfully:', bundle.id);

    // Return complete bundle data
    const completeBundle = await prisma.bundle.findUnique({
      where: { id: bundle.id },
      include: {
        user: { select: { id: true, name: true, role: true } },
        courseItems: {
          include: {
            course: {
              select: { id: true, title: true, price: true, isPaid: true, category: { select: { name: true } } }
            }
          }
        }
      }
    });

    res.status(201).json({
      success: true,
      message: 'Course bundle created successfully',
      bundle: completeBundle
    });

  } catch (error) {
    console.error('❌ Course bundle creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create course bundle',
      details: error.message
    });
  }
};

module.exports = {
  getBundleAnalytics,
  getMyBundleAnalytics, 
  getAvailableCourses,
  createCourseBundle
};