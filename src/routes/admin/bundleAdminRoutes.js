// backend/src/routes/admin/bundleAdminRoutes.js
const express = require('express');
const router = express.Router();
const requireAuth = require('../../middlewares/requireAuth');
const requireAdmin = require('../../middlewares/requireAdmin');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Apply middleware to all admin routes
router.use(requireAuth, requireAdmin);

// Debug middleware
router.use((req, res, next) => {
  console.log(`🔍 ADMIN BUNDLE ROUTE: ${req.method} ${req.originalUrl}`);
  next();
});

// Get all bundles for admin
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status, search } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let whereClause = {};
    
    // Type filter
    if (type && type !== 'all') whereClause.type = type.toUpperCase();
    
    // Status filters
    if (status === 'active') whereClause.isActive = true;
    if (status === 'inactive') whereClause.isActive = false;
    if (status === 'featured') whereClause.isFeatured = true;
    if (status === 'popular') whereClause.isPopular = true;
    if (status === 'public') whereClause.isPublic = true;
    if (status === 'private') whereClause.isPublic = false;
    
    // Search filter
    if (search && search.trim()) {
      whereClause.OR = [
        { name: { contains: search.trim(), mode: 'insensitive' } },
        { description: { contains: search.trim(), mode: 'insensitive' } },
        { user: { name: { contains: search.trim(), mode: 'insensitive' } } },
        { user: { email: { contains: search.trim(), mode: 'insensitive' } } }
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
          },
          _count: { select: { purchases: true } }
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
        savingsPercentage
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
    console.error('❌ Admin get bundles error:', error);
    res.status(500).json({ error: 'Failed to fetch bundles' });
  }
});

// Get bundle analytics for admin
router.get('/analytics', async (req, res) => {
  try {
    const [
      bundleTypeStats,
      totalBundles,
      activeBundles,
      publicBundles,
      featuredBundles,
      popularBundles,
      totalSales,
      totalRevenue,
      topBundles,
      recentPurchases
    ] = await Promise.all([
      prisma.bundle.groupBy({
        by: ['type'],
        _count: { id: true },
        _sum: { salesCount: true, revenue: true, viewCount: true }
      }),
      prisma.bundle.count(),
      prisma.bundle.count({ where: { isActive: true } }),
      prisma.bundle.count({ where: { isPublic: true } }),
      prisma.bundle.count({ where: { isFeatured: true } }),
      prisma.bundle.count({ where: { isPopular: true } }),
      prisma.bundlePurchase.count(),
      prisma.bundlePurchase.aggregate({ _sum: { finalPrice: true } }),
      prisma.bundle.findMany({
        where: { salesCount: { gt: 0 } },
        orderBy: { salesCount: 'desc' },
        take: 5,
        select: { id: true, name: true, salesCount: true, revenue: true, viewCount: true, type: true }
      }),
      prisma.bundlePurchase.findMany({
        take: 10,
        orderBy: { createdAt: 'desc' },
        include: {
          bundle: { select: { id: true, name: true, type: true } },
          user: { select: { id: true, name: true, email: true } }
        }
      })
    ]);

    const analytics = {
      overview: {
        totalBundles,
        activeBundles,
        publicBundles,
        featuredBundles,
        popularBundles,
        totalSales,
        totalRevenue: totalRevenue._sum.finalPrice || 0
      },
      bundleTypeStats,
      topBundles,
      recentPurchases
    };

    res.json({
      success: true,
      dashboard: analytics
    });

  } catch (error) {
    console.error('❌ Admin analytics error:', error);
    res.status(500).json({ error: 'Failed to fetch analytics' });
  }
});

// Get single bundle details
router.get('/:bundleId', async (req, res) => {
  try {
    const { bundleId } = req.params;

    const bundle = await prisma.bundle.findUnique({
      where: { id: parseInt(bundleId) },
      include: {
        user: { 
          select: { 
            id: true, 
            name: true, 
            email: true, 
            role: true 
          } 
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
                description: true,
                price: true,
                isFree: true,
                course: {
                  select: {
                    title: true,
                    category: { select: { name: true } }
                  }
                }
              }
            }
          }
        },
        purchases: {
          take: 10,
          orderBy: { createdAt: 'desc' },
          include: {
            user: { select: { id: true, name: true, email: true } }
          }
        }
      }
    });

    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    // Calculate metrics
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

    const enhancedBundle = {
      ...bundle,
      totalItems,
      individualTotal,
      savings,
      savingsPercentage
    };

    res.json({
      success: true,
      bundle: enhancedBundle
    });

  } catch (error) {
    console.error('❌ Admin get bundle details error:', error);
    res.status(500).json({ error: 'Failed to fetch bundle details' });
  }
});

