const courseService = require('../services/courseService');

const getCourses = async (req, res) => {
  try {
    const { category } = req.query;
    const courses = await courseService.getAllCourses(category);
    res.status(200).json(courses);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
};

const getCourseById = async (req, res) => {
  try {
    const course = await courseService.getCourseById(req.params.id);
    if (!course) return res.status(404).json({ error: 'Course not found' });
    res.status(200).json(course);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch course details' });
  }
};

module.exports = {
  getCourses,
  getCourseById
};
