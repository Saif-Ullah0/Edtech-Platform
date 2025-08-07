// backend/src/controllers/courseController.js
// Enhanced version with better error handling and data structure

const courseService = require('../services/courseService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 🆕 ENHANCED: Get single course by ID with proper data structure
const getCourseById = async (req, res) => {
  try {
    console.log('🎓 Fetching course:', req.params.id);
    
    const courseId = parseInt(req.params.id);
    
    if (isNaN(courseId)) {
      console.log('❌ Invalid course ID:', req.params.id);
      return res.status(400).json({ error: 'Invalid course ID' });
    }

    const course = await courseService.getCourseById(courseId);
    
    if (!course || course.isDeleted) {
      console.log('❌ Course not found:', courseId);
      return res.status(404).json({ error: 'Course not found' });
    }
    
    // 🆕 Check if course is published (for students)
    if (course.publishStatus !== 'PUBLISHED') {
      console.log('❌ Course not published:', courseId);
      return res.status(404).json({ error: 'Course not available' });
    }

    // 🆕 ENHANCED: Transform course data for frontend compatibility
    const enhancedCourse = {
      id: course.id,
      title: course.title,
      description: course.description,
      price: course.price || 0,
      imageUrl: course.imageUrl,
      publishStatus: course.publishStatus,
      isPaid: course.isPaid || course.price > 0,
      
      // Add missing fields that frontend expects
      duration: calculateCourseDuration(course.modules),
      level: determineCourseLevel(course.modules),
      enrollmentCount: await getEnrollmentCount(courseId),
      rating: 4.5, // Default rating - you can implement actual ratings later
      reviewCount: 12, // Default review count
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      
      // Category information
      category: {
        id: course.category?.id,
        name: course.category?.name || 'Uncategorized',
        description: course.category?.description
      },
      
      // Creator/Instructor information
      creator: {
        id: 1, // You'll need to add instructor relationship to your schema
        name: 'Course Instructor',
        email: 'instructor@example.com',
        bio: 'Experienced educator passionate about teaching',
        isAdmin: true
      },
      
      // 🆕 ENHANCED: Transform modules with chapter data
      modules: course.modules ? course.modules
        .filter(module => module.isPublished)
        .sort((a, b) => a.orderIndex - b.orderIndex)
        .map(module => ({
          id: module.id,
          title: module.title,
          description: module.description || `Learn about ${module.title}`,
          duration: calculateModuleDuration(module.chapters),
          orderIndex: module.orderIndex,
          isPublished: module.isPublished,
          price: module.price || 0,
          isFree: module.isFree || module.price === 0,
          
          // 🆕 Transform chapters for frontend
          chapters: module.chapters ? module.chapters
            .filter(chapter => chapter.publishStatus === 'PUBLISHED')
            .sort((a, b) => a.order - b.order)
            .map(chapter => ({
              id: chapter.id,
              title: chapter.title,
              description: chapter.description,
              content: chapter.content,
              videoUrl: chapter.videoUrl,
              type: chapter.type,
              duration: chapter.videoDuration || 300, // 5 min default
              orderIndex: chapter.order,
              isPublished: chapter.publishStatus === 'PUBLISHED',
              isFree: module.isFree || false, // Chapter is free if module is free
              isCompleted: false // Will be populated for enrolled users
            })) : []
        })) : []
    };

    console.log('✅ Course fetched successfully:', enhancedCourse.title);
    console.log('📊 Course stats:', {
      modules: enhancedCourse.modules.length,
      totalChapters: enhancedCourse.modules.reduce((sum, m) => sum + m.chapters.length, 0),
      duration: enhancedCourse.duration
    });

    res.status(200).json({ course: enhancedCourse });
    
  } catch (error) {
    console.error('❌ Error fetching course:', error);
    res.status(500).json({ 
      error: 'Failed to fetch course details',
      details: error.message 
    });
  }
};

// 🆕 ENHANCED: Get all courses with better filtering
const getCourses = async (req, res) => {
  try {
    console.log('🎓 Fetching courses with filters:', req.query);
    
    const { category, search, level, price } = req.query;
    
    let courses = await courseService.getAllCourses(category);

    // Apply additional filters
    if (search) {
      const searchTerm = search.toLowerCase();
      courses = courses.filter(course => 
        course.title.toLowerCase().includes(searchTerm) ||
        course.description.toLowerCase().includes(searchTerm) ||
        course.category?.name.toLowerCase().includes(searchTerm)
      );
    }

    if (level) {
      courses = courses.filter(course => 
        determineCourseLevel(course.modules) === level.toUpperCase()
      );
    }

    if (price === 'free') {
      courses = courses.filter(course => course.price === 0);
    } else if (price === 'paid') {
      courses = courses.filter(course => course.price > 0);
    }

    // Transform courses for frontend
    const enhancedCourses = await Promise.all(courses.map(async (course) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      price: course.price || 0,
      imageUrl: course.imageUrl,
      publishStatus: course.publishStatus,
      isPaid: course.isPaid || course.price > 0,
      
      duration: calculateCourseDuration(course.modules),
      level: determineCourseLevel(course.modules),
      enrollmentCount: await getEnrollmentCount(course.id),
      
      category: {
        id: course.category?.id,
        name: course.category?.name || 'Uncategorized'
      },
      
      modules: course.modules ? course.modules.filter(m => m.isPublished).length : 0,
      chapters: course.modules ? course.modules.reduce((sum, m) => 
        sum + (m.chapters ? m.chapters.filter(c => c.publishStatus === 'PUBLISHED').length : 0), 0) : 0,
      
      createdAt: course.createdAt
    })));

    console.log('✅ Found courses:', enhancedCourses.length);

    res.status(200).json({
      courses: enhancedCourses,
      total: enhancedCourses.length,
      filters: { category, search, level, price }
    });
    
  } catch (error) {
    console.error('❌ Error fetching courses:', error);
    res.status(500).json({ 
      error: 'Failed to fetch courses',
      details: error.message 
    });
  }
};

