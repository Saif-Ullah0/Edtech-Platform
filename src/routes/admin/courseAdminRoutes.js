// backend/src/routes/admin/courseAdminRoutes.js
const express = require('express');
const router = express.Router();
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Debug middleware
router.use((req, res, next) => {
  console.log(`🎓 ADMIN COURSE ROUTE: ${req.method} ${req.originalUrl}`);
  next();
});

// ================================
// GET COURSES - GET /api/admin/courses
// ================================
router.get('/', async (req, res) => {
  try {
    console.log('🔍 Fetching courses for admin');

    const courses = await prisma.course.findMany({
      where: {
        isDeleted: false
      },
      include: {
        category: {
          select: { id: true, name: true }
        },
        _count: {
          select: {
            enrollments: true,
            modules: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log(`✅ Found ${courses.length} courses`);

    res.json({
      success: true,
      courses
    });

  } catch (error) {
    console.error('❌ Error fetching courses:', error);
    res.status(500).json({
      error: 'Failed to fetch courses',
      details: error.message
    });
  }
});

// ================================
// CREATE COURSE - POST /api/admin/courses
// ================================
router.post('/', async (req, res) => {
  try {
    console.log('🔍 Creating course with data:', req.body);

    const {
      title,
      description,
      categoryId,
      imageUrl,
      isPaid,
      price,
      publishStatus = 'DRAFT'
    } = req.body;

    // Validation
    if (!title || !description || !categoryId) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['title', 'description', 'categoryId']
      });
    }

    // Validate category exists
    const category = await prisma.category.findUnique({
      where: { id: parseInt(categoryId) }
    });

    if (!category) {
      return res.status(400).json({
        error: 'Category not found',
        categoryId: parseInt(categoryId)
      });
    }

    // Generate slug from title
    const slug = title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');

    // Create the course
    const course = await prisma.course.create({
      data: {
        title,
        slug,
        description,
        categoryId: parseInt(categoryId),
        imageUrl: imageUrl || null,
        isPaid: Boolean(isPaid),
        price: isPaid ? parseFloat(price) || 0 : 0,
        publishStatus,
        isDeleted: false
      },
      include: {
        category: {
          select: { id: true, name: true }
        },
        _count: {
          select: {
            enrollments: true,
            modules: true
          }
        }
      }
    });

    console.log('✅ Course created successfully:', course);

    res.status(201).json({
      success: true,
      message: 'Course created successfully',
      course
    });

  } catch (error) {
    console.error('❌ Error creating course:', error);
    
    // Handle unique constraint violations
    if (error.code === 'P2002') {
      return res.status(400).json({
        error: 'Course title or slug already exists',
        details: 'Please choose a different title'
      });
    }

    res.status(500).json({
      error: 'Failed to create course',
      details: error.message
    });
  }
});

// ================================
// UPDATE COURSE - PUT /api/admin/courses/:id
// ================================
router.put('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      description,
      categoryId,
      imageUrl,
      isPaid,
      price,
      publishStatus
    } = req.body;

    console.log(`🔄 Updating course ${id} with data:`, req.body);

    // Validation
    if (!title || !description || !categoryId) {
      return res.status(400).json({
        error: 'Missing required fields',
        required: ['title', 'description', 'categoryId']
      });
    }

    // Validate category exists
    const category = await prisma.category.findUnique({
      where: { id: parseInt(categoryId) }
    });

    if (!category) {
      return res.status(400).json({
        error: 'Category not found',
        categoryId: parseInt(categoryId)
      });
    }

    // Get existing course
    const existingCourse = await prisma.course.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingCourse) {
      return res.status(404).json({
        error: 'Course not found'
      });
    }

    // Generate new slug if title changed
    let slug = existingCourse.slug;
    if (title !== existingCourse.title) {
      slug = title
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    // Update the course
    const updatedCourse = await prisma.course.update({
      where: { id: parseInt(id) },
      data: {
        title,
        slug,
        description,
        categoryId: parseInt(categoryId),
        imageUrl: imageUrl || null,
        isPaid: Boolean(isPaid),
        price: isPaid ? parseFloat(price) || 0 : 0,
        publishStatus: publishStatus || 'DRAFT'
      },
      include: {
        category: {
          select: { id: true, name: true }
        },
        _count: {
          select: {
            enrollments: true,
            modules: true
          }
        }
      }
    });

    console.log('✅ Course updated successfully:', updatedCourse);

    res.json({
      success: true,
      message: 'Course updated successfully',
      course: updatedCourse
    });

  } catch (error) {
    console.error('❌ Error updating course:', error);
    
    // Handle unique constraint violations
    if (error.code === 'P2002') {
      return res.status(400).json({
        error: 'Course title or slug already exists',
        details: 'Please choose a different title'
      });
    }

    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Course not found'
      });
    }

    res.status(500).json({
      error: 'Failed to update course',
      details: error.message
    });
  }
});

