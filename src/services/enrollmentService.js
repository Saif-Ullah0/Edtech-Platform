const prisma = require('../../prisma/client');
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

const enrollUserInCourse = async (userId, courseId, paymentMethodId = null) => {
  const numericCourseId = parseInt(courseId, 10);

  // Check if already enrolled
  const existingEnrollment = await prisma.enrollment.findFirst({
    where: {
      userId,
      courseId: numericCourseId,
    },
  });

  if (existingEnrollment) {
    throw new Error('User already enrolled in this course');
  }

  // Get course details
  const course = await prisma.course.findUnique({
    where: { id: numericCourseId },
    select: { id: true, title: true, price: true }
  });

  if (!course) {
    throw new Error('Course not found');
  }

  // Get user details for Stripe
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, email: true, name: true }
  });

  console.log(`💰 Processing enrollment: ${user.name} → ${course.title} ($${course.price} USD)`);

  // Handle free courses
  if (course.price === 0) {
    console.log('✅ Free course - creating enrollment directly');
    return await createEnrollment(userId, numericCourseId, null);
  }

  // Handle paid courses - process Stripe payment
  try {
    const paymentResult = await processStripePayment(course, user, paymentMethodId);
    
    if (!paymentResult.success) {
      throw new Error(`Payment failed: ${paymentResult.error}`);
    }

    console.log(`✅ Stripe payment successful - Charge ID: ${paymentResult.chargeId}`);

    // Create enrollment after successful payment
    return await createEnrollment(userId, numericCourseId, paymentResult.chargeId);

  } catch (error) {
    console.error(`❌ Stripe payment failed:`, error);
    throw new Error(`Payment failed: ${error.message}`);
  }
};

const processStripePayment = async (course, user, paymentMethodId) => {
  try {
    // CRITICAL: Ensure amount is in cents and currency is USD
    const amountInCents = Math.round(course.price * 100);
    
    console.log(`🔄 Stripe Payment Details:`);
    console.log(`   Course: ${course.title}`);
    console.log(`   Price: $${course.price} USD`);
    console.log(`   Amount in cents: ${amountInCents}`);
    console.log(`   User: ${user.email}`);

    // Create payment intent with explicit USD currency
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd', // EXPLICITLY SET TO USD
      payment_method: paymentMethodId,
      confirm: true,
      automatic_payment_methods: {
        enabled: true,
        allow_redirects: 'never'
      },
      metadata: {
        courseId: course.id.toString(),
        courseTitle: course.title,
        userId: user.id.toString(),
        userEmail: user.email,
        priceUSD: course.price.toString()
      },
      description: `Course: ${course.title} - Student: ${user.email}`,
      receipt_email: user.email
    });

    console.log(`✅ Stripe PaymentIntent created: ${paymentIntent.id}`);
    console.log(`   Status: ${paymentIntent.status}`);
    console.log(`   Amount: ${paymentIntent.amount} cents ($${paymentIntent.amount / 100} USD)`);

    if (paymentIntent.status === 'succeeded') {
      return {
        success: true,
        chargeId: paymentIntent.id,
        amount: course.price,
        currency: 'USD',
        stripeAmount: paymentIntent.amount
      };
    } else {
      return {
        success: false,
        error: `Payment status: ${paymentIntent.status}`
      };
    }

  } catch (stripeError) {
    console.error('❌ Stripe Error:', stripeError);
    
    // Handle specific Stripe errors
    if (stripeError.type === 'StripeCardError') {
      return {
        success: false,
        error: `Card error: ${stripeError.message}`
      };
    }
    
    return {
      success: false,
      error: stripeError.message || 'Payment processing failed'
    };
  }
};

const createEnrollment = async (userId, courseId, stripeChargeId) => {
  const enrollmentData = {
    userId,
    courseId,
    progress: 0.0,
    lastAccessed: new Date()
  };

  // Add Stripe charge ID if it's a paid enrollment
  if (stripeChargeId) {
    enrollmentData.paymentTransactionId = stripeChargeId;
  }

  const enrollment = await prisma.enrollment.create({
    data: enrollmentData,
    include: {
      course: {
        select: { title: true, price: true }
      }
    }
  });

  console.log(`✅ Enrollment created: User ${userId} → Course ${enrollment.course.title}`);
  return enrollment;
};

// Alternative method for creating payment intent (frontend can confirm)
const createPaymentIntent = async (courseId, userId) => {
  const course = await prisma.course.findUnique({
    where: { id: parseInt(courseId) }
  });

  const user = await prisma.user.findUnique({
    where: { id: userId }
  });

  if (!course || !user) {
    throw new Error('Course or user not found');
  }

  if (course.price === 0) {
    throw new Error('Cannot create payment intent for free course');
  }

  const amountInCents = Math.round(course.price * 100);

  console.log(`🔄 Creating PaymentIntent: $${course.price} USD (${amountInCents} cents)`);

  const paymentIntent = await stripe.paymentIntents.create({
    amount: amountInCents,
    currency: 'usd', // EXPLICIT USD
    metadata: {
      courseId: course.id.toString(),
      courseTitle: course.title,
      userId: user.id.toString(),
      userEmail: user.email,
      priceUSD: course.price.toString()
    },
    description: `Course: ${course.title} - Student: ${user.email}`
  });

  return {
    clientSecret: paymentIntent.client_secret,
    amount: course.price,
    currency: 'USD'
  };
};

const getEnrolledCourses = async (userId) => {
  const enrollments = await prisma.enrollment.findMany({
    where: { userId },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          description: true,
          price: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });

  console.log(`📚 Found ${enrollments.length} enrollments for user ${userId}`);
  return enrollments;
};

const getModulesIfEnrolled = async (userId, courseId) => {
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId, courseId: parseInt(courseId) },
  });

  if (!enrollment) {
    throw new Error('Access denied: Not enrolled in this course');
  }

  return await prisma.module.findMany({
    where: { courseId: parseInt(courseId) },
    select: {
      id: true,
      title: true,
      content: true,
    },
  });
};

module.exports = {
  enrollUserInCourse,
  createPaymentIntent,
  getEnrolledCourses,
  getModulesIfEnrolled,
};