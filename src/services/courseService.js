const prisma = require('../../prisma/client');

const searchCourses = async (query) => {
  return await prisma.course.findMany({
    where: {
      isDeleted: false, // ✅ Optional: exclude soft-deleted
      OR: [
        {
          title: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          description: {
            contains: query,
            mode: 'insensitive',
          },
        },
        {
          category: {
            name: {
              contains: query,
              mode: 'insensitive',
            },
          },
        },
        {
          modules: {
            some: {
              title: {
                contains: query,
                mode: 'insensitive',
              },
            },
          },
        },
      ],
    },
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      imageUrl: true,
      category: {
        select: {
          name: true,
        },
      },
    },
  });
};

// FIXED: getAllCourses now includes modules with pricing fields
const getAllCourses = async (categorySlug) => {
  const filter = categorySlug
    ? {
        isDeleted: false,
        category: {
          slug: categorySlug,
        },
      }
    : {
        isDeleted: false,
      };

  return await prisma.course.findMany({
    where: filter,
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
      modules: {
        where: {
          isPublished: true, // Only include published modules
        },
        orderBy: {
          orderIndex: 'asc'
        },
        select: {
          id: true,
          title: true,
          content: true,
          type: true,
          orderIndex: true,
          
          // Video fields
          videoUrl: true,
          videoDuration: true,
          videoSize: true,
          thumbnailUrl: true,
          
          // Payment fields
          price: true,
          isFree: true,
          isPublished: true,
          
          // Timestamps
          createdAt: true,
          updatedAt: true
        }
      }
    },
  });
};

// ENHANCED: getCourseById with explicit module payment fields
const getCourseById = async (id) => {
  const course = await prisma.course.findUnique({
    where: { id },
    include: {
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
          description: true
        }
      },
      modules: {
        orderBy: { orderIndex: 'asc' },
        select: {
          id: true,
          title: true,
          content: true,
          type: true,
          orderIndex: true,
          
          // Video fields
          videoUrl: true,
          videoDuration: true,
          videoSize: true,
          thumbnailUrl: true,
          
          // NEW: Payment fields (explicitly included)
          price: true,
          isFree: true,
          isPublished: true,
          
          // Timestamps
          createdAt: true,
          updatedAt: true
        }
      },
    },
  });

  // Convert BigInt fields to strings for JSON serialization and ensure payment fields
  if (course && course.modules) {
    course.modules = course.modules.map(module => ({
      ...module,
      videoSize: module.videoSize ? module.videoSize.toString() : null,
      // Ensure payment fields have proper defaults
      price: module.price || 0,
      isFree: module.isFree || false,
      isPublished: module.isPublished !== false // Default to true if not explicitly false
    }));
  }

  return course;
};

// NEW: Get course with module ownership for specific user
const getCourseByIdWithOwnership = async (courseId, userId) => {
  try {
    const course = await getCourseById(courseId);
    
    if (!course || !userId) {
      return course;
    }

    // Get user's module enrollments for this course
    const moduleEnrollments = await prisma.moduleEnrollment.findMany({
      where: {
        userId: userId,
        module: {
          courseId: courseId
        }
      },
      select: {
        moduleId: true
      }
    });

    const ownedModuleIds = moduleEnrollments.map(enrollment => enrollment.moduleId);

    // Add ownership info to modules
    if (course.modules) {
      course.modules = course.modules.map(module => ({
        ...module,
        isOwned: ownedModuleIds.includes(module.id)
      }));
    }

    return course;
  } catch (error) {
    console.error('Error fetching course with ownership:', error);
    throw error;
  }
};

const createCourse = async (data) => {
  return await prisma.course.create({ data });
};

const updateCourse = async (id, data) => {
  return await prisma.course.update({
    where: { id },
    data,
  });
};

const softDeleteCourse = async (id) => {
  return await prisma.course.update({
    where: { id },
    data: { isDeleted: true },
  });
};

module.exports = {
  getAllCourses,
  getCourseById,
  getCourseByIdWithOwnership, // NEW: Enhanced function with ownership
  createCourse,
  updateCourse,
  softDeleteCourse,
  searchCourses
};