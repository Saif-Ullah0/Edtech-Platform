const courseService = require('../services/courseService');

const getCourses = async (req, res) => {
  try {
    const { category } = req.query;
    const courses = await courseService.getAllCourses(category);
    res.status(200).json(courses);
  } catch (error) {
    console.error('Error fetching courses:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
};

const getCourseById = async (req, res) => {
  try {
    const course = await courseService.getCourseById(parseInt(req.params.id));
    if (!course || course.isDeleted) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.status(200).json(course);
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ error: 'Failed to fetch course details' });
  }
};

const createCourse = async (req, res) => {
  try {
    const { title, slug, description, price, imageUrl, categoryId } = req.body;

    if (!title || !slug || !description || !price || !categoryId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    const course = await courseService.createCourse({
      title,
      slug,
      description,
      price: parseFloat(price),
      imageUrl,
      categoryId: parseInt(categoryId),
    });

    res.status(201).json({ course });
  } catch (error) {
    console.error('Error creating course:', error);
    res.status(500).json({ error: 'Failed to create course' });
  }
};

const updateCourse = async (req, res) => {
  try {
    const courseId = parseInt(req.params.id);
    const updatedCourse = await courseService.updateCourse(courseId, req.body);
    res.status(200).json(updatedCourse);
  } catch (error) {
    console.error('Error updating course:', error);
    res.status(500).json({ error: 'Failed to update course' });
  }
};

// ✅ Admin - Soft Delete Course
const deleteCourse = async (req, res) => {
  try {
    const courseId = parseInt(req.params.id);
    await courseService.softDeleteCourse(courseId);
    res.status(204).send(); // No Content
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
};

module.exports = {
  getCourses,
  getCourseById,
  createCourse,
  updateCourse,
  deleteCourse,
};
