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
   // 1. Get course price
const course = await prisma.course.findUnique({
  where: { id: courseId }, // assuming courseId is passed from frontend
});
if (!course) return res.status(400).json({ error: 'Course not found' });

const totalAmount = course.price;

// 2. Create order with totalAmount
const order = await prisma.order.create({
  data: {
    userId,
    status: 'PENDING',
    totalAmount, // ✅ FIXED
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

    // ✅ Create Stripe session
    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: [{
        price_data: {
          currency: 'pkr',
          product_data: {
            name: course.title,
            description: course.description,
          },
          unit_amount: Math.round(course.price * 100),
        },
        quantity: 1,
      }],
      success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      metadata: {
        orderId: order.id.toString(),
        userId: userId.toString(),
      },
    });

    res.status(200).json({ url: session.url });

  } catch (error) {
    console.error('Stripe Checkout Error:', error);
    res.status(500).json({ error: 'Failed to create Stripe session' });
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
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'COMPLETED' },
    });

    console.log("Order updated:", updatedOrder);

    const orderItems = await prisma.orderItem.findMany({
      where: { orderId },
    });

    for (const item of orderItems) {
      const enrolled = await prisma.enrollment.create({
        data: {
          userId,
          courseId: item.courseId,
        },
      });
      console.log("Enrollment created:", enrolled);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error(" Error in webhook logic:", error.message);
    return res.status(500).send("Webhook failed");
  }
} else {
  console.warn(" Unhandled event type:", event.type);
  return res.status(200).json({ received: true });
}
};

module.exports = { createCheckoutSession, stripeWebhookHandler }; 
