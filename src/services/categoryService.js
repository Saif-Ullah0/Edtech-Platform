const prisma = require('../../prisma/client');

const getAllCategories = async () => {
  return await prisma.category.findMany({
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


module.exports = {
    getAllCategories
};
