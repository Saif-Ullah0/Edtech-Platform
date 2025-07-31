const courseService = require('../services/courseService');

// 🆕 UPDATED: Student endpoint - only published courses
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
    
    // 🆕 Check if course is published (for students)
    if (course.publishStatus !== 'PUBLISHED') {
      return res.status(404).json({ error: 'Course not available' });
    }
    
    res.status(200).json(course);
  } catch (error) {
    console.error('Error fetching course:', error);
    res.status(500).json({ error: 'Failed to fetch course details' });
  }
};

// 🆕 UPDATED: Enhanced course creation with pricing validation
const createCourse = async (req, res) => {
  try {
    const { title, slug, description, price, imageUrl, categoryId, publishStatus, isPaid } = req.body;

    if (!title || !slug || !description || !categoryId) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // 🆕 Validate pricing logic
    if (isPaid && (!price || price <= 0)) {
      return res.status(400).json({ error: 'Paid courses must have a price greater than 0' });
    }

    const courseData = {
      title,
      slug,
      description,
      price: isPaid ? parseFloat(price) : 0, // 🆕 Set price based on isPaid
      imageUrl,
      categoryId: parseInt(categoryId),
      publishStatus: publishStatus || 'DRAFT', // 🆕 Default to draft
      isPaid: isPaid || false                  // 🆕 Default to free
    };

    const course = await courseService.createCourse(courseData);
    res.status(201).json({ course });
  } catch (error) {
    console.error('Error creating course:', error);
    
    // 🆕 Handle validation errors
    if (error.message.includes('pricing')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to create course' });
  }
};

// 🆕 UPDATED: Enhanced course update with pricing validation
const updateCourse = async (req, res) => {
  try {
    const courseId = parseInt(req.params.id);
    const updateData = req.body;

    // 🆕 Validate pricing logic if being updated
    if (updateData.isPaid && (!updateData.price || updateData.price <= 0)) {
      return res.status(400).json({ error: 'Paid courses must have a price greater than 0' });
    }

    const updatedCourse = await courseService.updateCourse(courseId, updateData);
    res.status(200).json(updatedCourse);
  } catch (error) {
    console.error('Error updating course:', error);
    
    // 🆕 Handle validation errors
    if (error.message.includes('pricing')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ error: 'Failed to update course' });
  }
};

const deleteCourse = async (req, res) => {
  try {
    const courseId = parseInt(req.params.id);
    await courseService.softDeleteCourse(courseId);
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting course:', error);
    res.status(500).json({ error: 'Failed to delete course' });
  }
};

const searchCourses = async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const courses = await courseService.searchCourses(query);
    res.status(200).json(courses);
  } catch (error) {
    console.error('Error searching courses:', error);
    res.status(500).json({ error: 'Failed to search courses' });
  }
};


// 🆕 NEW: Admin endpoint to get course (including drafts)
const getCourseByIdForAdmin = async (req, res) => {
  try {
    const course = await courseService.getCourseByIdForAdmin(parseInt(req.params.id));
    if (!course || course.isDeleted) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.status(200).json(course);
  } catch (error) {
    console.error('Error fetching course for admin:', error);
    res.status(500).json({ error: 'Failed to fetch course details' });
  }
};
// 🆕 NEW: Admin endpoint - all courses including drafts
const getCoursesForAdmin = async (req, res) => {
  try {
    const { category } = req.query;
    const courses = await courseService.getAllCoursesForAdmin(category);
    res.status(200).json(courses);
  } catch (error) {
    console.error('Error fetching courses for admin:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
};

module.exports = {
  getCourses,
  getCoursesForAdmin,        // 🆕 NEW
  getCourseById,
  getCourseByIdForAdmin,     // 🆕 NEW
  createCourse,
  updateCourse,
  deleteCourse,
  searchCourses
};