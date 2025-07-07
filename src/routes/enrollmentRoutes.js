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

module.exports = router;