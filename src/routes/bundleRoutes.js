const express = require('express');
const router = express.Router();
const requireAuth = require('../middlewares/requireAuth');
const { 
  getBundleAnalytics,
  getMyBundleAnalytics,
  getAvailableCourses,
  createCourseBundle 
} = require('../controllers/bundleController');

// Debug middleware
router.use((req, res, next) => {
  console.log(`🔍 BUNDLE ROUTE: ${req.method} ${req.originalUrl}`);
  next();
});

// ===== USER ANALYTICS =====
router.get('/my-analytics', requireAuth, getMyBundleAnalytics);

// ===== COURSE BUNDLE CREATION =====
router.get('/courses/available', requireAuth, getAvailableCourses);
router.post('/courses', requireAuth, createCourseBundle);

// ===== MARKETPLACE =====
router.get('/marketplace', requireAuth, async (req, res) => {
  try {
    const bundles = await prisma.bundle.findMany({
      where: { isPublic: true, isActive: true },
      include: {
        user: { select: { id: true, name: true, role: true } },
        courseItems: {
          include: {
            course: { select: { id: true, title: true, price: true } }
          }
        }
      },
      orderBy: [
        { isFeatured: 'desc' },
        { isPopular: 'desc' },
        { salesCount: 'desc' }
      ]
    });

    res.json({ success: true, bundles });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch marketplace bundles' });
  }
});

// ===== MY BUNDLES =====
router.get('/my-bundles', requireAuth, async (req, res) => {
  try {
    const userId = req.user.id;
    
    const bundles = await prisma.bundle.findMany({
      where: { userId },
      include: {
        user: { select: { id: true, name: true, role: true } },
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
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    // Add calculated fields
    const enhancedBundles = bundles.map(bundle => {
      const totalItems = bundle.courseItems.length;
      const individualTotal = bundle.courseItems.reduce((sum, item) => {
        return sum + (item.course.isPaid ? item.course.price : 0);
      }, 0);
      const savings = individualTotal - bundle.finalPrice;
      const savingsPercentage = individualTotal > 0 ? Math.round((savings / individualTotal) * 100) : 0;

      return {
        ...bundle,
        totalItems,
        individualTotal,
        savings,
        savingsPercentage,
        canEdit: true,
        canDelete: bundle.salesCount === 0, // Can only delete if no sales
        isOwner: true
      };
    });

    res.json({ success: true, bundles: enhancedBundles });
    
  } catch (error) {
    console.error('❌ Get my bundles error:', error);
    res.status(500).json({ error: 'Failed to fetch your bundles' });
  }
});

module.exports = router;