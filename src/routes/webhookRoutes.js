// backend/src/routes/webhookRoutes.js - UPDATED

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
    console.error('Webhook signature verification failed:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  console.log('Stripe webhook event received:', event.type);

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const { userId, orderId, courseId, discountCode, discountAmount, finalAmount, originalAmount } = session.metadata;

    console.log('Metadata:', { userId, orderId, courseId, discountCode, discountAmount, finalAmount });

    try {
      await prisma.$transaction(async (tx) => {
        // 1. Mark order as COMPLETED
        await tx.order.update({
          where: { id: parseInt(orderId) },
          data: { status: 'COMPLETED' },
        });

        // 2. Enroll user in the course if not exists
        const existingEnrollment = await tx.enrollment.findUnique({
          where: {
            userId_courseId: {
              userId: parseInt(userId),
              courseId: parseInt(courseId),
            },
          },
        });

        if (!existingEnrollment) {
          await tx.enrollment.create({
            data: {
              userId: parseInt(userId),
              courseId: parseInt(courseId),
              paymentTransactionId: session.id,
            },
          });
        }

        // 3. Record discount usage if applicable
        if (discountCode) {
          const discount = await tx.discountCode.findUnique({
            where: { code: discountCode },
          });

          if (!discount) {
            console.error('Discount code not found:', discountCode);
            throw new Error('Invalid discount code in webhook');
          }

          const existingUsage = await tx.discountUsage.findFirst({
            where: { orderId: parseInt(orderId) }
          });

          if (!existingUsage) {
            await tx.discountUsage.create({
              data: {
                discountCodeId: discount.id,
                userId: parseInt(userId),
                orderId: parseInt(orderId),
                originalAmount: parseFloat(originalAmount),
                discountAmount: parseFloat(discountAmount),
                finalAmount: parseFloat(finalAmount),
              },
            });

            await tx.discountCode.update({
              where: { id: discount.id },
              data: { usedCount: { increment: 1 } },
            });
          }
        }

        console.log(`Enrolled user ${userId} in course ${courseId}`);
      });

      console.log('Payment success handled, order completed.');
    } catch (err) {
      console.error('Error in webhook logic:', err);
      return res.status(500).send('Webhook handling failed');
    }
  }

  res.status(200).json({ received: true });
});


module.exports = router;