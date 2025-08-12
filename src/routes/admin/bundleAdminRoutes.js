// 4. FIXED BACKEND: admin/bundleAdminRoutes.js - Admin Routes
// ================================

const express = require('express');
const router = express.Router();
const requireAuth = require('../../middlewares/requireAuth');
const requireAdmin = require('../../middlewares/requireAdmin');
const { getBundleAnalytics } = require('../../controllers/bundleController');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Debug middleware
router.use((req, res, next) => {
  console.log(`🔍 ADMIN BUNDLE ROUTE: ${req.method} ${req.originalUrl}`);
  next();
});

// ===== ADMIN ANALYTICS =====
router.get('/analytics', requireAuth, requireAdmin, getBundleAnalytics);

// ===== ADMIN BUNDLE MANAGEMENT =====
router.get('/', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { page = 1, limit = 20, type, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);
    
    let whereClause = {};
    if (type && type !== 'all') whereClause.type = type.toUpperCase();
    if (status === 'active') whereClause.isActive = true;
    if (status === 'inactive') whereClause.isActive = false;
    if (status === 'featured') whereClause.isFeatured = true;
    if (status === 'popular') whereClause.isPopular = true;

    const [bundles, totalCount] = await Promise.all([
      prisma.bundle.findMany({
        where: whereClause,
        include: {
          user: { select: { id: true, name: true, email: true, role: true } },
          courseItems: {
            include: {
              course: { select: { id: true, title: true, price: true } }
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

    res.json({
      success: true,
      bundles,
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

// Toggle Featured Status
router.put('/:bundleId/featured', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { bundleId } = req.params;
    const { isFeatured } = req.body;

    const bundle = await prisma.bundle.update({
      where: { id: parseInt(bundleId) },
      data: { isFeatured: Boolean(isFeatured) }
    });

    res.json({
      success: true,
      message: `Bundle ${isFeatured ? 'featured' : 'unfeatured'} successfully`,
      bundle
    });

  } catch (error) {
    console.error('❌ Toggle featured error:', error);
    res.status(500).json({ error: 'Failed to update featured status' });
  }
});

// Toggle Active Status
router.put('/:bundleId/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { bundleId } = req.params;
    const { isActive } = req.body;

    const bundle = await prisma.bundle.update({
      where: { id: parseInt(bundleId) },
      data: { isActive: Boolean(isActive) }
    });

    res.json({
      success: true,
      message: `Bundle ${isActive ? 'activated' : 'deactivated'} successfully`,
      bundle
    });

  } catch (error) {
    console.error('❌ Toggle status error:', error);
    res.status(500).json({ error: 'Failed to update status' });
  }
});

// Update Popular Bundles
router.post('/update-popular', requireAuth, requireAdmin, async (req, res) => {
  try {
    const threshold = parseInt(req.body.threshold) || 3;

    // Reset all popular flags
    await prisma.bundle.updateMany({
      data: { isPopular: false }
    });

    // Set popular flag for qualifying bundles
    const result = await prisma.bundle.updateMany({
      where: {
        salesCount: { gte: threshold },
        isActive: true
      },
      data: { isPopular: true }
    });

    res.json({
      success: true,
      message: `Updated ${result.count} bundles as popular`,
      threshold
    });

  } catch (error) {
    console.error('❌ Update popular error:', error);
    res.status(500).json({ error: 'Failed to update popular bundles' });
  }
});

module.exports = router;