// ================================
// UPDATE COURSE STATUS - PUT /api/admin/courses/:id/status
// ================================
router.put('/:id/status', async (req, res) => {
  try {
    const { id } = req.params;
    const { publishStatus } = req.body;

    console.log(`🔄 Updating course ${id} status to ${publishStatus}`);

    if (!['DRAFT', 'PUBLISHED'].includes(publishStatus)) {
      return res.status(400).json({
        error: 'Invalid publish status',
        allowed: ['DRAFT', 'PUBLISHED']
      });
    }

    const course = await prisma.course.update({
      where: { id: parseInt(id) },
      data: { publishStatus },
      include: {
        category: { select: { id: true, name: true } },
        _count: {
          select: {
            enrollments: true,
            modules: true
          }
        }
      }
    });

    console.log(`✅ Course ${id} status updated to ${publishStatus}`);

    res.json({
      success: true,
      message: `Course ${publishStatus.toLowerCase()} successfully`,
      course
    });

  } catch (error) {
    console.error('❌ Error updating course status:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Course not found'
      });
    }

    res.status(500).json({
      error: 'Failed to update course status',
      details: error.message
    });
  }
});

// ================================
// GET SINGLE COURSE - GET /api/admin/courses/:id
// ================================
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🔍 Fetching course ${id}`);

    const course = await prisma.course.findUnique({
      where: { 
        id: parseInt(id),
        isDeleted: false 
      },
      include: {
        category: {
          select: { id: true, name: true }
        },
        modules: {
          where: { isDeleted: false },
          orderBy: { orderIndex: 'asc' },
          select: {
            id: true,
            title: true,
            description: true,
            orderIndex: true,
            publishStatus: true
          }
        },
        _count: {
          select: {
            enrollments: true,
            modules: true
          }
        }
      }
    });

    if (!course) {
      return res.status(404).json({
        error: 'Course not found'
      });
    }

    console.log(`✅ Found course: ${course.title}`);

    res.json({
      success: true,
      course
    });

  } catch (error) {
    console.error('❌ Error fetching course:', error);
    res.status(500).json({
      error: 'Failed to fetch course',
      details: error.message
    });
  }
});

// ================================
// DELETE COURSE - DELETE /api/admin/courses/:id
// ================================
router.delete('/:id', async (req, res) => {
  try {
    const { id } = req.params;

    console.log(`🗑️ Deleting course ${id}`);

    // Check if course exists
    const existingCourse = await prisma.course.findUnique({
      where: { id: parseInt(id) }
    });

    if (!existingCourse) {
      return res.status(404).json({
        error: 'Course not found'
      });
    }

    // Soft delete - mark as deleted instead of removing
    const course = await prisma.course.update({
      where: { id: parseInt(id) },
      data: { isDeleted: true }
    });

    console.log(`✅ Course ${id} deleted successfully`);

    res.json({
      success: true,
      message: 'Course deleted successfully',
      course
    });

  } catch (error) {
    console.error('❌ Error deleting course:', error);
    
    if (error.code === 'P2025') {
      return res.status(404).json({
        error: 'Course not found'
      });
    }

    res.status(500).json({
      error: 'Failed to delete course',
      details: error.message
    });
  }
});

// ================================
// COURSE ANALYTICS - GET /api/admin/courses/analytics
// ================================
router.get('/analytics/overview', async (req, res) => {
  try {
    console.log('📊 Fetching course analytics');

    const [
      totalCourses,
      publishedCourses,
      draftCourses,
      freeCourses,
      paidCourses,
      totalEnrollments
    ] = await Promise.all([
      prisma.course.count({ where: { isDeleted: false } }),
      prisma.course.count({ where: { isDeleted: false, publishStatus: 'PUBLISHED' } }),
      prisma.course.count({ where: { isDeleted: false, publishStatus: 'DRAFT' } }),
      prisma.course.count({ where: { isDeleted: false, isPaid: false } }),
      prisma.course.count({ where: { isDeleted: false, isPaid: true } }),
      prisma.enrollment.count()
    ]);

    const analytics = {
      overview: {
        totalCourses,
        publishedCourses,
        draftCourses,
        freeCourses,
        paidCourses,
        totalEnrollments
      }
    };

    console.log('✅ Analytics generated:', analytics);

    res.json({
      success: true,
      analytics
    });

  } catch (error) {
    console.error('❌ Error fetching course analytics:', error);
    res.status(500).json({
      error: 'Failed to fetch course analytics',
      details: error.message
    });
  }
});

// ================================
// ERROR HANDLER - Catch unmatched routes
// ================================
router.all('*', (req, res) => {
  console.log('❌ UNMATCHED ADMIN COURSE ROUTE:', req.method, req.originalUrl);
  
  res.status(404).json({
    error: 'Admin course route not found',
    message: `The requested route ${req.originalUrl} does not exist`,
    method: req.method,
    availableRoutes: [
      'GET /api/admin/courses',
      'POST /api/admin/courses',
      'GET /api/admin/courses/:id',
      'PUT /api/admin/courses/:id',
      'PUT /api/admin/courses/:id/status',
      'DELETE /api/admin/courses/:id',
      'GET /api/admin/courses/analytics/overview'
    ]
  });
});

module.exports = router;