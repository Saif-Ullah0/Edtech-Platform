const enrollmentService = require('../services/enrollmentService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const enrollInCourse = async (req, res) => {
  const { courseId } = req.body;
  const userId = req.user.userId;

  try {
    console.log(`🔄 Processing enrollment: User ${userId} → Course ${courseId}`);

    // Check if already enrolled first
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: userId,
          courseId: parseInt(courseId)
        }
      }
    });

    if (existingEnrollment) {
      console.log(`⚠️ User ${userId} already enrolled in course ${courseId}`);
      return res.status(400).json({ 
        error: 'Already enrolled',
        message: 'You are already enrolled in this course',
        enrolled: true,
        enrollmentId: existingEnrollment.id
      });
    }

    // Get course details for payment processing
    const course = await prisma.course.findUnique({
      where: { id: parseInt(courseId) },
      select: { id: true, title: true, price: true }
    });

    if (!course) {
      return res.status(404).json({ 
        error: 'Course not found',
        message: 'The requested course does not exist'
      });
    }

    // Log the exact price being processed
    console.log(`💰 Course price: $${course.price} USD`);

    // Process enrollment through service
    const enrollment = await enrollmentService.enrollUserInCourse(userId, courseId);

    // Return success response with payment details
    const response = {
      success: true,
      message: course.price === 0 ? 'Successfully enrolled in free course' : 'Payment successful and enrolled in course',
      enrollment,
      course: {
        id: course.id,
        title: course.title,
        price: course.price
      },
      paidAmount: course.price,
      currency: 'USD'
    };

    console.log(`✅ Enrollment successful: User ${userId} enrolled in "${course.title}" for $${course.price} USD`);

    res.status(201).json(response);

  } catch (error) {
    console.error("❌ Enrollment Error:", error);

    // Handle specific error cases
    if (error.message === 'User already enrolled in this course') {
      return res.status(400).json({ 
        error: 'Already enrolled',
        message: 'You are already enrolled in this course',
        enrolled: true
      });
    }

    if (error.message.includes('Payment failed')) {
      return res.status(400).json({ 
        error: 'Payment failed',
        message: error.message
      });
    }

    // Generic error response
    res.status(500).json({ 
      error: 'Enrollment failed',
      message: 'Failed to process enrollment. Please try again.'
    });
  }
};

const getUserEnrollments = async (req, res) => {
  const userId = req.user.userId;

  try {
    console.log(`🔍 Fetching enrollments for user ${userId}`);
    
    const courses = await enrollmentService.getEnrolledCourses(userId);
    
    // Log enrollment details for debugging
    console.log(`✅ Found ${courses.length} enrollments for user ${userId}`);
    
    res.status(200).json(courses);
  } catch (error) {
    console.error('❌ Error fetching enrollments:', error);
    res.status(500).json({ 
      error: 'Failed to fetch enrollments',
      message: 'Unable to retrieve your enrolled courses'
    });
  }
};

const getModulesForCourse = async (req, res) => {
  const userId = req.user.userId;
  const { courseId } = req.params;

  try {
    console.log(`🔍 Fetching modules for user ${userId}, course ${courseId}`);
    
    const modules = await enrollmentService.getModulesIfEnrolled(userId, courseId);
    
    console.log(`✅ Found ${modules.length} modules for course ${courseId}`);
    
    res.status(200).json(modules);
  } catch (error) {
    console.error('❌ Error fetching modules:', error);
    
    if (error.message.includes('not enrolled')) {
      return res.status(403).json({ 
        error: 'Not enrolled',
        message: 'You must be enrolled in this course to access modules'
      });
    }
    
    res.status(500).json({ 
      error: 'Failed to fetch modules',
      message: error.message
    });
  }
};

// New function to get enrollment status
const getEnrollmentStatus = async (req, res) => {
  const userId = req.user.userId;
  const { courseId } = req.params;

  try {
    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId: userId,
          courseId: parseInt(courseId)
        }
      },
      include: {
        course: {
          select: { title: true, price: true }
        }
      }
    });

    if (enrollment) {
      res.json({
        enrolled: true,
        enrollment: {
          id: enrollment.id,
          enrolledAt: enrollment.createdAt,
          progress: enrollment.progress,
          lastAccessed: enrollment.lastAccessed,
          course: enrollment.course
        }
      });
    } else {
      res.json({
        enrolled: false
      });
    }

  } catch (error) {
    console.error('❌ Error checking enrollment status:', error);
    res.status(500).json({ 
      error: 'Failed to check enrollment status'
    });
  }
};

module.exports = {
  enrollInCourse,
  getUserEnrollments,
  getModulesForCourse,
  getEnrollmentStatus
};