const prisma = require('../../prisma/client');

const getAllCourses = async (categorySlug) => {
  const filter = categorySlug ? {
      category: {
        slug: categorySlug,
      },
    }
    : {};

  return await prisma.course.findMany({
    where: filter,
    select: {
      id: true,
      title: true,
      description: true,
      price: true,
      category: {
        select: {
          id: true,
          name: true,
          slug: true
        }
      }
    }
  });
};

const getCourseById = async (id) => {
  return await prisma.course.findUnique({
    where: { id },
    include: {
      category: true,
      modules: true,
    }
  });
};

module.exports = {
  getAllCourses,
  getCourseById
};