// Update bundle status (featured, active, public)
router.patch('/:bundleId/status', async (req, res) => {
  try {
    const { bundleId } = req.params;
    const { isFeatured, isActive, isPublic } = req.body;

    const updateData = {};
    if (isFeatured !== undefined) updateData.isFeatured = Boolean(isFeatured);
    if (isActive !== undefined) updateData.isActive = Boolean(isActive);
    if (isPublic !== undefined) updateData.isPublic = Boolean(isPublic);

    const bundle = await prisma.bundle.update({
      where: { id: parseInt(bundleId) },
      data: updateData
    });

    res.json({
      success: true,
      message: 'Bundle status updated successfully',
      bundle
    });

  } catch (error) {
    console.error('❌ Update bundle status error:', error);
    res.status(500).json({ error: 'Failed to update bundle status' });
  }
});

// Update popular bundles based on sales threshold
router.post('/update-popular', async (req, res) => {
  try {
    const { threshold = 3 } = req.body;

    // Reset all popular flags
    await prisma.bundle.updateMany({
      data: { isPopular: false }
    });

    // Set popular flag for qualifying bundles
    const result = await prisma.bundle.updateMany({
      where: {
        salesCount: { gte: parseInt(threshold) },
        isActive: true
      },
      data: { isPopular: true }
    });

    res.json({
      success: true,
      message: `Updated ${result.count} bundles as popular (sales ≥ ${threshold})`,
      threshold: parseInt(threshold),
      updatedCount: result.count
    });

  } catch (error) {
    console.error('❌ Update popular error:', error);
    res.status(500).json({ error: 'Failed to update popular bundles' });
  }
});

// Bulk actions on bundles
router.post('/bulk-action', async (req, res) => {
  try {
    const { action, bundleIds } = req.body;

    if (!action || !bundleIds || !Array.isArray(bundleIds) || bundleIds.length === 0) {
      return res.status(400).json({ error: 'Action and bundle IDs are required' });
    }

    const ids = bundleIds.map(id => parseInt(id));
    let updateData = {};
    let message = '';

    switch (action) {
      case 'activate':
        updateData = { isActive: true };
        message = 'Bundles activated successfully';
        break;
      case 'deactivate':
        updateData = { isActive: false };
        message = 'Bundles deactivated successfully';
        break;
      case 'feature':
        updateData = { isFeatured: true };
        message = 'Bundles featured successfully';
        break;
      case 'unfeature':
        updateData = { isFeatured: false };
        message = 'Bundles unfeatured successfully';
        break;
      case 'make-public':
        updateData = { isPublic: true };
        message = 'Bundles made public successfully';
        break;
      case 'make-private':
        updateData = { isPublic: false };
        message = 'Bundles made private successfully';
        break;
      default:
        return res.status(400).json({ error: 'Invalid action' });
    }

    const result = await prisma.bundle.updateMany({
      where: { id: { in: ids } },
      data: updateData
    });

    res.json({
      success: true,
      message,
      updatedCount: result.count
    });

  } catch (error) {
    console.error('❌ Bulk action error:', error);
    res.status(500).json({ error: 'Failed to perform bulk action' });
  }
});

