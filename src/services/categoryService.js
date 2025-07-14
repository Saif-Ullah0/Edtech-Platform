const prisma = require('../../prisma/client');

const getAllCategories = async (options = {}) => {
  return await prisma.category.findMany({
    ...options,
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
      createdAt: true,
    },
  });
};

const getCategoryById = async (id) => {
  return await prisma.category.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      slug: true,
      description: true,
      imageUrl: true,
      createdAt: true,
      courses: {
        select: {
          id: true,
          title: true,
          description: true,
          price: true,
          createdAt: true,
        },
      },
    },
  });
};

const updateCategory = async (id, data) => {
  return await prisma.category.update({
    where: { id },
    data,
  });
};

const deleteCategory = async (id) => {
  return await prisma.category.delete({
    where: { id },
  });
};

module.exports = {
  getAllCategories,
  getCategoryById,
  updateCategory,
  deleteCategory,
};
