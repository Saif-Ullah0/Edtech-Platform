// backend/controllers/debugController.js
const prisma = require('../../prisma/client');
const Stripe = require('stripe');
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Debug user enrollments
const getUserEnrollments = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    const enrollments = await prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          include: {
            category: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      userId,
      totalEnrollments: enrollments.length,
      enrollments
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Debug user orders
const getUserOrders = async (req, res) => {
  try {
    const userId = req.user?.userId;
    
    const orders = await prisma.order.findMany({
      where: { userId },
      include: {
        items: {
          include: {
            course: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json({
      userId,
      totalOrders: orders.length,
      orders
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Debug specific session
const debugSession = async (req, res) => {
  try {
    const { sessionId } = req.params;
    const userId = req.user?.userId;

    // Get Stripe session
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    
    // Get order from metadata
    const orderId = session.metadata?.orderId;
    let order = null;
    let enrollments = [];

    if (orderId) {
      order = await prisma.order.findUnique({
        where: { id: parseInt(orderId) },
        include: {
          items: {
            include: {
              course: true
            }
          }
        }
      });

      // Check enrollments for this user and courses in this order
      if (order) {
        const courseIds = order.items.map(item => item.courseId);
        enrollments = await prisma.enrollment.findMany({
          where: {
            userId,
            courseId: { in: courseIds }
          },
          include: {
            course: true
          }
        });
      }
    }

    res.json({
      debug: {
        sessionId,
        userId,
        stripePaymentStatus: session.payment_status,
        stripeMetadata: session.metadata,
        hasOrder: !!order,
        orderStatus: order?.status,
        enrollmentsFound: enrollments.length,
        shouldBeEnrolled: session.payment_status === 'paid' && order?.status === 'COMPLETED'
      },
      session: {
        id: session.id,
        payment_status: session.payment_status,
        payment_intent: session.payment_intent,
        metadata: session.metadata,
        amount_total: session.amount_total,
        currency: session.currency
      },
      order,
      enrollments
    });

  } catch (error) {
    console.error('Debug session error:', error);
    res.status(500).json({ error: error.message });
  }
};

// Force create enrollment (for debugging)
const forceCreateEnrollment = async (req, res) => {
  try {
    const { courseId } = req.body;
    const userId = req.user?.userId;

    if (!courseId) {
      return res.status(400).json({ error: 'courseId required' });
    }

    // Check if already enrolled
    const existing = await prisma.enrollment.findFirst({
      where: { userId, courseId: parseInt(courseId) }
    });

    if (existing) {
      return res.json({
        message: 'Already enrolled',
        enrollment: existing
      });
    }

    // Create enrollment
    const enrollment = await prisma.enrollment.create({
      data: {
        userId,
        courseId: parseInt(courseId)
      },
      include: {
        course: true
      }
    });

    res.json({
      message: 'Enrollment created',
      enrollment
    });

  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Test webhook processing
const testWebhookProcessing = async (req, res) => {
  try {
    const { orderId } = req.body;

    if (!orderId) {
      return res.status(400).json({ error: 'orderId required' });
    }

    // Get order
    const order = await prisma.order.findUnique({
      where: { id: parseInt(orderId) },
      include: {
        items: true
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    console.log('Processing order manually:', order);

    // Update order status
    const updatedOrder = await prisma.order.update({
      where: { id: parseInt(orderId) },
      data: { status: 'COMPLETED' }
    });

    // Create enrollments
    const enrollments = [];
    for (const item of order.items) {
      const existing = await prisma.enrollment.findFirst({
        where: {
          userId: order.userId,
          courseId: item.courseId
        }
      });

      if (!existing) {
        const enrollment = await prisma.enrollment.create({
          data: {
            userId: order.userId,
            courseId: item.courseId
          }
        });
        enrollments.push(enrollment);
      }
    }

    res.json({
      message: 'Order processed manually',
      updatedOrder,
      enrollmentsCreated: enrollments
    });

  } catch (error) {
    console.error('Test webhook error:', error);
    res.status(500).json({ error: error.message });
  }
};

module.exports = {
  getUserEnrollments,
  getUserOrders,
  debugSession,
  forceCreateEnrollment,
  testWebhookProcessing
};