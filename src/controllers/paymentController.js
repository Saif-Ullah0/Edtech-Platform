// backend/src/controllers/paymentController.js - UPDATED (Bundle functions removed)
const Stripe = require('stripe');
const prisma = require('../../prisma/client');

// Add timeout configuration to Stripe
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY, {
  timeout: 20000, // 20 seconds instead of 80 seconds
  maxNetworkRetries: 3,
  telemetry: false,
});

// Add connection test function
async function testStripeConnection() {
  try {
    console.log('🔗 Testing Stripe connection...');
    const balance = await stripe.balance.retrieve();
    console.log('✅ Stripe connection successful');
    return true;
  } catch (error) {
    console.error('❌ Stripe connection failed:', error.message);
    return false;
  }
}

// Add health check endpoint
const checkPaymentHealth = async (req, res) => {
  try {
    const isConnected = await testStripeConnection();
    res.json({ 
      stripe: isConnected ? 'connected' : 'disconnected',
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    res.status(500).json({ 
      stripe: 'error',
      error: error.message,
      timestamp: new Date().toISOString()
    });
  }
};

// ================================
// COURSE PAYMENT FUNCTIONS
// ================================

// Fast direct enrollment (for immediate processing)
const fastEnrollment = async (req, res) => {
  const { courseId, paymentMethodId } = req.body;
  const userId = req.user?.userId;
  console.log(`🚀 Fast enrollment: User ${userId} → Course ${courseId}`);
  
  if (!courseId) {
    return res.status(400).json({ error: 'Missing courseId' });
  }
  
  try {
    // Test Stripe connection first for paid courses
    if (paymentMethodId) {
      const isConnected = await testStripeConnection();
      if (!isConnected) {
        return res.status(503).json({ 
          error: 'We are experiencing issues connecting to our payments provider. Please check your internet connection and try again.' 
        });
      }
    }

    // Get course details
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });
    
    if (!course) {
      console.log(`❌ Course ${courseId} not found`);
      return res.status(400).json({ error: 'Course not found' });
    }
    
    // Check if already enrolled
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: { userId, courseId }
    });
    
    if (existingEnrollment) {
      console.log(`⚠️ User ${userId} already enrolled`);
      return res.status(400).json({ 
        error: 'Already enrolled',
        message: 'You are already enrolled in this course',
        enrolled: true,
        redirectUrl: `/courses/${courseId}/modules`
      });
    }
    
    console.log(`📚 Course: ${course.title} - Price: $${course.price} USD`);
    
    // Handle free courses immediately
    if (course.price === 0) {
      const enrollment = await prisma.enrollment.create({
        data: {
          userId,
          courseId,
          progress: 0.0,
          lastAccessed: new Date()
        },
        include: {
          course: { select: { title: true, price: true } }
        }
      });
      
      console.log(`✅ Free enrollment completed instantly`);
      return res.json({
        success: true,
        message: 'Successfully enrolled in free course!',
        enrollment,
        course,
        redirectUrl: `/courses/${courseId}/modules`
      });
    }
    
    // Handle paid courses
    if (!paymentMethodId) {
      return res.status(400).json({ 
        error: 'Payment method required for paid course' 
      });
    }
    
    // Process payment directly with timeout protection
    const amountInCents = Math.round(course.price * 100);
    console.log(`💳 Processing payment: $${course.price} USD (${amountInCents} cents)`);
    
    // Create payment intent with timeout race
    const paymentPromise = stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      payment_method: paymentMethodId,
      confirmation_method: 'manual',
      confirm: true,
      return_url: `${process.env.FRONTEND_URL}/courses/${courseId}/modules`,
      metadata: {
        type: 'course_purchase',
        courseId: courseId.toString(),
        userId: userId.toString(),
        courseName: course.title,
        priceUSD: course.price.toString()
      }
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Payment request timeout')), 15000);
    });

    const paymentIntent = await Promise.race([paymentPromise, timeoutPromise]);
    
    console.log(`💰 Payment intent: ${paymentIntent.id} - Status: ${paymentIntent.status}`);
    
    if (paymentIntent.status === 'succeeded') {
      // Payment successful - create enrollment immediately
      const enrollment = await prisma.enrollment.create({
        data: {
          userId,
          courseId,
          progress: 0.0,
          lastAccessed: new Date(),
          paymentTransactionId: paymentIntent.id
        },
        include: {
          course: { select: { title: true, price: true } }
        }
      });
      
      console.log(`✅ Payment successful - Enrollment created instantly`);
      return res.json({
        success: true,
        message: `Payment successful! You paid $${course.price} USD.`,
        enrollment,
        course,
        amount: course.price,
        currency: 'USD',
        transactionId: paymentIntent.id,
        redirectUrl: `/courses/${courseId}/modules`
      });
    } else if (paymentIntent.status === 'requires_action') {
      // 3D Secure or other authentication required
      return res.json({
        requiresAction: true,
        paymentIntent: {
          id: paymentIntent.id,
          client_secret: paymentIntent.client_secret
        }
      });
    } else {
      return res.status(400).json({
        error: 'Payment failed',
        status: paymentIntent.status
      });
    }
  } catch (error) {
    console.error('❌ Fast enrollment error:', error);
    
    if (error.message === 'Payment request timeout') {
      return res.status(503).json({ 
        error: 'We are experiencing issues connecting to our payments provider. Please check your internet connection and try again.' 
      });
    }
    
    if (error.type === 'StripeCardError') {
      return res.status(400).json({ 
        error: `Card error: ${error.message}` 
      });
    }
    
    if (error.type === 'StripeConnectionError') {
      return res.status(503).json({ 
        error: 'We are experiencing issues connecting to our payments provider. Please check your internet connection and try again.' 
      });
    }
    
    return res.status(500).json({ 
      error: 'Enrollment failed',
      message: error.message 
    });
  }
};

