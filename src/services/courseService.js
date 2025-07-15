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
    select: {
      id: true,
      title: true,
      slug: true,
      description: true,
      price: true,
      imageUrl: true,
      createdAt: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true,
        },
      },
    },
  });
};

const getCourseById = async (id) => {
  return await prisma.course.findUnique({
    where: { id },
    include: {
      category: true,
      modules: true,
    },
  });
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
  createCourse,
  updateCourse,
  softDeleteCourse,
  searchCourses
};
