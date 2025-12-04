// backend/src/controllers/bundleController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Helper function to check if user is admin
const isUserAdmin = (user) => {
  return user && user.role === 'ADMIN';
};

// Helper function to calculate bundle pricing
const calculateBundlePricing = (items, type, discount = 0) => {
  let totalPrice = 0;
  
  if (type === 'COURSE') {
    totalPrice = items.reduce((sum, item) => {
      return sum + (item.isPaid ? item.price : 0);
    }, 0);
  } else {
    totalPrice = items.reduce((sum, item) => {
      return sum + (!item.isFree ? item.price : 0);
    }, 0);
  }
  
  const discountAmount = Math.max(0, Math.min(100, discount || 0));
  const finalPrice = totalPrice * (1 - discountAmount / 100);
  
  return { totalPrice, finalPrice, discountAmount };
};

// Get Bundle Analytics (Admin & User)
const getBundleAnalytics = async (req, res) => {
  try {
    const userId = req.user.id;
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

    const [
      totalBundles,
      activeBundles,
      featuredBundles,
      popularBundles,
      bundleTypeStats,
      topBundles
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
        select: { id: true, name: true, salesCount: true, revenue: true, viewCount: true, type: true }
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
      topBundles
    };

    res.json({ 
      success: true,
      dashboard: analytics
    });

  } catch (error) {
    console.error('❌ Bundle analytics error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch bundle analytics',
      details: error.message
    });
  }
};

// Get Available Courses for Bundle Creation
const getAvailableCourses = async (req, res) => {
  try {
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
        isPaid: true,
        imageUrl: true,
        category: {
          select: { id: true, name: true }
        }
      },
      orderBy: { title: 'asc' }
    });

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

// Get Available Modules for Bundle Creation
const getAvailableModules = async (req, res) => {
  try {
    const modules = await prisma.module.findMany({
      where: {
        publishStatus: 'PUBLISHED'
      },
      select: {
        id: true,
        title: true,
        description: true,
        price: true,
        isFree: true,
        course: {
          select: {
            id: true,
            title: true,
            category: { select: { name: true } }
          }
        }
      },
      orderBy: { title: 'asc' }
    });

    res.json({ 
      success: true,
      modules
    });

  } catch (error) {
    console.error('❌ Get available modules error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch available modules',
      details: error.message
    });
  }
};

