const { PrismaClient } = require('@prisma/client');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const prisma = new PrismaClient();

// Test Stripe connection
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

// Health check endpoint
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

// Updated createCheckoutSession
const createCheckoutSession = async (req, res) => {
  try {
    const { courseId, couponCode } = req.body;
    const userId = req.user.id;

    console.log(`🔄 Creating checkout session: User ${userId} → Course ${courseId} with coupon ${couponCode || 'none'}`);

    // Validate course
    const course = await prisma.course.findUnique({
      where: { id: parseInt(courseId) },
      select: { id: true, title: true, price: true, isPaid: true },
    });

    if (!course) {
      console.log(`❌ Course ${courseId} not found`);
      return res.status(404).json({ success: false, message: 'Course not found' });
    }

    let finalAmount = course.price * 100; // Convert to cents
    let discountCode = null;
    let discountAmount = 0;

    // Validate coupon if provided
    if (couponCode) {
      discountCode = await prisma.discountCode.findUnique({
        where: { code: couponCode },
      });

      if (!discountCode || !discountCode.isActive) {
        console.log(`❌ Invalid or inactive coupon: ${couponCode}`);
        return res.status(400).json({ success: false, message: 'Invalid or inactive coupon' });
      }

      // Check coupon applicability
      if (discountCode.applicableToType === 'COURSE' && discountCode.applicableToId !== parseInt(courseId)) {
        console.log(`❌ Coupon ${couponCode} not applicable to course ${courseId}`);
        return res.status(400).json({ success: false, message: 'Coupon not applicable to this course' });
      }

      // Check usage limits
      const userUsageCount = await prisma.discountUsage.count({
        where: { discountCodeId: discountCode.id, userId },
      });

      if (discountCode.maxUsesPerUser && userUsageCount >= discountCode.maxUsesPerUser) {
        console.log(`❌ Coupon ${couponCode} usage limit exceeded for user ${userId}`);
        return res.status(400).json({ success: false, message: 'Coupon usage limit exceeded' });
      }

      if (discountCode.maxUses && discountCode.usedCount >= discountCode.maxUses) {
        console.log(`❌ Coupon ${couponCode} max uses reached`);
        return res.status(400).json({ success: false, message: 'Coupon max uses reached' });
      }

      // Calculate discount
      if (discountCode.type === 'PERCENTAGE') {
        discountAmount = (finalAmount * discountCode.value) / 100;
      } else if (discountCode.type === 'FIXED_AMOUNT') {
        discountAmount = discountCode.value * 100;
      }

      if (discountCode.maxDiscountAmount && discountAmount > discountCode.maxDiscountAmount * 100) {
        discountAmount = discountCode.maxDiscountAmount * 100;
      }

      finalAmount = Math.max(0, finalAmount - discountAmount);

      console.log(`✅ Coupon ${couponCode} validated: Original=${course.price * 100}, Discount=${discountAmount}, Final=${finalAmount}`);
    }

    // If final amount is 0 (free course or fully discounted), enroll directly
    if (finalAmount === 0 || !course.isPaid) {
      const enrollment = await prisma.enrollment.create({
        data: {
          userId,
          courseId: parseInt(courseId),
          progress: 0,
        },
      });

      if (discountCode) {
        await prisma.discountUsage.create({
          data: {
            discountCodeId: discountCode.id,
            userId,
            originalAmount: course.price * 100,
            discountAmount,
            finalAmount,
          },
        });

        await prisma.discountCode.update({
          where: { id: discountCode.id },
          data: { usedCount: { increment: 1 } },
        });
      }

      console.log(`✅ Free course enrolled: User ${userId}, Course ${courseId}, Enrollment ${enrollment.id}`);
      return res.json({
        success: true,
        message: 'Course enrolled successfully',
        discountApplied: discountCode
          ? {
              couponCode,
              originalAmount: course.price * 100,
              discountAmount,
              finalAmount,
            }
          : null,
      });
    }

    // Create order for paid course
    console.log(`🔄 Creating order: User ${userId}, Course ${courseId}, Total ${finalAmount / 100}, DiscountCode ${discountCode ? discountCode.id : 'none'}`);
    const order = await prisma.order.create({
      data: {
        userId,
        status: 'PENDING',
        totalAmount: finalAmount / 100, // Store in dollars
        discountCodeId: discountCode ? discountCode.id : null,
        items: {
          create: [
            {
              courseId: parseInt(courseId),
              price: course.price, // Store original price in dollars
            },
          ],
        },
      },
    });

    // Create Stripe checkout session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: course.title,
              metadata: { courseId: courseId.toString() },
            },
            unit_amount: Math.round(finalAmount), // In cents
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}&course_id=${courseId}&order_id=${order.id}`,
      cancel_url: `${process.env.FRONTEND_URL}/checkout?courseId=${courseId}`,
      metadata: {
        type: 'course_purchase', // Added type metadata
        userId: userId.toString(),
        courseId: courseId.toString(),
        orderId: order.id.toString(),
        couponCode: couponCode || '',
      },
    });

    // Record discount usage
    if (discountCode) {
      await prisma.discountUsage.create({
        data: {
          discountCodeId: discountCode.id,
          userId,
          orderId: order.id,
          originalAmount: course.price * 100,
          discountAmount,
          finalAmount,
        },
      });

      await prisma.discountCode.update({
        where: { id: discountCode.id },
        data: { usedCount: { increment: 1 } },
      });
    }

    console.log(`✅ Checkout session created: ${session.id}, URL: ${session.url}`);
    res.json({
      success: true,
      url: session.url,
      sessionId: session.id,
      orderId: order.id,
      discountApplied: discountCode
        ? {
            couponCode,
            originalAmount: course.price * 100,
            discountAmount,
            finalAmount,
          }
        : null,
    });
  } catch (error) {
    console.error('❌ Checkout session error:', error);
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'Failed to create checkout session' : error.message,
    });
  }
};

// Updated verifySession
const verifySession = async (req, res) => {
  const { sessionId, courseId, orderId } = req.body;
  const userId = req.user?.userId;
  
  try {
    console.log('🔍 Verifying payment session:', { sessionId, courseId, orderId, userId });

    if (!sessionId || !userId) {
      console.log('❌ Missing sessionId or userId');
      return res.status(400).json({ 
        success: false,
        error: 'Missing session ID or user authentication' 
      });
    }

    // Verify Stripe session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.payment_status !== 'paid') {
      console.log('❌ Payment not completed:', session.payment_status);
      return res.status(400).json({ 
        success: false,
        error: 'Payment not completed' 
      });
    }

    // Log full metadata for debugging
    console.log('📋 Session metadata:', session.metadata);

    // Handle successful payment based on metadata type
    const { type, courseId: metadataCourseId, orderId: metadataOrderId } = session.metadata;
    
    if (!type || type !== 'course_purchase') {
      console.log('❌ Invalid or missing purchase type:', type);
      return res.status(400).json({ 
        success: false,
        error: 'Unsupported purchase type' 
      });
    }

    // Validate courseId and orderId
    if (courseId && parseInt(courseId) !== parseInt(metadataCourseId)) {
      console.log('❌ Course ID mismatch:', { providedCourseId: courseId, metadataCourseId });
      return res.status(400).json({ 
        success: false,
        error: 'Course ID mismatch' 
      });
    }
    if (orderId && parseInt(orderId) !== parseInt(metadataOrderId)) {
      console.log('❌ Order ID mismatch:', { providedOrderId: orderId, metadataOrderId });
      return res.status(400).json({ 
        success: false,
        error: 'Order ID mismatch' 
      });
    }

    // Fetch order details
    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId || metadataOrderId) },
      include: {
        items: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
                description: true,
                price: true,
                category: true,
                instructor: true
              }
            }
          }
        }
      }
    });

    if (!order || order.userId !== userId) {
      console.log('❌ Order not found or unauthorized:', { orderId: orderId || metadataOrderId, userId });
      return res.status(404).json({ 
        success: false,
        error: 'Order not found or unauthorized' 
      });
    }

    // Check enrollment
    const enrollment = await prisma.enrollment.findFirst({
      where: { userId, courseId: parseInt(courseId || metadataCourseId) }
    });

    if (!enrollment) {
      console.log('🆕 Creating enrollment for user:', userId, 'course:', courseId || metadataCourseId);
      await prisma.enrollment.create({
        data: {
          userId,
          courseId: parseInt(courseId || metadataCourseId),
          progress: 0.0,
          lastAccessed: new Date(),
          paymentTransactionId: session.payment_intent
        }
      });
    }

    // Update order status if not already completed
    if (order.status === 'PENDING') {
      console.log('🔄 Updating order status to COMPLETED:', order.id);
      await prisma.order.update({
        where: { id: order.id },
        data: { status: 'COMPLETED' }
      });
    }

    if (order.status !== 'COMPLETED') {
      console.log('❌ Order not completed:', order.status);
      return res.status(400).json({ 
        success: false,
        error: 'Order not completed' 
      });
    }

    console.log('✅ Payment verified successfully:', { orderId: order.id, sessionId });

    res.json({
      success: true,
      message: 'Payment verified and enrollment completed',
      order: {
        id: order.id,
        userId: order.userId,
        status: order.status,
        totalAmount: order.totalAmount,
        createdAt: order.createdAt.toISOString(),
        items: order.items.map(item => ({
          id: item.id,
          courseId: item.courseId,
          price: item.price,
          course: item.course ? {
            id: item.course.id,
            title: item.course.title,
            description: item.course.description,
            price: item.course.price,
            category: item.course.category,
            instructor: item.course.instructor
          } : undefined
        }))
      },
      transactionId: session.payment_intent,
      amount: order.totalAmount,
      currency: session.currency?.toUpperCase() || 'USD'
    });

  } catch (error) {
    console.error('❌ Error verifying session:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to verify payment',
      details: error.message
    });
  }
};

// Other functions (unchanged)
const fastEnrollment = async (req, res) => {
  const { courseId, paymentMethodId } = req.body;
  const userId = req.user?.userId;
  console.log(`🚀 Fast enrollment: User ${userId} → Course ${courseId}`);
  
  if (!courseId) {
    return res.status(400).json({ error: 'Missing courseId' });
  }
  
  try {
    if (paymentMethodId) {
      const isConnected = await testStripeConnection();
      if (!isConnected) {
        return res.status(503).json({ 
          error: 'We are experiencing issues connecting to our payments provider. Please check your internet connection and try again.' 
        });
      }
    }

    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });
    
    if (!course) {
      console.log(`❌ Course ${courseId} not found`);
      return res.status(400).json({ error: 'Course not found' });
    }
    
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
    
    if (!paymentMethodId) {
      return res.status(400).json({ 
        error: 'Payment method required for paid course' 
      });
    }
    
    const amountInCents = Math.round(course.price * 100);
    console.log(`💳 Processing payment: $${course.price} USD (${amountInCents} cents)`);
    
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

const createPaymentIntent = async (req, res) => {
  const { courseId } = req.body;
  const userId = req.user?.userId;
  
  try {
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

const confirmEnrollment = async (req, res) => {
  const { paymentIntentId, courseId } = req.body;
  const userId = req.user?.userId;
  
  try {
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

const purchaseModule = async (req, res) => {
  try {
    const { moduleId } = req.body;
    const userId = req.user?.userId;

    const module = await prisma.module.findUnique({
      where: { id: moduleId },
      include: { course: true }
    });

    if (!module) {
      return res.status(404).json({ error: 'Module not found' });
    }

    const existingEnrollment = await prisma.moduleEnrollment.findUnique({
      where: {
        userId_moduleId: { userId, moduleId }
      }
    });

    if (existingEnrollment) {
      return res.status(400).json({ error: 'Module already purchased' });
    }

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

const stripeWebhookHandler = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  
  try {
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
    console.log(`🎯 Webhook received: ${event.type}`);
    
    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const { type, userId, moduleId, courseId, orderId, discountCode, discountAmount, finalAmount, originalAmount } = session.metadata;
      
      console.log(`💰 Processing ${type} purchase for user ${userId}`);
      
      if (type === 'bundle_purchase') {
        // Handle bundle if needed
      } else if (type === 'module_purchase') {
        const existing = await prisma.moduleEnrollment.findUnique({
          where: { userId_moduleId: { userId: parseInt(userId), moduleId: parseInt(moduleId) } }
        });
        if (!existing) {
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
        }
        
        console.log(`✅ Module ${moduleId} purchased by user ${userId}`);
        
      } else if (type === 'course_purchase') {
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
        
        if (orderId) {
          await prisma.order.update({
            where: { id: parseInt(orderId) },
            data: { status: 'COMPLETED' }
          });
        }

        if (discountCode) {
          const discount = await prisma.discountCode.findUnique({
            where: { code: discountCode },
          });

          if (discount) {
            const existingUsage = await prisma.discountUsage.findFirst({
              where: { orderId: parseInt(orderId) }
            });

            if (!existingUsage) {
              await prisma.discountUsage.create({
                data: {
                  discountCodeId: discount.id,
                  userId: parseInt(userId),
                  orderId: parseInt(orderId),
                  originalAmount: parseFloat(originalAmount),
                  discountAmount: parseFloat(discountAmount),
                  finalAmount: parseFloat(finalAmount),
                },
              });

              await prisma.discountCode.update({
                where: { id: discount.id },
                data: { usedCount: { increment: 1 } },
              });
            }
          }
        }
      }
    }
    
    res.json({ received: true });
  } catch (error) {
    console.error('❌ Webhook error:', error);
    res.status(400).send(`Webhook Error: ${error.message}`);
  }
};

const getOrderDetails = async (req, res) => {
  const { id } = req.params;
  const userId = req.user.id;

  try {
    const order = await prisma.order.findUnique({
      where: { id: parseInt(id) },
      include: {
        items: {
          include: {
            course: {
              select: {
                id: true,
                title: true,
                description: true,
                price: true,
                category: true,
                instructor: true,
              },
            },
          },
        },
      },
    });

    if (!order) {
      return res.status(404).json({ success: false, message: 'Order not found' });
    }

    if (order.userId !== userId) {
      return res.status(403).json({ success: false, message: 'Unauthorized access to order' });
    }

    res.json({ success: true, order });
  } catch (error) {
    console.error('Error fetching order details:', error);
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'Failed to fetch order details' : error.message,
    });
  }
};

module.exports = { 
  fastEnrollment,
  createPaymentIntent,
  confirmEnrollment,
  createCheckoutSession, 
  verifySession,
  stripeWebhookHandler,
  checkPaymentHealth,
  getModuleDetails,
  purchaseModule,
  getUserModules,
  getOrderDetails
};