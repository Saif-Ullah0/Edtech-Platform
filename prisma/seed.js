// backend/scripts/seedData.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@example.com',
      password: hashedPassword,
      role: 'ADMIN'
    }
  });
  console.log('✅ Admin user created:', adminUser.email);

  // Create regular user  
  const regularPassword = await bcrypt.hash('user123', 10);
  const regularUser = await prisma.user.create({
    data: {
      name: 'John Doe',
      email: 'user@example.com', 
      password: regularPassword,
      role: 'USER'
    }
  });
  console.log('✅ Regular user created:', regularUser.email);

  // Create categories
  const webDevCategory = await prisma.category.create({
    data: {
      name: 'Web Development',
      slug: 'web-development',
      description: 'Learn modern web development technologies',
      imageUrl: '/images/web-dev.jpg'
    }
  });

  const mobileDevCategory = await prisma.category.create({
    data: {
      name: 'Mobile Development',
      slug: 'mobile-development', 
      description: 'Build mobile applications for iOS and Android',
      imageUrl: '/images/mobile-dev.jpg'
    }
  });

  const dataCategory = await prisma.category.create({
    data: {
      name: 'Data Science',
      slug: 'data-science',
      description: 'Analyze data and build machine learning models',
      imageUrl: '/images/data-science.jpg'
    }
  });

  console.log('✅ Categories created');

  // Create courses
  const reactCourse = await prisma.course.create({
    data: {
      title: 'React Fundamentals',
      slug: 'react-fundamentals',
      description: 'Learn React from scratch with modern hooks and best practices',
      price: 99.99,
      imageUrl: '/images/react-course.jpg',
      categoryId: webDevCategory.id
    }
  });

  const nodeCourse = await prisma.course.create({
    data: {
      title: 'Node.js Backend Development', 
      slug: 'nodejs-backend',
      description: 'Build scalable backend applications with Node.js and Express',
      price: 149.99,
      imageUrl: '/images/node-course.jpg',
      categoryId: webDevCategory.id
    }
  });

  const fullStackCourse = await prisma.course.create({
    data: {
      title: 'Full Stack Development',
      slug: 'full-stack-development',
      description: 'Complete MERN stack development course',
      price: 299.99,
      imageUrl: '/images/fullstack-course.jpg', 
      categoryId: webDevCategory.id
    }
  });

  const reactNativeCourse = await prisma.course.create({
    data: {
      title: 'React Native Mobile Apps',
      slug: 'react-native-mobile',
      description: 'Build cross-platform mobile apps with React Native',
      price: 199.99,
      imageUrl: '/images/react-native-course.jpg',
      categoryId: mobileDevCategory.id
    }
  });

  const pythonCourse = await prisma.course.create({
    data: {
      title: 'Python for Data Science',
      slug: 'python-data-science',
      description: 'Learn Python programming for data analysis and machine learning',
      price: 179.99,
      imageUrl: '/images/python-course.jpg',
      categoryId: dataCategory.id
    }
  });

  console.log('✅ Courses created');

  // Create text modules for React course
  await prisma.module.create({
    data: {
      title: 'Introduction to React',
      content: 'Welcome to React! In this module, you will learn the basics of React including components, JSX, and the virtual DOM.',
      type: 'TEXT',
      orderIndex: 1,
      courseId: reactCourse.id
    }
  });

  await prisma.module.create({
    data: {
      title: 'Components and Props',
      content: 'Learn how to create reusable components and pass data between them using props.',
      type: 'TEXT', 
      orderIndex: 2,
      courseId: reactCourse.id
    }
  });

  await prisma.module.create({
    data: {
      title: 'State and Hooks',
      content: 'Understand React state management and modern hooks like useState and useEffect.',
      type: 'TEXT',
      orderIndex: 3,
      courseId: reactCourse.id
    }
  });

  // Create text modules for Node.js course
  await prisma.module.create({
    data: {
      title: 'Node.js Basics',
      content: 'Introduction to Node.js runtime and core concepts.',
      type: 'TEXT',
      orderIndex: 1,
      courseId: nodeCourse.id
    }
  });

  await prisma.module.create({
    data: {
      title: 'Express.js Framework',
      content: 'Building web applications with Express.js framework.',
      type: 'TEXT',
      orderIndex: 2, 
      courseId: nodeCourse.id
    }
  });

  // Create text modules for other courses
  await prisma.module.create({
    data: {
      title: 'Full Stack Overview',
      content: 'Understanding the full stack development workflow.',
      type: 'TEXT',
      orderIndex: 1,
      courseId: fullStackCourse.id
    }
  });

  await prisma.module.create({
    data: {
      title: 'React Native Introduction',
      content: 'Getting started with React Native development.',
      type: 'TEXT',
      orderIndex: 1,
      courseId: reactNativeCourse.id
    }
  });

  await prisma.module.create({
    data: {
      title: 'Python Basics',
      content: 'Introduction to Python programming language.',
      type: 'TEXT',
      orderIndex: 1,
      courseId: pythonCourse.id
    }
  });

  console.log('✅ Text modules created');

  // Create sample enrollments
  await prisma.enrollment.create({
    data: {
      userId: regularUser.id,
      courseId: reactCourse.id
    }
  });

  await prisma.enrollment.create({
    data: {
      userId: regularUser.id,
      courseId: nodeCourse.id
    }
  });

  console.log('✅ Sample enrollments created');

  console.log('🎉 Database seeding completed!');
  console.log('\n📊 Summary:');
  console.log('- 2 users created (admin and regular)');
  console.log('- 3 categories created');
  console.log('- 5 courses created');
  console.log('- 8 text modules created');
  console.log('- 2 enrollments created');
  console.log('\n🔑 Login credentials:');
  console.log('Admin: admin@example.com / admin123');
  console.log('User: user@example.com / user123');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });