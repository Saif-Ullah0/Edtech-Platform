// backend/src/routes/enrollmentRoutes.js
// Add the missing my-courses endpoint

const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// GET /api/enroll/my-courses - Get user's enrolled courses
router.get('/my-courses', async (req, res) => {
  try {
    console.log('🎓 Fetching my courses for user:', req.user.id);
    
    const userId = req.user.id;

    // Get user's enrollments with course details and progress
    const enrollments = await prisma.enrollment.findMany({
      where: { userId },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            description: true,
            price: true,
            imageUrl: true,
            publishStatus: true,
            isPaid: true,
            category: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        moduleProgress: {
          include: {
            module: {
              select: {
                id: true,
                title: true
              }
            }
          }
        }
      },
      orderBy: {
        lastAccessed: 'desc'
      }
    });

    console.log('✅ Found enrollments:', enrollments.length);

    // Transform the data to match frontend expectations
    const transformedEnrollments = enrollments.map(enrollment => {
      // Calculate progress from module progress
      const completedModules = enrollment.moduleProgress.filter(mp => mp.isCompleted).length;
      const totalModules = enrollment.moduleProgress.length;
      const progress = totalModules > 0 ? (completedModules / totalModules) * 100 : 0;

      return {
        id: enrollment.id,
        course: enrollment.course,
        progress: enrollment.progress || progress,
        lastAccessed: enrollment.lastAccessed,
        enrolledAt: enrollment.createdAt,
        completedModules,
        totalModules,
        paymentTransactionId: enrollment.paymentTransactionId,
        enrollmentType: enrollment.paymentTransactionId ? 'purchased' : 'enrolled'
      };
    });

    res.json(transformedEnrollments);

  } catch (error) {
    console.error('❌ Error fetching my courses:', error);
    res.status(500).json({ 
      error: 'Failed to fetch courses',
      details: error.message 
    });
  }
});

// GET /api/enroll/course/:courseId - Get user's enrollment for specific course
router.get('/course/:courseId', async (req, res) => {
  try {
    console.log('🎓 Fetching enrollment for course:', req.params.courseId);
    
    const userId = req.user.id;
    const courseId = parseInt(req.params.courseId);

    if (isNaN(courseId)) {
      return res.status(400).json({ error: 'Invalid course ID' });
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId
        }
      },
      include: {
        moduleProgress: {
          include: {
            module: {
              select: {
                id: true,
                title: true
              }
            }
          }
        }
      }
    });

    if (!enrollment) {
      return res.status(404).json({ error: 'Enrollment not found' });
    }

    // Calculate progress
    const completedModules = enrollment.moduleProgress.filter(mp => mp.isCompleted).length;
    const totalModules = enrollment.moduleProgress.length;
    const progress = totalModules > 0 ? (completedModules / totalModules) * 100 : 0;

    const transformedEnrollment = {
      id: enrollment.id,
      progress: enrollment.progress || progress,
      lastAccessed: enrollment.lastAccessed,
      enrolledAt: enrollment.createdAt,
      completed: progress >= 100,
      completedModules,
      totalModules
    };

    res.json({ enrollment: transformedEnrollment });

  } catch (error) {
    console.error('❌ Error fetching enrollment:', error);
    res.status(500).json({ 
      error: 'Failed to fetch enrollment',
      details: error.message 
    });
  }
});

// POST /api/enroll/enroll - Enroll in a free course
router.post('/enroll', async (req, res) => {
  try {
    console.log('🎓 Enrolling user in course:', req.body);
    
    const userId = req.user.id;
    const { courseId } = req.body;

    if (!courseId || isNaN(parseInt(courseId))) {
      return res.status(400).json({ error: 'Valid course ID is required' });
    }

    const parsedCourseId = parseInt(courseId);

    // Check if course exists and is free
    const course = await prisma.course.findUnique({
      where: { id: parsedCourseId },
      select: {
        id: true,
        title: true,
        price: true,
        publishStatus: true,
        isDeleted: true
      }
    });

    if (!course || course.isDeleted || course.publishStatus !== 'PUBLISHED') {
      return res.status(404).json({ error: 'Course not found or not available' });
    }

    if (course.price > 0) {
      return res.status(400).json({ error: 'This is a paid course. Use the purchase endpoint instead.' });
    }

    // Check if already enrolled
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId: parsedCourseId
        }
      }
    });

    if (existingEnrollment) {
      return res.status(400).json({ error: 'Already enrolled in this course' });
    }

    // Create enrollment
    const enrollment = await prisma.enrollment.create({
      data: {
        userId,
        courseId: parsedCourseId,
        progress: 0
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            price: true
          }
        }
      }
    });

    console.log('✅ Successfully enrolled user in course:', course.title);

    res.status(201).json({
      message: 'Successfully enrolled in course',
      enrollment: {
        id: enrollment.id,
        courseId: enrollment.courseId,
        courseName: enrollment.course.title,
        enrolledAt: enrollment.createdAt
      }
    });

  } catch (error) {
    console.error('❌ Error enrolling in course:', error);
    res.status(500).json({ 
      error: 'Failed to enroll in course',
      details: error.message 
    });
  }
});

module.exports = router;