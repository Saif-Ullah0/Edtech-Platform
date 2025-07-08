// src/services/orderService.js
const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

exports.createOrder = async (userId, courseId) => {
  const course = await prisma.course.findUnique({
    where: { id: courseId },
  });

  if (!course || course.isDeleted) {
    throw new Error("Invalid course");
  }

  const order = await prisma.order.create({
    data: {
      userId,
      status: "PENDING",
      totalAmount: course.price,
      items: {
        create: {
          courseId,
          price: course.price,
        },
      },
    },
    include: {
      items: true,
    },
  });

  return order;
};
