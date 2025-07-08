const prisma = require('../../prisma/client');

const getAllModulesByCourse = async (courseId) => {
  return await prisma.module.findMany({
    where: { courseId },
  });
};

const getModuleById = async (id) => {
  return await prisma.module.findUnique({
    where: { id },
  });
};

const createModule = async (data) => {
  return await prisma.module.create({ data });
};

const updateModule = async (id, data) => {
  return await prisma.module.update({
    where: { id },
    data,
  });
};

const deleteModule = async (id) => {
  return await prisma.module.delete({
    where: { id },
  });
};

module.exports = {
  getAllModulesByCourse,
  getModuleById,
  createModule,
  updateModule,
  deleteModule
};
