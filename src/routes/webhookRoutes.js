const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const prisma = require('../../prisma/client');
const bodyParser = require('body-parser');

// Stripe requires raw body
router.post('/', bodyParser.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];

  let event;

  try {
    event = stripe.webhooks.constructEvent(
      req.body,
      sig,
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch (err) {
    console.error(' Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('Stripe webhook event received:', event.type);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = parseInt(session.metadata.userId);
    const orderId = parseInt(session.metadata.orderId);

    console.log(' Metadata:', { userId, orderId });

    try {
      // ✅ 1. Mark order as COMPLETED
      await prisma.order.update({
        where: { id: orderId },
        data: { status: 'COMPLETED' },
      });

      // ✅ 2. Get all courses from the order
      const orderItems = await prisma.orderItem.findMany({
        where: { orderId },
      });

      // ✅ 3. Enroll user in each course
      for (const item of orderItems) {
        await prisma.enrollment.create({
          data: {
            userId,
            courseId: item.courseId,
          },
        });
        console.log(` Enrolled user ${userId} in course ${item.courseId}`);
      }

      console.log(' Payment success handled, order completed.');
    } catch (err) {
      console.error(' Error in webhook logic:', err);
      return res.status(500).send('Webhook handling failed');
    }
  }

  res.status(200).json({ received: true });
});

module.exports = router;
