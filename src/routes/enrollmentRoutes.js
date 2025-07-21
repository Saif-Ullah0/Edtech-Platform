const express = require('express'); 
const router = express.Router();
const {
  enrollInCourse,
  getUserEnrollments,
  getModulesForCourse,
  getEnrollmentStatus,
} = require('../controllers/enrollmentController');
const requireAuth = require('../middlewares/requireAuth');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Enrollment management
router.post('/', requireAuth, enrollInCourse);
router.get('/', requireAuth, getUserEnrollments);

// Course access and status
router.get('/modules/:courseId', requireAuth, getModulesForCourse);
router.get('/status/:courseId', requireAuth, getEnrollmentStatus);

// Simple enrollment check (lightweight)
router.get('/check/:courseId', requireAuth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user?.userId;

    console.log(`🔍 Quick enrollment check: User ${userId} → Course ${courseId}`);

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: userId,
        courseId: parseInt(courseId)
      },
      select: {
        id: true,
        createdAt: true
      }
    });

    const isEnrolled = !!enrollment;
    
    console.log(`✅ Enrollment check result: ${isEnrolled ? 'Enrolled' : 'Not enrolled'}`);

    res.json({ 
      isEnrolled,
      enrollmentId: enrollment?.id || null,
      enrolledAt: enrollment?.createdAt || null
    });
    
  } catch (error) {
    console.error('❌ Error checking enrollment:', error);
    res.status(500).json({ 
      error: 'Failed to check enrollment',
      message: 'Unable to verify enrollment status'
    });
  }
});

module.exports = router;