const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Create categories
  const webDev = await prisma.category.create({
    data: {
      name: 'Web Development',
      slug: 'web-dev',
    },
  });

  const dataSci = await prisma.category.create({
    data: {
      name: 'Data Science',
      slug: 'data-science',
    },
  });

  // Create course
  const course = await prisma.course.create({
    data: {
      title: 'Learn Node.js',
      price: 29.99,
      description: 'Backend development using Node.js and Express',
      categoryId: webDev.id,
    },
  });

  // Create modules
  await prisma.module.createMany({
    data: [
      {
        title: 'Intro to Node.js',
        content: 'What is Node.js, why use it, and installation.',
        courseId: course.id,
      },
      {
        title: 'Express Basics',
        content: 'Learn about routing, middleware, and setting up a server.',
        courseId: course.id,
      },
    ],
  });

  // (Optional) Create dummy user
  const user = await prisma.user.create({
    data: {
      name: 'Demo User',
      email: 'demo@example.com',
      password: 'dummy-password', // this is plain text just for demo; in real flows use bcrypt
      role: 'USER',
    },
  });

  // Enroll user
  await prisma.enrollment.create({
    data: {
      userId: user.id,
      courseId: course.id,
    },
  });

  console.log('✅ Seed data created!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