// Create Bundle (Course or Module)
const createBundle = async (req, res) => {
  try {
    const { name, description, type, itemIds, isPublic, discount } = req.body;
    const userId = req.user.id;

    // Validate required fields
    if (!name || !type || !itemIds || !Array.isArray(itemIds) || itemIds.length === 0) {
      return res.status(400).json({ 
        error: 'Bundle name, type, and at least one item are required' 
      });
    }

    if (!['COURSE', 'MODULE'].includes(type)) {
      return res.status(400).json({ error: 'Invalid bundle type' });
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

    let items = [];
    
    // Validate items based on type
    if (type === 'COURSE') {
      items = await prisma.course.findMany({
        where: { 
          id: { in: itemIds.map(id => parseInt(id)) },
          publishStatus: 'PUBLISHED',
          isDeleted: false
        },
        select: { id: true, title: true, price: true, isPaid: true }
      });
    } else {
      items = await prisma.module.findMany({
        where: { 
          id: { in: itemIds.map(id => parseInt(id)) },
          publishStatus: 'PUBLISHED'
        },
        select: { id: true, title: true, price: true, isFree: true }
      });
    }

    if (items.length !== itemIds.length) {
      return res.status(400).json({ 
        error: 'Some items were not found or are not published' 
      });
    }

    // Calculate pricing
    const { totalPrice, finalPrice, discountAmount } = calculateBundlePricing(items, type, discount);

    // Create the bundle with transaction
    const result = await prisma.$transaction(async (tx) => {
      // Create the bundle
      const bundle = await tx.bundle.create({
        data: {
          name: name.trim(),
          description: description?.trim() || null,
          userId,
          type,
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

      // Add items to bundle
      if (type === 'COURSE') {
        const courseBundleItems = itemIds.map(courseId => ({
          bundleId: bundle.id,
          courseId: parseInt(courseId)
        }));

        await tx.courseBundleItem.createMany({
          data: courseBundleItems
        });
      } else {
        const moduleBundleItems = itemIds.map(moduleId => ({
          bundleId: bundle.id,
          moduleId: parseInt(moduleId)
        }));

        await tx.bundleItem.createMany({
          data: moduleBundleItems
        });
      }

      return bundle;
    });

    console.log('✅ Bundle created successfully:', result.id);

    res.status(201).json({
      success: true,
      message: 'Bundle created successfully',
      bundle: result
    });

  } catch (error) {
    console.error('❌ Bundle creation error:', error);
    res.status(500).json({ 
      error: 'Failed to create bundle',
      details: error.message
    });
  }
};

// Get All Bundles (Admin and User)
const getBundles = async (req, res) => {
  try {
    const userId = req.user?.id;
    const { page = 1, limit = 20, type, status, search, isAdmin } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let whereClause = {};
    
    // Check if user is admin
    const user = userId ? await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    }) : null;
    
    const userIsAdmin = user && isUserAdmin(user);
    
    // Filter based on user role
    if (!userIsAdmin) {
      if (isAdmin === 'true') {
        // Regular users can't access admin view
        return res.status(403).json({ error: 'Admin access required' });
      }
      // Regular users see only public active bundles or their own
      whereClause = {
        OR: [
          { isPublic: true, isActive: true },
          ...(userId ? [{ userId }] : [])
        ]
      };
    }
    
    // Apply filters
    if (type && type !== 'all') whereClause.type = type.toUpperCase();
    
    if (status && status !== 'all') {
      switch (status) {
        case 'active': whereClause.isActive = true; break;
        case 'inactive': whereClause.isActive = false; break;
        case 'featured': whereClause.isFeatured = true; break;
        case 'popular': whereClause.isPopular = true; break;
        case 'public': whereClause.isPublic = true; break;
        case 'private': whereClause.isPublic = false; break;
      }
    }
    
    // Search filter
    if (search && search.trim()) {
      whereClause.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } }
      ];
    }

    const [bundles, totalCount] = await Promise.all([
      prisma.bundle.findMany({
        where: whereClause,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          courseItems: {
            include: {
              course: { 
                select: { 
                  id: true, 
                  title: true, 
                  price: true,
                  isPaid: true,
                  category: { select: { name: true } }
                } 
              }
            }
          },
          moduleItems: {
            include: {
              module: { 
                select: { 
                  id: true, 
                  title: true, 
                  price: true,
                  isFree: true,
                  course: { select: { title: true, category: { select: { name: true } } } }
                } 
              }
            }
          }
        },
        orderBy: [
          { isFeatured: 'desc' },
          { salesCount: 'desc' },
          { createdAt: 'desc' }
        ],
        skip,
        take: parseInt(limit)
      }),
      prisma.bundle.count({ where: whereClause })
    ]);

    // Enhance bundles with calculated fields
    const enhancedBundles = bundles.map(bundle => {
      let totalItems = 0;
      let individualTotal = 0;

      if (bundle.type === 'COURSE') {
        totalItems = bundle.courseItems.length;
        individualTotal = bundle.courseItems.reduce((sum, item) => {
          return sum + (item.course.isPaid ? item.course.price : 0);
        }, 0);
      } else {
        totalItems = bundle.moduleItems.length;
        individualTotal = bundle.moduleItems.reduce((sum, item) => {
          return sum + (!item.module.isFree ? item.module.price : 0);
        }, 0);
      }

      const savings = individualTotal - bundle.finalPrice;
      const savingsPercentage = individualTotal > 0 ? Math.round((savings / individualTotal) * 100) : 0;

      return {
        ...bundle,
        totalItems,
        individualTotal,
        savings,
        savingsPercentage,
        canEdit: userIsAdmin || bundle.userId === userId,
        canDelete: (userIsAdmin || bundle.userId === userId) && bundle.salesCount === 0
      };
    });

    res.json({
      success: true,
      bundles: enhancedBundles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: totalCount,
        pages: Math.ceil(totalCount / parseInt(limit))
      }
    });

  } catch (error) {
    console.error('❌ Get bundles error:', error);
    res.status(500).json({ error: 'Failed to fetch bundles' });
  }
};

