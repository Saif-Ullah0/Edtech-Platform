
// ================================
// backend/src/routes/admin/bundleAdminRoutes.js - CREATE THIS FILE
// ================================
// First create the admin directory: mkdir backend/src/routes/admin

const express = require('express');
const router = express.Router();
const requireAuth = require('../../middlewares/requireAuth');
const requireAdmin = require('../../middlewares/requireAdmin');
const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

// ================================
// ADMIN BUNDLE MANAGEMENT
// ================================

// Get all bundles (admin view with detailed info)
const getAllBundlesAdmin = async (req, res) => {
  try {
    const { 
      page = 1, 
      limit = 20, 
      type, 
      status = 'all' // 'all', 'active', 'inactive', 'featured', 'popular'
    } = req.query;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    const whereClause = {
      ...(type && type !== 'all' && { type: type.toUpperCase() }),
      ...(status === 'active' && { isActive: true }),
      ...(status === 'inactive' && { isActive: false }),
      ...(status === 'featured' && { isFeatured: true }),
      ...(status === 'popular' && { isPopular: true })
    };

    const [bundles, totalCount] = await Promise.all([
      prisma.bundle.findMany({
        where: whereClause,
        include: {
          user: { select: { id: true, name: true, email: true } },
          moduleItems: {
            include: {
              module: {
                include: { course: { select: { id: true, title: true } } }
              }
            }
          },
          courseItems: {
            include: {
              course: { select: { id: true, title: true, price: true } }
            }
          },
          _count: {
            select: { purchases: true }
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

    const enhancedBundles = bundles.map(bundle => {
      let individualTotal = 0;
      
      if (bundle.type === 'MODULE') {
        individualTotal = bundle.moduleItems.reduce((sum, item) => sum + item.module.price, 0);
      } else if (bundle.type === 'COURSE') {
        individualTotal = bundle.courseItems.reduce((sum, item) => sum + item.course.price, 0);
      }
      
      const savings = individualTotal - bundle.finalPrice;
      const savingsPercentage = individualTotal > 0 ? ((savings / individualTotal) * 100) : 0;

      return {
        ...bundle,
        individualTotal,
        savings,
        savingsPercentage: Math.round(savingsPercentage),
        purchaseCount: bundle._count.purchases
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
    console.error('Admin: Error fetching bundles:', error);
    res.status(500).json({ error: 'Failed to fetch bundles' });
  }
};

// Toggle bundle featured status
const toggleBundleFeatured = async (req, res) => {
  try {
    const { bundleId } = req.params;
    const { isFeatured, featuredOrder, promotedUntil } = req.body;

    const updatedBundle = await prisma.bundle.update({
      where: { id: parseInt(bundleId) },
      data: {
        isFeatured: !!isFeatured,
        featuredOrder: isFeatured ? featuredOrder : null,
        promotedUntil: promotedUntil ? new Date(promotedUntil) : null
      }
    });

    res.json({
      success: true,
      message: `Bundle ${isFeatured ? 'featured' : 'unfeatured'} successfully`,
      bundle: updatedBundle
    });

  } catch (error) {
    console.error('Admin: Error toggling featured status:', error);
    res.status(500).json({ error: 'Failed to update featured status' });
  }
};

// Update bundle status (active/inactive)
const updateBundleStatus = async (req, res) => {
  try {
    const { bundleId } = req.params;
    const { isActive } = req.body;

    const updatedBundle = await prisma.bundle.update({
      where: { id: parseInt(bundleId) },
      data: { isActive: !!isActive }
    });

    res.json({
      success: true,
      message: `Bundle ${isActive ? 'activated' : 'deactivated'} successfully`,
      bundle: updatedBundle
    });

  } catch (error) {
    console.error('Admin: Error updating bundle status:', error);
    res.status(500).json({ error: 'Failed to update bundle status' });
  }
};

// Get bundle analytics dashboard
const getBundleAnalyticsDashboard = async (req, res) => {
  try {
    const [
      totalBundles,
      activeBundles,
      featuredBundles,
      popularBundles,
      totalSales,
      totalRevenue,
      recentPurchases
    ] = await Promise.all([
      prisma.bundle.count(),
      prisma.bundle.count({ where: { isActive: true } }),
      prisma.bundle.count({ where: { isFeatured: true } }),
      prisma.bundle.count({ where: { isPopular: true } }),
      prisma.bundlePurchase.count(),
      prisma.bundlePurchase.aggregate({
        _sum: { finalPrice: true }
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

    // Top performing bundles
    const topBundles = await prisma.bundle.findMany({
      where: { salesCount: { gt: 0 } },
      orderBy: [
        { salesCount: 'desc' },
        { revenue: 'desc' }
      ],
      take: 5,
      select: {
        id: true,
        name: true,
        type: true,
        salesCount: true,
        revenue: true,
        finalPrice: true
      }
    });

    // Bundle type distribution
    const bundleTypeStats = await prisma.bundle.groupBy({
      by: ['type'],
      _count: { id: true },
      _sum: { revenue: true, salesCount: true }
    });

    res.json({
      success: true,
      dashboard: {
        overview: {
          totalBundles,
          activeBundles,
          featuredBundles,
          popularBundles,
          totalSales,
          totalRevenue: totalRevenue._sum.finalPrice || 0
        },
        topBundles,
        bundleTypeStats,
        recentPurchases
      }
    });

  } catch (error) {
    console.error('Admin: Error fetching analytics dashboard:', error);
    res.status(500).json({ error: 'Failed to fetch analytics dashboard' });
  }
};

// Auto-update popular bundles (run periodically)
const updatePopularBundles = async (req, res) => {
  try {
    // Define popularity threshold (e.g., minimum 3 sales)
    const popularityThreshold = parseInt(req.body.threshold) || 3;

    // Reset all popular flags
    await prisma.bundle.updateMany({
      data: { isPopular: false }
    });

    // Set popular flag for bundles meeting criteria
    const updatedCount = await prisma.bundle.updateMany({
      where: {
        salesCount: { gte: popularityThreshold },
        isActive: true
      },
      data: { isPopular: true }
    });

    res.json({
      success: true,
      message: `Updated ${updatedCount.count} bundles as popular`,
      threshold: popularityThreshold
    });

  } catch (error) {
    console.error('Admin: Error updating popular bundles:', error);
    res.status(500).json({ error: 'Failed to update popular bundles' });
  }
};

// Admin routes
router.get('/', requireAuth, requireAdmin, getAllBundlesAdmin);
router.put('/:bundleId/featured', requireAuth, requireAdmin, toggleBundleFeatured);
router.put('/:bundleId/status', requireAuth, requireAdmin, updateBundleStatus);
router.get('/analytics', requireAuth, requireAdmin, getBundleAnalyticsDashboard);
router.post('/update-popular', requireAuth, requireAdmin, updatePopularBundles);

module.exports = router;