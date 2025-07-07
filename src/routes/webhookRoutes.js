const express = require('express');
const router = express.Router();
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);
const prisma = require('../../prisma/client'); // adjust if needed
const bodyParser = require('body-parser');

// Stripe requires raw body for webhooks
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
    console.error('Webhook signature verification failed.', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  // ✅ Handle event type
  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const userId = session.metadata.userId;
    const courseId = session.metadata.courseId;

    try {
      await prisma.enrollment.create({
        data: {
          userId: parseInt(userId),
          courseId: parseInt(courseId),
        },
      });
      console.log('User enrolled after payment via webhook');
    } catch (err) {
      console.error(' Error enrolling user via webhook:', err);
    }
  }

  res.status(200).json({ received: true });
});

module.exports = router;