// Get Single Bundle Details
// Get Single Bundle Details (hardened)
const getBundleById = async (req, res) => {
  try {
    console.log('⚙️ getBundleById - req.params:', req.params);

    const { bundleId } = req.params;
    if (!bundleId) {
      return res.status(400).json({ error: 'bundleId param is required' });
    }

    const bundleIdNum = Number(bundleId);
    if (!Number.isInteger(bundleIdNum) || bundleIdNum <= 0) {
      return res.status(400).json({ error: 'Invalid bundleId parameter' });
    }

    const userId = req.user?.id ?? null;

    const bundle = await prisma.bundle.findUnique({
      where: { id: bundleIdNum },
      include: {
        user: { select: { id: true, name: true, email: true, role: true } },
        courseItems: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
                description: true,
                price: true,
                isPaid: true,
                imageUrl: true,
                category: { select: { name: true } },
                // keep modules shallow to avoid huge payloads
                modules: {
                  select: {
                    id: true,
                    title: true
                  }
                }
              }
            }
          }
        },
        moduleItems: {
          include: {
            module: {
              select: {
                id: true,
                title: true,
                description: true,
                price: true,
                isFree: true,
                course: { select: { id: true, title: true, imageUrl: true } }
              }
            }
          }
        },
        purchases: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: { user: { select: { id: true, name: true } } }
        }
      }
    });

    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    // permission checks
    const user = userId
      ? await prisma.user.findUnique({ where: { id: userId }, select: { role: true } })
      : null;
    const userIsAdmin = user && isUserAdmin(user);
    const isOwner = bundle.userId === userId;

    if (!bundle.isPublic && !userIsAdmin && !isOwner) {
      return res.status(403).json({ error: 'Bundle not accessible' });
    }

    // purchased / ownership checks
    let isPurchased = false;
    let userOwnsItems = false;
    if (userId) {
      const purchase = await prisma.bundlePurchase.findFirst({ where: { bundleId: bundle.id, userId } });
      isPurchased = !!purchase;

      if (!isPurchased) {
        if (bundle.type === 'COURSE' && bundle.courseItems?.length) {
          const courseIds = bundle.courseItems.map(i => i.course.id);
          const enrollments = await prisma.enrollment.findMany({ where: { userId, courseId: { in: courseIds } } });
          userOwnsItems = enrollments.length > 0;
        } else if (bundle.type === 'MODULE' && bundle.moduleItems?.length) {
          const moduleIds = bundle.moduleItems.map(i => i.module.id);
          const moduleEnrollments = await prisma.moduleEnrollment.findMany({ where: { userId, moduleId: { in: moduleIds } } });
          userOwnsItems = moduleEnrollments.length > 0;
        }
      }
    }

    // simple metrics
    let totalItems = 0;
    let individualTotal = 0;
    if (bundle.type === 'COURSE') {
      totalItems = bundle.courseItems.length;
      individualTotal = bundle.courseItems.reduce((s, item) => s + (item.course?.isPaid ? (item.course.price || 0) : 0), 0);
    } else {
      totalItems = bundle.moduleItems.length;
      individualTotal = bundle.moduleItems.reduce((s, item) => s + (!item.module?.isFree ? (item.module.price || 0) : 0), 0);
    }

    const savings = individualTotal - (bundle.finalPrice || 0);
    const savingsPercentage = individualTotal > 0 ? Math.round((savings / individualTotal) * 100) : 0;

    if (userId && userId !== bundle.userId) {
      await prisma.bundle.update({ where: { id: bundle.id }, data: { viewCount: { increment: 1 } } });
    }

    const enhancedBundle = {
      ...bundle,
      totalItems,
      individualTotal,
      savings,
      savingsPercentage,
      isPurchased,
      userOwnsItems,
      recentPurchases: bundle.purchases
    };

    return res.json({ success: true, bundle: enhancedBundle });
  } catch (error) {
    console.error('❌ Bundle details error:', error);
    return res.status(500).json({ error: 'Failed to fetch bundle details', details: error.message });
  }
};

// Update Bundle (Admin and Owner)
const updateBundle = async (req, res) => {
  try {
    const { bundleId } = req.params;
    const { name, description, discount, isPublic, isActive } = req.body;
    const userId = req.user.id;

    const bundle = await prisma.bundle.findUnique({
      where: { id: parseInt(bundleId) },
      select: { id: true, userId: true, totalPrice: true }
    });

    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    const userIsAdmin = isUserAdmin(user);
    const isOwner = bundle.userId === userId;

    if (!userIsAdmin && !isOwner) {
      return res.status(403).json({ error: 'Not authorized to update this bundle' });
    }

    const updateData = {};
    
    if (name !== undefined) updateData.name = name.trim();
    if (description !== undefined) updateData.description = description?.trim() || null;
    if (isActive !== undefined && (userIsAdmin || isOwner)) updateData.isActive = Boolean(isActive);
    if (isPublic !== undefined && userIsAdmin) updateData.isPublic = Boolean(isPublic);
    
    if (discount !== undefined) {
      const discountAmount = Math.max(0, Math.min(100, discount || 0));
      updateData.discount = discountAmount;
      updateData.finalPrice = bundle.totalPrice * (1 - discountAmount / 100);
    }

    const updatedBundle = await prisma.bundle.update({
      where: { id: parseInt(bundleId) },
      data: updateData
    });

    res.json({
      success: true,
      message: 'Bundle updated successfully',
      bundle: updatedBundle
    });

  } catch (error) {
    console.error('❌ Update bundle error:', error);
    res.status(500).json({ 
      error: 'Failed to update bundle',
      details: error.message
    });
  }
};

