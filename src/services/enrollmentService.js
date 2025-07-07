const prisma = require('../../prisma/client');

const enrollUserInCourse = async (userId, courseId) => {
  const numericCourseId = parseInt(courseId, 10);

  const existingEnrollment = await prisma.enrollment.findFirst({
    where: {
      userId,
      courseId: numericCourseId,
    },
  });

  if (existingEnrollment) {
    throw new Error('User already enrolled in this course');
  }

  return await prisma.enrollment.create({
    data: {
      userId,
      courseId: numericCourseId,
    },
  });
};

const getEnrolledCourses = async (userId) => {
  return await prisma.enrollment.findMany({
    where: { userId },
    include: {
      course: {
        select: {
          id: true,
          title: true,
          description: true,
          price: true,
          category: {
            select: {
              id: true,
              name: true,
            },
          },
        },
      },
    },
  });
};

const getModulesIfEnrolled = async (userId, courseId) => {
  const enrollment = await prisma.enrollment.findFirst({
    where: { userId, courseId: parseInt(courseId), },
  });

  if (!enrollment) {
    throw new Error('Access denied: Not enrolled in this course');
  }

  return await prisma.module.findMany({
    where: { courseId: parseInt(courseId), },
    select: {
      id: true,
      title: true,
      content: true,
    },
  });
};

module.exports = {
  enrollUserInCourse,
  getEnrolledCourses,
  getModulesIfEnrolled,
};