// Edit/Update bundle (Admin)
router.put('/:bundleId', async (req, res) => {
  try {
    const { bundleId } = req.params;
    const { name, description, discount, isPublic, isActive, isFeatured, itemIds, type } = req.body;

    const bundle = await prisma.bundle.findUnique({
      where: { id: parseInt(bundleId) },
      select: { 
        id: true, 
        name: true,
        type: true,
        totalPrice: true,
        userId: true,
        user: { select: { name: true } }
      }
    });

    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    // Calculate new pricing if items changed
    let newTotalPrice = bundle.totalPrice;
    if (itemIds && Array.isArray(itemIds)) {
      let items = [];
      if (bundle.type === 'COURSE') {
        items = await prisma.course.findMany({
          where: { 
            id: { in: itemIds.map(id => parseInt(id)) },
            publishStatus: 'PUBLISHED',
            isDeleted: false
          },
          select: { id: true, price: true, isPaid: true }
        });
        newTotalPrice = items.reduce((sum, item) => sum + (item.isPaid ? item.price : 0), 0);
      } else {
        items = await prisma.module.findMany({
          where: { 
            id: { in: itemIds.map(id => parseInt(id)) },
            publishStatus: 'PUBLISHED'
          },
          select: { id: true, price: true, isFree: true }
        });
        newTotalPrice = items.reduce((sum, item) => sum + (!item.isFree ? item.price : 0), 0);
      }
    }

    // Calculate new final price
    const discountAmount = discount !== undefined ? Math.max(0, Math.min(100, discount)) : undefined;
    const finalPrice = discountAmount !== undefined ? newTotalPrice * (1 - discountAmount / 100) : undefined;

    // Update bundle in transaction
    const updatedBundle = await prisma.$transaction(async (tx) => {
      // Update bundle details
      const updateData = {};
      if (name !== undefined) updateData.name = name.trim();
      if (description !== undefined) updateData.description = description?.trim() || null;
      if (discountAmount !== undefined) {
        updateData.discount = discountAmount;
        updateData.totalPrice = newTotalPrice;
        updateData.finalPrice = finalPrice;
      }
      if (isActive !== undefined) updateData.isActive = Boolean(isActive);
      if (isPublic !== undefined) updateData.isPublic = Boolean(isPublic);
      if (isFeatured !== undefined) updateData.isFeatured = Boolean(isFeatured);

      const updated = await tx.bundle.update({
        where: { id: parseInt(bundleId) },
        data: updateData
      });

      // Update items if provided
      if (itemIds && Array.isArray(itemIds)) {
        if (bundle.type === 'COURSE') {
          // Remove existing course items
          await tx.courseBundleItem.deleteMany({
            where: { bundleId: bundle.id }
          });
          
          // Add new course items
          if (itemIds.length > 0) {
            const courseBundleItems = itemIds.map(courseId => ({
              bundleId: bundle.id,
              courseId: parseInt(courseId)
            }));
            await tx.courseBundleItem.createMany({
              data: courseBundleItems
            });
          }
        } else {
          // Remove existing module items
          await tx.bundleItem.deleteMany({
            where: { bundleId: bundle.id }
          });
          
          // Add new module items
          if (itemIds.length > 0) {
            const moduleBundleItems = itemIds.map(moduleId => ({
              bundleId: bundle.id,
              moduleId: parseInt(moduleId)
            }));
            await tx.bundleItem.createMany({
              data: moduleBundleItems
            });
          }
        }
      }

      return updated;
    });

    res.json({
      success: true,
      message: 'Bundle updated successfully',
      bundle: updatedBundle
    });

  } catch (error) {
    console.error('❌ Admin update bundle error:', error);
    res.status(500).json({ 
      error: 'Failed to update bundle',
      details: error.message
    });
  }
});

// Admin delete bundle (can delete even with sales)
router.delete('/:bundleId', async (req, res) => {
  try {
    const { bundleId } = req.params;
    const { force = false } = req.query;

    const bundle = await prisma.bundle.findUnique({
      where: { id: parseInt(bundleId) },
      select: { 
        id: true, 
        name: true,
        salesCount: true,
        type: true,
        user: { select: { name: true } }
      }
    });

    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    // Check if bundle has sales and force flag
    if (bundle.salesCount > 0 && !force) {
      return res.status(400).json({ 
        error: 'Bundle has sales',
        message: `This bundle has ${bundle.salesCount} sales. Use force=true to delete anyway.`,
        requiresForce: true
      });
    }

    // Delete bundle and related items
    await prisma.$transaction(async (tx) => {
      // Delete purchases if force deleting
      if (force && bundle.salesCount > 0) {
        await tx.bundlePurchase.deleteMany({
          where: { bundleId: bundle.id }
        });
      }

      // Delete bundle items
      if (bundle.type === 'COURSE') {
        await tx.courseBundleItem.deleteMany({
          where: { bundleId: bundle.id }
        });
      } else {
        await tx.bundleItem.deleteMany({
          where: { bundleId: bundle.id }
        });
      }

      // Delete the bundle
      await tx.bundle.delete({
        where: { id: bundle.id }
      });
    });

    res.json({
      success: true,
      message: 'Bundle deleted successfully',
      deletedBundle: {
        id: bundle.id,
        name: bundle.name,
        salesCount: bundle.salesCount,
        creatorName: bundle.user.name
      }
    });

  } catch (error) {
    console.error('❌ Admin delete bundle error:', error);
    res.status(500).json({ 
      error: 'Failed to delete bundle',
      details: error.message
    });
  }
});

module.exports = router;