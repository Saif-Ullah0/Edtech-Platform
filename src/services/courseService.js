const prisma = require('../../prisma/client');

const searchCourses = async (query) => {
  return await prisma.course.findMany({
    where: {
      isDeleted: false,
      publishStatus: "PUBLISHED", // 🆕 Only show published courses
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
      publishStatus: true, // 🆕 Include publish status
      isPaid: true,        // 🆕 Include pricing info
      category: {
        select: {
          name: true,
        },
      },
    },
  });
};

// 🆕 UPDATED: Only show published courses to students
const getAllCourses = async (categorySlug) => {
  const filter = categorySlug
    ? {
        isDeleted: false,
        publishStatus: "PUBLISHED", // 🆕 Only published courses
        category: {
          slug: categorySlug,
        },
      }
    : {
        isDeleted: false,
        publishStatus: "PUBLISHED", // 🆕 Only published courses
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
          isPublished: true,
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
          videoUrl: true,
          videoDuration: true,
          videoSize: true,
          thumbnailUrl: true,
          price: true,
          isFree: true,
          isPublished: true,
          createdAt: true,
          updatedAt: true
        }
      }
    },
  });
};

// 🆕 NEW: Admin version - shows all courses including drafts
const getAllCoursesForAdmin = async (categorySlug) => {
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

  const courses = await prisma.course.findMany({
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
        orderBy: {
          orderIndex: 'asc'
        },
        select: {
          id: true,
          title: true,
          content: true,
          type: true,
          orderIndex: true,
          videoUrl: true,
          videoDuration: true,
          videoSize: true,        // 🚨 This is BigInt!
          thumbnailUrl: true,
          price: true,
          isFree: true,
          isPublished: true,
          createdAt: true,
          updatedAt: true
        }
      }
    },
    orderBy: {
      createdAt: 'desc'
    }
  });

  // 🆕 FIX: Convert BigInt fields to strings for JSON serialization
  if (courses) {
    courses.forEach(course => {
      if (course.modules) {
        course.modules = course.modules.map(module => ({
          ...module,
          videoSize: module.videoSize ? module.videoSize.toString() : null, // 🆕 Convert BigInt to string
          price: module.price || 0,
          isFree: module.isFree || false,
          isPublished: module.isPublished !== false
        }));
      }
    });
  }

  return courses;
};


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
          videoUrl: true,
          videoDuration: true,
          videoSize: true,
          thumbnailUrl: true,
          price: true,
          isFree: true,
          isPublished: true,
          createdAt: true,
          updatedAt: true
        }
      },
    },
  });

  if (course && course.modules) {
    course.modules = course.modules.map(module => ({
      ...module,
      videoSize: module.videoSize ? module.videoSize.toString() : null,
      price: module.price || 0,
      isFree: module.isFree || false,
      isPublished: module.isPublished !== false
    }));
  }

  return course;
};

// 🆕 NEW: Admin version - can see draft courses
const getCourseByIdForAdmin = async (id) => {
  // Same as getCourseById but without publishStatus filtering
  return await getCourseById(id);
};

const getCourseByIdWithOwnership = async (courseId, userId) => {
  try {
    const course = await getCourseById(courseId);
    
    if (!course || !userId) {
      return course;
    }

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

// 🆕 UPDATED: Enhanced course creation with validation
const createCourse = async (data) => {
  // 🆕 Validate pricing logic
  if (data.isPaid && (!data.price || data.price <= 0)) {
    throw new Error('Paid courses must have a price greater than 0');
  }
  
  // 🆕 Set price to 0 if course is not paid
  if (!data.isPaid) {
    data.price = 0;
  }

  return await prisma.course.create({ data });
};

// 🆕 UPDATED: Enhanced course update with validation
const updateCourse = async (id, data) => {
  // 🆕 Validate pricing logic
  if (data.isPaid && (!data.price || data.price <= 0)) {
    throw new Error('Paid courses must have a price greater than 0');
  }
  
  // 🆕 Set price to 0 if course is not paid
  if (data.isPaid === false) {
    data.price = 0;
  }

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
  getAllCoursesForAdmin,        // 🆕 NEW
  getCourseById,
  getCourseByIdForAdmin,        // 🆕 NEW
  getCourseByIdWithOwnership,
  createCourse,
  updateCourse,
  softDeleteCourse,
  searchCourses
};