// Delete Bundle
const deleteBundle = async (req, res) => {
  try {
    const { bundleId } = req.params;
    const userId = req.user.id;

    const bundle = await prisma.bundle.findUnique({
      where: { id: parseInt(bundleId) },
      select: { 
        id: true, 
        userId: true, 
        salesCount: true, 
        name: true, 
        type: true
      }
    });

    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { role: true }
    });

    const userIsAdmin = isUserAdmin(user);
    const isOwner = bundle.userId === userId;

    if (!userIsAdmin && !isOwner) {
      return res.status(403).json({ error: 'Not authorized to delete this bundle' });
    }

    // Prevent deletion if bundle has sales (unless admin)
    if (bundle.salesCount > 0 && !userIsAdmin) {
      return res.status(400).json({ 
        error: `Cannot delete bundle with ${bundle.salesCount} sales`
      });
    }

    // Delete bundle and related items
    await prisma.$transaction(async (tx) => {
      if (bundle.type === 'COURSE') {
        await tx.courseBundleItem.deleteMany({
          where: { bundleId: bundle.id }
        });
      } else {
        await tx.bundleItem.deleteMany({
          where: { bundleId: bundle.id }
        });
      }

      // If admin deleting bundle with sales, remove purchase records
      if (bundle.salesCount > 0 && userIsAdmin) {
        await tx.bundlePurchase.deleteMany({
          where: { bundleId: bundle.id }
        });
      }

      await tx.bundle.delete({
        where: { id: bundle.id }
      });
    });

    res.json({
      success: true,
      message: 'Bundle deleted successfully'
    });

  } catch (error) {
    console.error('❌ Delete bundle error:', error);
    res.status(500).json({ 
      error: 'Failed to delete bundle',
      details: error.message
    });
  }
};

