const express = require('express'); 
const router = express.Router();
const {
  enrollInCourse,
  getUserEnrollments,
  getModulesForCourse
} = require('../controllers/enrollmentController');
const requireAuth = require('../middlewares/requireAuth');

router.post('/', requireAuth, enrollInCourse);
router.get('/', requireAuth, getUserEnrollments);
router.get('/modules/:courseId', requireAuth, getModulesForCourse);
router.get('/check/:courseId', requireAuth, async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user?.userId;

    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: userId,
        courseId: parseInt(courseId)
      }
    });

    res.json({ isEnrolled: !!enrollment });
  } catch (error) {
    res.status(500).json({ error: 'Failed to check enrollment' });
  }
});
module.exports = router;