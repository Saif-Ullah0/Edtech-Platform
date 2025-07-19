const Stripe = require('stripe');
const prisma = require('../../prisma/client');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const createCheckoutSession = async (req, res) => {
  const { courseId } = req.body;
  const userId = req.user?.userId;

  if (!courseId) {
    return res.status(400).json({ error: 'Missing courseId' });
  }

  try {
    // ✅ Check if course exists
    const course = await prisma.course.findUnique({
      where: { id: courseId },
    });
    if (!course) return res.status(400).json({ error: 'Course not found' });

    // ✅ Check if user is already enrolled
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: {
        userId: userId,
        courseId: courseId
      }
    });

    if (existingEnrollment) {
      return res.status(400).json({ error: 'Already enrolled in this course' });
    }

    const totalAmount = course.price;

    // 2. Create order with totalAmount
    const order = await prisma.order.create({
      data: {
        userId,
        status: 'PENDING',
        totalAmount,
        items: {
          create: [
            {
              courseId: course.id,
              price: course.price,
            },
          ],
        },
      },
      include: {
        items: {
          include: { course: true },
        },
      },
    });

    // ✅ Create Stripe session with updated success URL
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: course.title,
            description: course.description,
          },
          unit_amount: Math.round(course.price * 100),
        },
        quantity: 1,
      }],
      // ✅ FIXED: Include courseId in success URL
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}&course_id=${courseId}&order_id=${order.id}`,
      cancel_url: `${process.env.FRONTEND_URL}/courses/${courseId}`,
      metadata: {
        orderId: order.id.toString(),
        userId: userId.toString(),
        courseId: courseId.toString(), // ✅ Added courseId to metadata
      },
    });

    res.status(200).json({ url: session.url });

  } catch (error) {
    console.error('Stripe Checkout Error:', error);
    res.status(500).json({ error: 'Failed to create Stripe session' });
  }
};

// ✅ ADD: Verify payment session endpoint
const verifySession = async (req, res) => {
  try {
    const { sessionId, courseId } = req.body;
    const userId = req.user?.userId || req.user?.id; // ✅ Handle both field names

    if (!sessionId) {
      return res.status(400).json({ error: 'Session ID is required' });
    }

    if (!userId) {
      return res.status(401).json({ error: 'User not authenticated' });
    }

    // Retrieve the Stripe session
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session) {
      return res.status(400).json({ error: 'Invalid session ID' });
    }

    // Check if payment was successful
    if (session.payment_status !== 'paid') {
      return res.status(400).json({ 
        error: 'Payment not completed',
        paymentStatus: session.payment_status 
      });
    }

    // Get order from metadata
    const orderId = parseInt(session.metadata.orderId);
    
    // Get order details with course information
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: {
            course: {
              include: {
                category: true
              }
            }
          }
        }
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }

    // Check if user is enrolled (enrollment should be created by webhook)
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: parseInt(userId),
        courseId: parseInt(courseId || session.metadata.courseId)
      }
    });

    // Get the course details
    const course = order.items[0]?.course;

    res.json({
      success: true,
      message: 'Payment verified successfully',
      course: course,
      amount: order.totalAmount,
      currency: 'USD',
      enrollment: enrollment,
      order: order,
      transactionId: session.payment_intent || sessionId
    });

  } catch (error) {
    console.error('Payment verification error:', error);
    res.status(500).json({ 
      error: 'Failed to verify payment',
      details: error.message 
    });
  }
};

const stripeWebhookHandler = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook Error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log("Stripe webhook triggered:", event.type);

  if (event.type === 'checkout.session.completed') {
    console.log("Payment completed");

    const session = event.data.object;
    const userId = parseInt(session.metadata.userId);
    const orderId = parseInt(session.metadata.orderId);

    console.log("Metadata:", { userId, orderId });

    try {
      // ✅ Update order status
      const updatedOrder = await prisma.order.update({
        where: { id: orderId },
        data: { status: 'COMPLETED' },
      });

      console.log("Order updated:", updatedOrder);

      // ✅ Create enrollments for all items in the order
      const orderItems = await prisma.orderItem.findMany({
        where: { orderId },
      });

      for (const item of orderItems) {
        // ✅ Check if enrollment already exists
        const existingEnrollment = await prisma.enrollment.findFirst({
          where: {
            userId: userId,
            courseId: item.courseId
          }
        });

        if (!existingEnrollment) {
          const enrolled = await prisma.enrollment.create({
            data: {
              userId,
              courseId: item.courseId,
            },
          });
          console.log("Enrollment created:", enrolled);
        } else {
          console.log("Enrollment already exists for user:", userId, "course:", item.courseId);
        }
      }

      return res.status(200).json({ received: true });
    } catch (error) {
      console.error("Error in webhook logic:", error.message);
      return res.status(500).send("Webhook failed");
    }
  } else {
    console.warn("Unhandled event type:", event.type);
    return res.status(200).json({ received: true });
  }
};

module.exports = { createCheckoutSession, verifySession, stripeWebhookHandler };