// Purchase Bundle
// src/controllers/bundleController.js (replace existing purchaseBundle)
const purchaseBundle = async (req, res) => {
  try {
    const { bundleId, paymentTransactionId, finalPrice } = req.body;
    const userId = req.user?.id;

    // ---- Basic validation ----
    if (!userId) return res.status(401).json({ error: 'Authentication required' });
    if (!bundleId) return res.status(400).json({ error: 'bundleId is required' });

    // Require a valid transaction id (prevents accidental creations)
    if (!paymentTransactionId || typeof paymentTransactionId !== 'string' || paymentTransactionId.trim() === '') {
      console.warn('Blocked purchase attempt: missing paymentTransactionId', { userId, bundleId, ip: req.ip });
      return res.status(400).json({ error: 'paymentTransactionId is required' });
    }

    // Require a positive final price (prevents zero/undefined price creations)
    const priceNum = Number(finalPrice ?? 0);
    if (isNaN(priceNum) || priceNum <= 0) {
      console.warn('Blocked purchase attempt: invalid finalPrice', { userId, bundleId, finalPrice, ip: req.ip });
      return res.status(400).json({ error: 'finalPrice must be a positive number' });
    }

    // ---- Load bundle safely ----
    const bundle = await prisma.bundle.findUnique({
      where: { id: parseInt(bundleId, 10) },
      include: {
        courseItems: { include: { course: { select: { id: true, title: true, price: true, isPaid: true } } } },
        moduleItems: { include: { module: { select: { id: true, title: true, price: true, isFree: true } } } }
      }
    });

    if (!bundle || !bundle.isActive) {
      return res.status(404).json({ error: 'Bundle not found or not available' });
    }

    // ---- Prevent accidental signup-triggered purchases ----
    // Fetch user createdAt (protect against a purchase immediately after signup)
    const userRecord = await prisma.user.findUnique({ where: { id: userId }, select: { createdAt: true } });
    if (userRecord) {
      const accountAgeMs = Date.now() - new Date(userRecord.createdAt).getTime();
      const MIN_ACCOUNT_AGE_MS = 5 * 1000; // 5 seconds, adjust as needed (you might choose 30s or 60s)
      if (accountAgeMs < MIN_ACCOUNT_AGE_MS) {
        console.warn('Blocked purchase: account too new', { userId, bundleId, accountAgeMs });
        return res.status(400).json({ error: 'Account is too new to make purchases (possible automated signup). Try again.' });
      }
    }

    // ---- Idempotency check: same transaction might be retrying ----
    const existingTx = await prisma.bundlePurchase.findFirst({
      where: { paymentTransactionId }
    });
    if (existingTx) {
      console.warn('Blocked purchase: duplicate paymentTransactionId', { userId, bundleId, paymentTransactionId });
      return res.status(409).json({ error: 'This transaction has already been processed' });
    }

    // ---- Check if user already purchased this bundle ----
    const existingPurchase = await prisma.bundlePurchase.findFirst({
      where: { bundleId: bundle.id, userId }
    });
    if (existingPurchase) {
      return res.status(400).json({ error: 'You have already purchased this bundle' });
    }

    // ---- Process purchase inside transaction ----
    const createdPurchase = await prisma.$transaction(async (tx) => {
      // Create purchase record with required fields only
      const bp = await tx.bundlePurchase.create({
        data: {
          bundleId: bundle.id,
          userId,
          paymentTransactionId,
          purchasePrice: bundle.totalPrice ?? priceNum,
          discount: bundle.discount ?? 0,
          finalPrice: priceNum,
          bundleType: bundle.type,
          itemCount: bundle.type === 'COURSE' ? bundle.courseItems.length : bundle.moduleItems.length,
          // createdAt will be set by DB default
        }
      });

      // Enroll user in items and include the same paymentTransactionId for traceability
      if (bundle.type === 'COURSE') {
        const enrollmentData = bundle.courseItems.map(item => ({
          userId,
          courseId: item.course.id,
          paymentTransactionId
        }));

        // Use createMany with skipDuplicates to avoid duplicate enrollments
        if (enrollmentData.length) {
          await tx.enrollment.createMany({
            data: enrollmentData,
            skipDuplicates: true
          });
        }
      } else {
        const moduleEnrollmentData = bundle.moduleItems.map(item => ({
          userId,
          moduleId: item.module.id,
          purchasePrice: item.module.price ?? 0,
          paymentTransactionId
        }));

        if (moduleEnrollmentData.length) {
          await tx.moduleEnrollment.createMany({
            data: moduleEnrollmentData,
            skipDuplicates: true
          });
        }
      }

      // Update bundle analytics
      await tx.bundle.update({
        where: { id: bundle.id },
        data: {
          salesCount: { increment: 1 },
          revenue: { increment: priceNum }
        }
      });

      return bp;
    });

    // ---- Respond with created purchase ----
    return res.json({
      success: true,
      message: 'Bundle purchased successfully!',
      purchase: {
        id: createdPurchase.id,
        bundleId: createdPurchase.bundleId,
        finalPrice: createdPurchase.finalPrice,
        itemCount: createdPurchase.itemCount
      }
    });

  } catch (error) {
    console.error('❌ Bundle purchase error:', error);
    return res.status(500).json({
      error: 'Failed to process bundle purchase',
      details: error.message
    });
  }
};


const getFeaturedBundles = async (req, res) => {
  console.log('🔍 BUNDLE ROUTE: GET /api/bundles/featured?limit=', req.query.limit);
  try {
    const limit = parseInt(req.query.limit) || 4;
    const bundles = await prisma.bundle.findMany({
      where: {
        isFeatured: true,
        isActive: true,
      },
      take: limit,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            role: true,
          },
        },
        courseItems: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
                description: true,
                price: true,
                isPaid: true,
                imageUrl: true,
                category: {
                  select: {
                    name: true,
                  },
                },
                modules: {
                  select: {
                    id: true,
                    title: true,
                    chapters: {
                      select: {
                        id: true,
                        title: true,
                        type: true,
                        duration: true,
                      },
                    },
                  },
                },
              },
            },
          },
        },
        moduleItems: {
          include: {
            module: {
              select: {
                id: true,
                title: true,
                description: true,
                price: true,
                isFree: true,
                course: {
                  select: {
                    id: true,
                    title: true,
                    imageUrl: true,
                    category: {
                      select: {
                        name: true,
                      },
                    },
                  },
                },
                chapters: {
                  select: {
                    id: true,
                    title: true,
                    type: true,
                    duration: true,
                  },
                },
              },
            },
          },
        },
        purchases: {
          take: 10,
          orderBy: {
            createdAt: 'desc',
          },
          include: {
            user: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
    });

    res.status(200).json({ data: bundles });
  } catch (error) {
    console.error(' Error fetching featured bundles:', error);
    res.status(500).json({ error: error.message || 'Failed to fetch featured bundles' });
  }
};

module.exports = {
  getBundleAnalytics,
  getAvailableCourses,
  getAvailableModules,
  createBundle,
  getBundles,
  getBundleById,
  updateBundle,
  deleteBundle,
  purchaseBundle,
  getFeaturedBundles
};