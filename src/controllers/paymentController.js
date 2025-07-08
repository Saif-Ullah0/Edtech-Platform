const Stripe = require('stripe');
const prisma = require('../../prisma/client');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const createCheckoutSession = async (req, res) => {
  const { orderId } = req.body;
  const userId = req.user?.userId;

  try {
    const order = await prisma.order.findUnique({
      where: { id: orderId },
      include: {
        items: {
          include: { course: true },
        },
      },
    });

    if (!order || order.userId !== userId || order.status !== 'PENDING') {
      return res.status(400).json({ error: 'Invalid or unauthorized order' });
    }

    const lineItems = order.items.map((item) => ({
      price_data: {
        currency: 'pkr',
        product_data: {
          name: item.course.title,
          description: item.course.description,
        },
        unit_amount: Math.round(item.price * 100),
      },
      quantity: 1,
    }));

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode: 'payment',
      line_items: lineItems,
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
console.log("🎯 Stripe webhook triggered:", event.type);

if (event.type === 'checkout.session.completed') {
  console.log("✅ Payment completed");

  const session = event.data.object;
  const userId = parseInt(session.metadata.userId);
  const orderId = parseInt(session.metadata.orderId);

  console.log("➡️ Metadata:", { userId, orderId });

  try {
    const updatedOrder = await prisma.order.update({
      where: { id: orderId },
      data: { status: 'COMPLETED' },
    });

    console.log("✅ Order updated:", updatedOrder);

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
      console.log("✅ Enrollment created:", enrolled);
    }

    return res.status(200).json({ received: true });
  } catch (error) {
    console.error("🔥 Error in webhook logic:", error.message);
    return res.status(500).send("Webhook failed");
  }
} else {
  console.warn("⚠️ Unhandled event type:", event.type);
  return res.status(200).json({ received: true });
}
};

module.exports = { createCheckoutSession, stripeWebhookHandler }; 
