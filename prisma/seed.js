const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');
const prisma = new PrismaClient();

async function main() {
  // 1. Create or update category
  const webDev = await prisma.category.upsert({
    where: { slug: 'web-dev' },
    update: {},
    create: {
      name: 'Web Development',
      slug: 'web-dev',
      description: 'Learn to build websites',
      imageUrl: 'https://example.com/web.jpg',
    },
  });

  // 2. Create a course under Web Dev
  const course = await prisma.course.upsert({
    where: { title: 'Learn Node.js' },
    update: {},
    create: {
      title: 'Learn Node.js',
      price: 29.99,
      description: 'Backend development using Node.js and Express',
      categoryId: webDev.id,
    },
  });

  // 3. Create modules (first delete to avoid duplicates)
  await prisma.module.deleteMany({ where: { courseId: course.id } });

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

  // 4. Create or update user
  const hashedPassword = await bcrypt.hash('dummy-password', 10);
  const user = await prisma.user.upsert({
    where: { email: 'demo@example.com' },
    update: { name: 'Demo User', password: hashedPassword },
    create: {
      name: 'Demo User',
      email: 'demo@example.com',
      password: hashedPassword,
      role: 'USER',
    },
  });

  // 5. Enroll user in course (only if not already enrolled)
  const isAlreadyEnrolled = await prisma.enrollment.findFirst({
    where: { userId: user.id, courseId: course.id },
  });

  if (!isAlreadyEnrolled) {
    await prisma.enrollment.create({
      data: {
        userId: user.id,
        courseId: course.id,
      },
    });
  }

  console.log('✅ Seed data created!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
