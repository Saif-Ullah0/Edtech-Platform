const Stripe = require('stripe');
const prisma = require('../../prisma/client');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const createCheckoutSession = async (req, res) => {
  const { courseId } = req.body;
  const userId = req.user.userId; 

  try {
    const course = await prisma.course.findUnique({
      where: { id: parseInt(courseId) },
      select: {
        id: true,
        title: true,
        price: true,
        description: true,
      },
    });

    if (!course) {
      return res.status(404).json({ error: 'Course not found' });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'pkr',
            product_data: {
              name: course.title,
              description: course.description,
            },
            unit_amount: Math.round(course.price * 100),
          },
          quantity: 1,
        }
      ],
      mode: 'payment',
success_url: `${process.env.FRONTEND_URL}/success?session_id={CHECKOUT_SESSION_ID}`,
  cancel_url: `${process.env.FRONTEND_URL}/cancel`,
      metadata: {
        userId: userId.toString(),
        courseId: course.id.toString(),
      }
    });

res.status(200).json({ url: session.url });
  } catch (error) {
    console.error('Stripe Checkout Error:', error);
    res.status(500).json({ error: 'Failed to create Stripe session' });
  }
};


const stripeWebhookHandler = async (req, res) => 
{
  const sig = req.headers['stripe-signature'];
  const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET;

  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, endpointSecret);
  } catch (err) {
    console.error('Webhook Error:', err.message);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

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
          console.log('User enrolled via webhook');

  } catch (error) {
    console.error('Enrollment Creation Error:', error.message);
    return res.status(500).send('Internal Server Error');
  }

  res.status(200).json({ received: true });
}
  else {
    console.warn(`Unhandled event type: ${event.type}`);
    res.status(200).json({ received: true });
  }
};


module.exports = { createCheckoutSession, stripeWebhookHandler };
