// backend/src/controllers/bundleController.js - CLEAN JAVASCRIPT VERSION
const bundleService = require('../services/bundleService');
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  timeout: 20000,
  maxNetworkRetries: 3,
  telemetry: false,
});

// ================================
// BUNDLE RETRIEVAL CONTROLLERS
// ================================

const getAllBundles = async (req, res) => {
  try {
    const filters = {
      type: req.query.type || 'all',
      featured: req.query.featured === 'true',
      popular: req.query.popular === 'true',
      limit: parseInt(req.query.limit) || 20,
      offset: parseInt(req.query.offset) || 0
    };

    const bundles = await bundleService.getAllBundles(filters);

    res.json({
      success: true,
      bundles,
      pagination: {
        limit: filters.limit,
        offset: filters.offset,
        total: bundles.length
      }
    });

  } catch (error) {
    console.error('Error fetching bundles:', error);
    res.status(500).json({ 
      error: 'Failed to fetch bundles',
      message: error.message 
    });
  }
};

const getFeaturedBundles = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 6;
    const bundles = await bundleService.getFeaturedBundles(limit);

    res.json({
      success: true,
      featuredBundles: bundles
    });

  } catch (error) {
    console.error('Error fetching featured bundles:', error);
    res.status(500).json({ 
      error: 'Failed to fetch featured bundles',
      message: error.message 
    });
  }
};

const getPopularBundles = async (req, res) => {
  try {
    const limit = parseInt(req.query.limit) || 8;
    const minSales = parseInt(req.query.minSales) || 1;
    const bundles = await bundleService.getPopularBundles(limit, minSales);

    res.json({
      success: true,
      popularBundles: bundles
    });

  } catch (error) {
    console.error('Error fetching popular bundles:', error);
    res.status(500).json({ 
      error: 'Failed to fetch popular bundles',
      message: error.message 
    });
  }
};

const getBundleDetails = async (req, res) => {
  try {
    const { bundleId } = req.params;
    const userId = req.user?.userId;

    const bundle = await bundleService.getBundleById(parseInt(bundleId), true);

    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    // Check user ownership if authenticated
    let userOwnsItems = false;
    if (userId) {
      const validation = await bundleService.validateBundlePurchase(parseInt(bundleId), userId);
      userOwnsItems = !validation.valid;
    }

    // Increment view count
    await bundleService.incrementViewCount(parseInt(bundleId));

    res.json({
      success: true,
      bundle: {
        ...bundle,
        userOwnsItems
      }
    });

  } catch (error) {
    console.error('Error fetching bundle details:', error);
    res.status(500).json({ 
      error: 'Failed to fetch bundle details',
      message: error.message 
    });
  }
};

// ================================
// BUNDLE CREATION CONTROLLERS
// ================================

const createModuleBundle = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const bundleData = req.body;

    console.log('🔧 Creating module bundle:', {
      userId,
      bundleName: bundleData.name,
      moduleIds: bundleData.moduleIds,
      discount: bundleData.discount
    });

    if (!bundleData.name || !bundleData.moduleIds || bundleData.moduleIds.length < 1) {
      return res.status(400).json({ 
        error: 'Bundle name and at least 1 module are required' 
      });
    }

    const bundle = await bundleService.createModuleBundle(userId, bundleData);

    console.log('✅ Module bundle created successfully:', bundle.id);

    res.status(201).json({
      success: true,
      bundle,
      message: 'Module bundle created successfully!'
    });

  } catch (error) {
    console.error('❌ Error creating module bundle:', error);
    res.status(500).json({ 
      error: 'Failed to create module bundle',
      message: error.message 
    });
  }
};

const createCourseBundle = async (req, res) => {
  try {
    const userId = req.user?.userId;
    const bundleData = req.body;

    console.log('🔧 Creating course bundle:', {
      userId,
      bundleName: bundleData.name,
      courseIds: bundleData.courseIds,
      discount: bundleData.discount
    });

    if (!bundleData.name || !bundleData.courseIds || bundleData.courseIds.length < 1) {
      return res.status(400).json({ 
        error: 'Bundle name and at least 1 course are required' 
      });
    }

    const bundle = await bundleService.createCourseBundle(userId, bundleData);

    console.log('✅ Course bundle created successfully:', bundle.id);

    // Calculate savings info for response
    const savings = {
      individual: bundle.individualTotal,
      bundle: bundle.finalPrice,
      saved: bundle.savings,
      percentage: bundle.savingsPercentage
    };

    res.status(201).json({
      success: true,
      bundle,
      message: 'Course bundle created successfully!',
      savings
    });

  } catch (error) {
    console.error('❌ Error creating course bundle:', error);
    res.status(500).json({ 
      error: 'Failed to create course bundle',
      message: error.message 
    });
  }
};

