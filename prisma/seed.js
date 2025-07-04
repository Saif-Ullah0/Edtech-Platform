const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  // Create categories
  const categories = await prisma.category.createMany({
    data: [
      {
        name: 'Web Development',
        slug: 'web-dev',
        description: 'Learn to build websites',
        imageUrl: 'https://example.com/web.jpg',
      },
      {
        name: 'Graphic Design',
        slug: 'design',
        description: 'Design with Adobe tools',
        imageUrl: 'https://example.com/design.jpg',
      },
      {
        name: 'Data Science',
        slug: 'data-science',
        description: 'Analyze and visualize data',
        imageUrl: 'https://example.com/data.jpg',
      },
    ],
    skipDuplicates: true, // avoids unique constraint errors
  });

  // Fetch Web Dev category to create course under it
  const webDev = await prisma.category.findUnique({
    where: { slug: 'web-dev' },
  });

  // Create a course
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

  // Create a dummy user
  const user = await prisma.user.upsert({
  where: { email: 'demo@example.com' },
  update: {}, // nothing to update if it already exists
  create: {
    name: 'Demo User',
    email: 'demo@example.com',
    password: 'dummy-password', // in real app, hash it
    role: 'USER',
  },
});


  // Enroll user in course
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
