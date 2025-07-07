const enrollmentService = require('../services/enrollmentService');

const enrollInCourse = async (req, res) => {
  const { courseId } = req.body;
  const userId = req.user.userId;

  try {
    const enrollment = await enrollmentService.enrollUserInCourse(userId, courseId);
    res.status(201).json(enrollment);
  } catch (error) {
    if (error.message === 'User already enrolled in this course') {
      return res.status(400).json({ error: error.message });  
    }

    console.error("Enrollment Error:", error);
    res.status(500).json({ error: 'Failed to enroll in course' });
  }
};



const getUserEnrollments = async (req, res) => {
  const userId = req.user.userId;

  try {
    const courses = await enrollmentService.getEnrolledCourses(userId);
    res.status(200).json(courses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch enrollments' });
  }
};

const getModulesForCourse = async (req, res) => {
  const userId = req.user.userId;
  const { courseId } = req.params;

  try {
    const modules = await enrollmentService.getModulesIfEnrolled(userId, courseId);
    res.status(200).json(modules);
  } catch (error) {
    res.status(403).json({ error: error.message });
  }
};

module.exports = {
  enrollInCourse,
  getUserEnrollments,
  getModulesForCourse
};