// Create Payment Intent (for frontend to confirm)
const createPaymentIntent = async (req, res) => {
  const { courseId } = req.body;
  const userId = req.user?.userId;
  
  try {
    // Test Stripe connection first
    const isConnected = await testStripeConnection();
    if (!isConnected) {
      return res.status(503).json({ 
        error: 'We are experiencing issues connecting to our payments provider. Please check your internet connection and try again.' 
      });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId }
    });
    
    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }
    
    if (course.price === 0) {
      return res.status(400).json({ error: 'Cannot create payment intent for free course' });
    }
    
    // Check if already enrolled
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: { userId, courseId }
    });
    
    if (existingEnrollment) {
      return res.status(400).json({ 
        error: 'Already enrolled',
        enrolled: true 
      });
    }
    
    const amountInCents = Math.round(course.price * 100);
    console.log(`🔄 Creating payment intent: $${course.price} USD (${amountInCents} cents)`);
    
    // Create payment intent with timeout protection
    const paymentPromise = stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      automatic_payment_methods: { enabled: true },
      metadata: {
        type: 'course_purchase',
        courseId: courseId.toString(),
        userId: userId.toString(),
        courseName: course.title,
        priceUSD: course.price.toString()
      }
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Payment intent creation timeout')), 15000);
    });

    const paymentIntent = await Promise.race([paymentPromise, timeoutPromise]);
    
    res.json({
      clientSecret: paymentIntent.client_secret,
      amount: course.price,
      currency: 'USD',
      course: {
        id: course.id,
        title: course.title,
        price: course.price
      }
    });
  } catch (error) {
    console.error('❌ Payment intent creation error:', error);
    
    if (error.message === 'Payment intent creation timeout') {
      return res.status(503).json({ 
        error: 'We are experiencing issues connecting to our payments provider. Please check your internet connection and try again.' 
      });
    }
    
    res.status(500).json({ error: 'Failed to create payment intent' });
  }
};