// ================================
// BUNDLE PURCHASE CONTROLLERS
// ================================

const purchaseBundle = async (req, res) => {
  try {
    const { bundleId } = req.body;
    const userId = req.user?.userId;

    if (!bundleId) {
      return res.status(400).json({ error: 'Bundle ID is required' });
    }

    // Get bundle details
    const bundle = await bundleService.getBundleById(bundleId);
    
    if (!bundle) {
      return res.status(404).json({ error: 'Bundle not found' });
    }

    if (!bundle.isActive) {
      return res.status(400).json({ error: 'Bundle is no longer available' });
    }

    // Validate purchase
    const validation = await bundleService.validateBundlePurchase(bundleId, userId);
    if (!validation.valid) {
      return res.status(400).json({ 
        error: validation.error,
        ownedItems: validation.ownedItems 
      });
    }

    // Handle free bundles (if final price is 0)
    if (bundle.finalPrice === 0) {
      const result = await bundleService.processBundlePurchase(bundleId, userId, {
        paymentTransactionId: 'free_bundle',
        amountPaid: 0
      });

      return res.json({
        success: true,
        message: 'Free bundle accessed successfully!',
        purchase: result,
        redirectUrl: `/bundles/success?bundle_id=${bundleId}`
      });
    }

    // Increment view count
    await bundleService.incrementViewCount(bundleId);

    // Create Stripe checkout session
    const itemCount = bundle.type === 'MODULE' ? bundle.moduleItems?.length : bundle.courseItems?.length;
    
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: bundle.name,
            description: `${bundle.type.toLowerCase()} bundle: ${bundle.description || ''} (${itemCount} items)`,
          },
          unit_amount: Math.round(bundle.finalPrice * 100),
        },
        quantity: 1,
      }],
      success_url: `${process.env.FRONTEND_URL}/bundles/success?bundle_id=${bundleId}`,
      cancel_url: `${process.env.FRONTEND_URL}/bundles/${bundleId}`,
      metadata: {
        type: 'bundle_purchase',
        userId: userId.toString(),
        bundleId: bundleId.toString(),
        bundleType: bundle.type,
        finalPrice: bundle.finalPrice.toString(),
        itemCount: itemCount.toString()
      },
    });

    res.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id,
      bundle: {
        id: bundle.id,
        name: bundle.name,
        type: bundle.type,
        finalPrice: bundle.finalPrice,
        itemCount
      }
    });

  } catch (error) {
    console.error('Error purchasing bundle:', error);
    res.status(500).json({ 
      error: 'Failed to purchase bundle',
      message: error.message 
    });
  }
};

// ================================
// USER BUNDLE MANAGEMENT
// ================================

const getUserBundles = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    const bundles = await bundleService.getAllBundles({ 
      userId,
      limit: 50,
      offset: 0 
    });

    res.json({
      success: true,
      bundles
    });

  } catch (error) {
    console.error('Error fetching user bundles:', error);
    res.status(500).json({ 
      error: 'Failed to fetch bundles',
      message: error.message 
    });
  }
};

const deleteBundle = async (req, res) => {
  try {
    const { bundleId } = req.params;
    const userId = req.user?.userId;

    const result = await bundleService.deleteBundle(parseInt(bundleId), userId);

    res.json({
      success: true,
      message: 'Bundle deleted successfully!'
    });

  } catch (error) {
    console.error('Error deleting bundle:', error);
    res.status(500).json({ 
      error: 'Failed to delete bundle',
      message: error.message 
    });
  }
};

const getBundleAnalytics = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    const analytics = await bundleService.getBundleAnalytics(userId);

    res.json({
      success: true,
      analytics: analytics.bundles,
      summary: analytics.summary
    });

  } catch (error) {
    console.error('Error fetching bundle analytics:', error);
    res.status(500).json({ 
      error: 'Failed to fetch analytics',
      message: error.message 
    });
  }
};

// ================================
// WEBHOOK HELPER (called from paymentController)
// ================================

const processBundlePurchaseWebhook = async (bundleId, userId, paymentData) => {
  try {
    const result = await bundleService.processBundlePurchase(bundleId, userId, paymentData);
    console.log(`✅ Bundle ${bundleId} purchase processed for user ${userId}`);
    return result;
  } catch (error) {
    console.error(`❌ Bundle purchase webhook error:`, error);
    throw error;
  }
};

module.exports = {
  // Bundle browsing
  getAllBundles,
  getFeaturedBundles,
  getPopularBundles,
  getBundleDetails,
  
  // Bundle creation
  createModuleBundle,
  createCourseBundle,
  
  // Bundle purchasing
  purchaseBundle,
  getUserBundles,
  deleteBundle,
  
  // Analytics
  getBundleAnalytics,
  
  // Webhook helper
  processBundlePurchaseWebhook
};