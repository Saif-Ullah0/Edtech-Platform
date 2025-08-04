const prisma = require('../../prisma/client');

const searchCourses = async (query) => {
  return await prisma.course.findMany({
    where: {
      isDeleted: false,
      publishStatus: "PUBLISHED", // Only show published courses
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
      publishStatus: true,
      isPaid: true,
      category: {
        select: {
          name: true,
        },
      },
    },
  });
};

// FIXED: getAllCourses now works with Chapter system
const getAllCourses = async (categorySlug) => {
  const filter = categorySlug
    ? {
        isDeleted: false,
        publishStatus: "PUBLISHED",
        category: {
          slug: categorySlug,
        },
      }
    : {
        isDeleted: false,
        publishStatus: "PUBLISHED",
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
          type: true,
          orderIndex: true,
          
          // 🆕 NEW: Include chapters instead of old content fields
          chapters: {
            where: {
              publishStatus: 'PUBLISHED'
            },
            orderBy: {
              order: 'asc'
            },
            select: {
              id: true,
              title: true,
              description: true,
              content: true,
              videoUrl: true,
              videoDuration: true,
              videoSize: true,
              thumbnailUrl: true,
              type: true,
              order: true,
              publishStatus: true
            }
          },
          
          // Keep module-level fields
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

// FIXED: Admin version with all courses
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
          type: true,
          orderIndex: true,
          
          // 🆕 NEW: Include chapters (admin sees all)
          chapters: {
            orderBy: {
              order: 'asc'
            },
            select: {
              id: true,
              title: true,
              description: true,
              content: true,
              videoUrl: true,
              videoDuration: true,
              videoSize: true,
              thumbnailUrl: true,
              type: true,
              order: true,
              publishStatus: true
            }
          },
          
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

  // Convert BigInt fields in chapters
  if (courses) {
    courses.forEach(course => {
      if (course.modules) {
        course.modules.forEach(module => {
          if (module.chapters) {
            module.chapters = module.chapters.map(chapter => ({
              ...chapter,
              videoSize: chapter.videoSize ? chapter.videoSize.toString() : null
            }));
          }
        });
      }
    });
  }

  return courses;
};

// FIXED: getCourseById with Chapter system
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
          type: true,
          orderIndex: true,
          
          // 🆕 NEW: Include chapters instead of old content fields
          chapters: {
            where: {
              publishStatus: 'PUBLISHED' // Only published chapters for students
            },
            orderBy: {
              order: 'asc'
            },
            select: {
              id: true,
              title: true,
              description: true,
              content: true,
              videoUrl: true,
              videoDuration: true,
              videoSize: true,
              thumbnailUrl: true,
              type: true,
              order: true,
              publishStatus: true
            }
          },
          
          price: true,
          isFree: true,
          isPublished: true,
          createdAt: true,
          updatedAt: true
        }
      },
    },
  });

  // Convert BigInt fields in chapters
  if (course && course.modules) {
    course.modules.forEach(module => {
      if (module.chapters) {
        module.chapters = module.chapters.map(chapter => ({
          ...chapter,
          videoSize: chapter.videoSize ? chapter.videoSize.toString() : null
        }));
      }
    });
  }

  return course;
};

// FIXED: Admin version can see draft chapters
const getCourseByIdForAdmin = async (id) => {
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
          type: true,
          orderIndex: true,
          
          // 🆕 NEW: Admin sees all chapters (including drafts)
          chapters: {
            orderBy: {
              order: 'asc'
            },
            select: {
              id: true,
              title: true,
              description: true,
              content: true,
              videoUrl: true,
              videoDuration: true,
              videoSize: true,
              thumbnailUrl: true,
              type: true,
              order: true,
              publishStatus: true
            }
          },
          
          price: true,
          isFree: true,
          isPublished: true,
          createdAt: true,
          updatedAt: true
        }
      },
    },
  });

  // Convert BigInt fields in chapters
  if (course && course.modules) {
    course.modules.forEach(module => {
      if (module.chapters) {
        module.chapters = module.chapters.map(chapter => ({
          ...chapter,
          videoSize: chapter.videoSize ? chapter.videoSize.toString() : null
        }));
      }
    });
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
  // Validate pricing logic
  if (data.isPaid && (!data.price || data.price <= 0)) {
    throw new Error('Paid courses must have a price greater than 0');
  }
  
  // Set price to 0 if course is not paid
  if (!data.isPaid) {
    data.price = 0;
  }

  return await prisma.course.create({ data });
};

const updateCourse = async (id, data) => {
  // Validate pricing logic
  if (data.isPaid && (!data.price || data.price <= 0)) {
    throw new Error('Paid courses must have a price greater than 0');
  }
  
  // Set price to 0 if course is not paid
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
  getAllCoursesForAdmin,
  getCourseById,
  getCourseByIdForAdmin,
  getCourseByIdWithOwnership,
  createCourse,
  updateCourse,
  softDeleteCourse,
  searchCourses
};