// Confirm enrollment after payment
const confirmEnrollment = async (req, res) => {
  const { paymentIntentId, courseId } = req.body;
  const userId = req.user?.userId;
  
  try {
    // Verify payment intent with timeout
    const verifyPromise = stripe.paymentIntents.retrieve(paymentIntentId);
    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Payment verification timeout')), 10000);
    });

    const paymentIntent = await Promise.race([verifyPromise, timeoutPromise]);
    
    if (paymentIntent.status !== 'succeeded') {
      return res.status(400).json({ 
        error: 'Payment not completed',
        status: paymentIntent.status 
      });
    }
    
    console.log(`✅ Payment confirmed: ${paymentIntentId}`);
    
    // Check if already enrolled
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: { userId, courseId }
    });
    
    if (existingEnrollment) {
      return res.json({
        success: true,
        message: 'Already enrolled',
        enrollment: existingEnrollment,
        redirectUrl: `/courses/${courseId}/modules`
      });
    }
    
    // Create enrollment
    const enrollment = await prisma.enrollment.create({
      data: {
        userId,
        courseId,
        progress: 0.0,
        lastAccessed: new Date(),
        paymentTransactionId: paymentIntentId
      },
      include: {
        course: { select: { title: true, price: true } }
      }
    });
    
    console.log(`✅ Enrollment created: User ${userId} → Course ${courseId}`);
    
    res.json({
      success: true,
      message: 'Enrollment completed successfully!',
      enrollment,
      redirectUrl: `/courses/${courseId}/modules`
    });
  } catch (error) {
    console.error('❌ Enrollment confirmation error:', error);
    
    if (error.message === 'Payment verification timeout') {
      return res.status(503).json({ 
        error: 'We are experiencing issues connecting to our payments provider. Please check your internet connection and try again.' 
      });
    }
    
    res.status(500).json({ error: 'Failed to confirm enrollment' });
  }
};