// Helper Functions
const calculateCourseDuration = (modules) => {
  if (!modules || !Array.isArray(modules)) return 3600; // Default 1 hour
  
  return modules.reduce((total, module) => {
    if (!module.chapters || !Array.isArray(module.chapters)) return total + 1800; // Default 30 min per module
    
    return total + module.chapters.reduce((moduleTotal, chapter) => 
      moduleTotal + (chapter.videoDuration || 300), 0); // Default 5 min per chapter
  }, 0);
};

const calculateModuleDuration = (chapters) => {
  if (!chapters || !Array.isArray(chapters)) return 1800; // Default 30 min
  
  return chapters.reduce((total, chapter) => 
    total + (chapter.videoDuration || 300), 0);
};

const determineCourseLevel = (modules) => {
  if (!modules || modules.length === 0) return 'BEGINNER';
  if (modules.length <= 3) return 'BEGINNER';
  if (modules.length <= 6) return 'INTERMEDIATE';
  return 'ADVANCED';
};

const getEnrollmentCount = async (courseId) => {
  try {
    return await prisma.enrollment.count({
      where: { courseId }
    });
  } catch (error) {
    console.error('Error counting enrollments:', error);
    return 0;
  }
};

// 🆕 ENHANCED: Course creation with proper validation
const createCourse = async (req, res) => {
  try {
    console.log('🎓 Creating course:', req.body);
    
    const { title, slug, description, price, imageUrl, categoryId, publishStatus, isPaid } = req.body;

    if (!title || !slug || !description || !categoryId) {
      return res.status(400).json({ error: 'Missing required fields: title, slug, description, categoryId' });
    }

    // 🆕 Validate pricing logic
    if (isPaid && (!price || price <= 0)) {
      return res.status(400).json({ error: 'Paid courses must have a price greater than 0' });
    }

    const courseData = {
      title,
      slug,
      description,
      price: isPaid ? parseFloat(price) : 0,
      imageUrl,
      categoryId: parseInt(categoryId),
      publishStatus: publishStatus || 'DRAFT',
      isPaid: isPaid || false
    };

    const course = await courseService.createCourse(courseData);
    
    console.log('✅ Course created successfully:', course.title);
    res.status(201).json({ 
      message: 'Course created successfully',
      course 
    });
    
  } catch (error) {
    console.error('❌ Error creating course:', error);
    
    if (error.message.includes('pricing')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ 
      error: 'Failed to create course',
      details: error.message 
    });
  }
};

// 🆕 ENHANCED: Course update with proper validation
const updateCourse = async (req, res) => {
  try {
    console.log('🎓 Updating course:', req.params.id, req.body);
    
    const courseId = parseInt(req.params.id);
    const updateData = req.body;

    if (isNaN(courseId)) {
      return res.status(400).json({ error: 'Invalid course ID' });
    }

    // 🆕 Validate pricing logic if being updated
    if (updateData.isPaid && (!updateData.price || updateData.price <= 0)) {
      return res.status(400).json({ error: 'Paid courses must have a price greater than 0' });
    }

    const updatedCourse = await courseService.updateCourse(courseId, updateData);
    
    console.log('✅ Course updated successfully:', updatedCourse.title);
    res.status(200).json({
      message: 'Course updated successfully',
      course: updatedCourse
    });
    
  } catch (error) {
    console.error('❌ Error updating course:', error);
    
    if (error.message.includes('pricing')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ 
      error: 'Failed to update course',
      details: error.message 
    });
  }
};

// 🆕 ENHANCED: Course deletion with proper logging
const deleteCourse = async (req, res) => {
  try {
    console.log('🎓 Deleting course:', req.params.id);
    
    const courseId = parseInt(req.params.id);
    
    if (isNaN(courseId)) {
      return res.status(400).json({ error: 'Invalid course ID' });
    }
    
    await courseService.softDeleteCourse(courseId);
    
    console.log('✅ Course deleted successfully:', courseId);
    res.status(204).send();
    
  } catch (error) {
    console.error('❌ Error deleting course:', error);
    res.status(500).json({ 
      error: 'Failed to delete course',
      details: error.message 
    });
  }
};

// 🆕 ENHANCED: Course search with better results
const searchCourses = async (req, res) => {
  try {
    console.log('🎓 Searching courses:', req.query);
    
    const { query } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const courses = await courseService.searchCourses(query);
    
    // Transform search results
    const enhancedResults = await Promise.all(courses.map(async (course) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      price: course.price || 0,
      imageUrl: course.imageUrl,
      isPaid: course.isPaid || course.price > 0,
      
      category: course.category,
      enrollmentCount: await getEnrollmentCount(course.id)
    })));

    console.log('✅ Search results:', enhancedResults.length);
    res.status(200).json({
      courses: enhancedResults,
      total: enhancedResults.length,
      query
    });
    
  } catch (error) {
    console.error('❌ Error searching courses:', error);
    res.status(500).json({ 
      error: 'Failed to search courses',
      details: error.message 
    });
  }
};

// Keep existing admin functions
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
  getCoursesForAdmin,
  getCourseById,
  getCourseByIdForAdmin,
  createCourse,
  updateCourse,
  deleteCourse,
  searchCourses
};