// Keep existing checkout for fallback with timeout fix
const createCheckoutSession = async (req, res) => {
  const { courseId } = req.body;
  const userId = req.user?.userId;
  
  console.log(`🔄 Creating checkout session: User ${userId} → Course ${courseId}`);
  
  if (!courseId) {
    return res.status(400).json({ error: 'Missing courseId' });
  }
  
  try {
    // Test Stripe connection first
    const isConnected = await testStripeConnection();
    if (!isConnected) {
      return res.status(503).json({ 
        error: 'We are experiencing issues connecting to our payments provider. Please check your internet connection and try again.' 
      });
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });
    
    if (!course) {
      return res.status(400).json({ error: 'Course not found' });
    }
    
    // Check if already enrolled
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: { userId, courseId }
    });
    
    if (existingEnrollment) {
      return res.status(400).json({ 
        error: 'Already enrolled in this course',
        enrolled: true 
      });
    }
    
    // Handle free courses
    if (course.price === 0) {
      const enrollment = await prisma.enrollment.create({
        data: {
          userId,
          courseId,
          progress: 0.0,
          lastAccessed: new Date()
        },
      });
      
      return res.json({ 
        success: true,
        enrollment,
        redirectUrl: `${process.env.FRONTEND_URL}/courses/${courseId}/modules`
      });
    }
    
    const amountInCents = Math.round(course.price * 100);
    console.log(`💰 Checkout: $${course.price} USD (${amountInCents} cents)`);
    
    // Create order
    const order = await prisma.order.create({
      data: {
        userId,
        status: 'PENDING',
        totalAmount: course.price,
        items: {
          create: [{ courseId: course.id, price: course.price }],
        },
      },
    });
    
    // Create Stripe session with timeout protection
    const sessionPromise = stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: course.title,
            description: course.description || `Course: ${course.title}`,
          },
          unit_amount: amountInCents,
        },
        quantity: 1,
      }],
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}&course_id=${courseId}&order_id=${order.id}`,
      cancel_url: `${process.env.FRONTEND_URL}/courses/${courseId}`,
      metadata: {
        type: 'course_purchase',
        orderId: order.id.toString(),
        userId: userId.toString(),
        courseId: courseId.toString(),
        priceUSD: course.price.toString()
      },
    });

    const timeoutPromise = new Promise((_, reject) => {
      setTimeout(() => reject(new Error('Checkout session creation timeout')), 15000);
    });

    const session = await Promise.race([sessionPromise, timeoutPromise]);
    
    console.log(`✅ Checkout session created: ${session.id}`);
    
    res.json({ 
      url: session.url,
      sessionId: session.id,
      amount: course.price,
      currency: 'USD'
    });
  } catch (error) {
    console.error('❌ Checkout session error:', error);
    
    if (error.message === 'Checkout session creation timeout') {
      return res.status(503).json({ 
        error: 'We are experiencing issues connecting to our payments provider. Please check your internet connection and try again.' 
      });
    }
    
    if (error.type === 'StripeConnectionError') {
      return res.status(503).json({ 
        error: 'We are experiencing issues connecting to our payments provider. Please check your internet connection and try again.' 
      });
    }
    
    if (error.type === 'StripeAuthenticationError') {
      console.error('❌ Stripe API Key Error - Check your STRIPE_SECRET_KEY');
      return res.status(500).json({ 
        error: 'Payment configuration error. Please contact support.' 
      });
    }
    
    res.status(500).json({ error: 'Failed to create checkout session' });
  }
};

// ================================
// MODULE PAYMENT FUNCTIONS
// ================================

// Get module with pricing info
const getModuleDetails = async (req, res) => {
  try {
    const { moduleId } = req.params;
    const userId = req.user?.userId;

    const module = await prisma.module.findUnique({
      where: { id: parseInt(moduleId) },
      include: {
        course: {
          select: { id: true, title: true }
        }
      }
    });

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    // Check if user already owns this module
    const existingEnrollment = await prisma.moduleEnrollment.findUnique({
      where: {
        userId_moduleId: {
          userId: userId,
          moduleId: parseInt(moduleId)
        }
      }
    });

    res.json({
      module,
      isOwned: !!existingEnrollment,
      canPurchase: !existingEnrollment && !module.isFree
    });

  } catch (error) {
    console.error('Error fetching module details:', error);
    res.status(500).json({ error: 'Failed to fetch module details' });
  }
};

// Purchase individual module
const purchaseModule = async (req, res) => {
  try {
    const { moduleId } = req.body;
    const userId = req.user?.userId;

    // Get module details
    const module = await prisma.module.findUnique({
      where: { id: moduleId },
      include: { course: true }
    });

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    // Check if already enrolled
    const existingEnrollment = await prisma.moduleEnrollment.findUnique({
      where: {
        userId_moduleId: { userId, moduleId }
      }
    });

    if (existingEnrollment) {
      return res.status(400).json({ error: 'Module already purchased' });
    }

    // Handle free modules
    if (module.isFree || module.price === 0) {
      const enrollment = await prisma.moduleEnrollment.create({
        data: {
          userId,
          moduleId,
          purchasePrice: 0,
          progress: 0
        }
      });

      return res.json({
        success: true,
        message: 'Free module enrolled successfully!',
        enrollment
      });
    }

    // Create Stripe checkout for paid module
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: `${module.course.title} - ${module.title}`,
            description: module.content || `Module: ${module.title}`,
          },
          unit_amount: Math.round(module.price * 100),
        },
        quantity: 1,
      }],
      success_url: `${process.env.FRONTEND_URL}/courses/${module.courseId}/modules/${moduleId}?success=true`,
      cancel_url: `${process.env.FRONTEND_URL}/courses/${module.courseId}/modules/${moduleId}`,
      metadata: {
        type: 'module_purchase',
        userId: userId.toString(),
        moduleId: moduleId.toString(),
        price: module.price.toString()
      },
    });

    res.json({
      success: true,
      checkoutUrl: session.url,
      sessionId: session.id
    });

  } catch (error) {
    console.error('Error purchasing module:', error);
    res.status(500).json({ error: 'Failed to purchase module' });
  }
};

// Get user's module enrollments
const getUserModules = async (req, res) => {
  try {
    const userId = req.user?.userId;

    const enrollments = await prisma.moduleEnrollment.findMany({
      where: { userId },
      include: {
        module: {
          include: {
            course: {
              select: { id: true, title: true }
            }
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(enrollments);

  } catch (error) {
    console.error('Error fetching user modules:', error);
    res.status(500).json({ error: 'Failed to fetch modules' });
  }
};

// ================================
// WEBHOOK & VERIFICATION
// ================================

// Verify session
const verifySession = async (req, res) => {
  const { sessionId } = req.body;
  const userId = req.user?.userId;
  
  try {
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    if (session.payment_status === 'paid') {
      // Handle successful payment based on metadata type
      const { type, courseId, orderId } = session.metadata;
      
      if (type === 'course_purchase') {
        // Check if enrollment already exists
        const existingEnrollment = await prisma.enrollment.findFirst({
          where: { userId, courseId: parseInt(courseId) }
        });
        
        if (!existingEnrollment) {
          // Create enrollment
          await prisma.enrollment.create({
            data: {
              userId,
              courseId: parseInt(courseId),
              progress: 0.0,
              lastAccessed: new Date(),
              paymentTransactionId: session.payment_intent
            }
          });
        }
        
        // Update order status
        if (orderId) {
          await prisma.order.update({
            where: { id: parseInt(orderId) },
            data: { status: 'COMPLETED' }
          });
        }
      }
      
      res.json({ 
        success: true, 
        message: 'Payment verified and enrollment completed' 
      });
    } else {
      res.status(400).json({ 
        error: 'Payment not completed' 
      });
    }
  } catch (error) {
    console.error('Error verifying session:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
};

// 🆕 UPDATED: Enhanced webhook handler (supports modules, removes bundles)
// ADD THIS TO YOUR paymentController.js - Replace the existing stripeWebhookHandler function

const stripeWebhookHandler = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    console.log(`🎯 Webhook received: ${event.type}`);
    
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { type, userId, moduleId, courseId, orderId, bundleId, bundleType, finalPrice, itemCount } = session.metadata;
      
      console.log(`💰 Processing ${type} purchase for user ${userId}`);
      
      if (type === 'bundle_purchase') {
        // 🆕 Handle bundle purchase using bundleService
        const bundleService = require('../services/bundleService');
        
        try {
          await bundleService.processBundlePurchase(
            parseInt(bundleId), 
            parseInt(userId), 
            {
              paymentTransactionId: session.payment_intent,
              amountPaid: session.amount_total / 100
            }
          );
          
          console.log(`✅ Bundle ${bundleId} (${bundleType}) purchased by user ${userId}`);
          
        } catch (bundleError) {
          console.error(`❌ Bundle purchase processing failed:`, bundleError);
          // Continue processing other webhooks even if bundle fails
        }
        
      } else if (type === 'module_purchase') {
        // Handle individual module purchase
        await prisma.moduleEnrollment.create({
          data: {
            userId: parseInt(userId),
            moduleId: parseInt(moduleId),
            purchasePrice: session.amount_total / 100,
            paymentTransactionId: session.payment_intent,
            progress: 0,
            completed: false
          }
        });
        
        console.log(`✅ Module ${moduleId} purchased by user ${userId}`);
        
      } else if (type === 'course_purchase') {
        // Handle course purchase
        const existingEnrollment = await prisma.enrollment.findFirst({
          where: { userId: parseInt(userId), courseId: parseInt(courseId) }
        });
        
        if (!existingEnrollment) {
          await prisma.enrollment.create({
            data: {
              userId: parseInt(userId),
              courseId: parseInt(courseId),
              progress: 0.0,
              lastAccessed: new Date(),
              paymentTransactionId: session.payment_intent
            }
          });
          
          console.log(`✅ Course ${courseId} purchased by user ${userId}`);
        }
        
        // Update order status
        if (orderId) {
          await prisma.order.update({
            where: { id: parseInt(orderId) },
            data: { status: 'COMPLETED' }
          });
        }
      }
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
};

module.exports = { 
  // Course payment functions
  fastEnrollment,
  createPaymentIntent,
  confirmEnrollment,
  createCheckoutSession, 
  verifySession,
  stripeWebhookHandler,
  checkPaymentHealth,
  
  // Module payment functions
  getModuleDetails,
  purchaseModule,
  getUserModules
};