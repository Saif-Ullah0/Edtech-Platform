// backend/scripts/seedData.js
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function main() {
  console.log('🌱 Starting database seeding...');

  // Create or find admin user
  const hashedPassword = await bcrypt.hash('admin123', 10);
  let adminUser = await prisma.user.findUnique({
    where: { email: 'admin@example.com' }
  });

  if (!adminUser) {
    adminUser = await prisma.user.create({
      data: {
        name: 'Admin User',
        email: 'admin@example.com',
        password: hashedPassword,
        role: 'ADMIN'
      }
    });
    console.log('✅ Admin user created:', adminUser.email);
  } else {
    console.log('ℹ️ Admin user already exists:', adminUser.email);
  }

  // Create or find regular user  
  const regularPassword = await bcrypt.hash('user123', 10);
  let regularUser = await prisma.user.findUnique({
    where: { email: 'user@example.com' }
  });

  if (!regularUser) {
    regularUser = await prisma.user.create({
      data: {
        name: 'John Doe',
        email: 'user@example.com', 
        password: regularPassword,
        role: 'USER'
      }
    });
    console.log('✅ Regular user created:', regularUser.email);
  } else {
    console.log('ℹ️ Regular user already exists:', regularUser.email);
  }

  // Create or find categories
  let webDevCategory = await prisma.category.findUnique({
    where: { slug: 'web-development' }
  });

  if (!webDevCategory) {
    webDevCategory = await prisma.category.create({
      data: {
        name: 'Web Development',
        slug: 'web-development',
        description: 'Learn modern web development technologies',
        imageUrl: '/images/web-dev.jpg'
      }
    });
  }

  let mobileDevCategory = await prisma.category.findUnique({
    where: { slug: 'mobile-development' }
  });

  if (!mobileDevCategory) {
    mobileDevCategory = await prisma.category.create({
      data: {
        name: 'Mobile Development',
        slug: 'mobile-development', 
        description: 'Build mobile applications for iOS and Android',
        imageUrl: '/images/mobile-dev.jpg'
      }
    });
  }

  let dataCategory = await prisma.category.findUnique({
    where: { slug: 'data-science' }
  });

  if (!dataCategory) {
    dataCategory = await prisma.category.create({
      data: {
        name: 'Data Science',
        slug: 'data-science',
        description: 'Analyze data and build machine learning models',
        imageUrl: '/images/data-science.jpg'
      }
    });
  }

  console.log('✅ Categories ready');

  // Create or find courses
  let reactCourse = await prisma.course.findUnique({
    where: { slug: 'react-fundamentals' }
  });

  if (!reactCourse) {
    reactCourse = await prisma.course.create({
      data: {
        title: 'React Fundamentals',
        slug: 'react-fundamentals',
        description: 'Learn React from scratch with modern hooks and best practices',
        price: 99.99,
        imageUrl: '/images/react-course.jpg',
        categoryId: webDevCategory.id
      }
    });
  }

  let nodeCourse = await prisma.course.findUnique({
    where: { slug: 'nodejs-backend' }
  });

  if (!nodeCourse) {
    nodeCourse = await prisma.course.create({
      data: {
        title: 'Node.js Backend Development', 
        slug: 'nodejs-backend',
        description: 'Build scalable backend applications with Node.js and Express',
        price: 149.99,
        imageUrl: '/images/node-course.jpg',
        categoryId: webDevCategory.id
      }
    });
  }

  let pythonCourse = await prisma.course.findUnique({
    where: { slug: 'python-data-science' }
  });

  if (!pythonCourse) {
    pythonCourse = await prisma.course.create({
      data: {
        title: 'Python for Data Science',
        slug: 'python-data-science',
        description: 'Learn Python programming for data analysis and machine learning',
        price: 0, // Free course for testing
        imageUrl: '/images/python-course.jpg',
        categoryId: dataCategory.id
      }
    });
  }

  console.log('✅ Courses ready');

  // Check if modules already exist
  const existingModules = await prisma.module.count({
    where: { courseId: reactCourse.id }
  });

  if (existingModules === 0) {
    // Create modules for React course (Mix of TEXT and VIDEO)
    await prisma.module.createMany({
      data: [
        {
          title: 'Introduction to React',
          content: 'Welcome to React! In this module, you will learn the basics of React including components, JSX, and the virtual DOM. React is a popular JavaScript library for building user interfaces, especially for web applications.',
          type: 'TEXT',
          orderIndex: 1,
          courseId: reactCourse.id
        },
        {
          title: 'React Installation & Setup',
          content: 'Watch this video to learn how to set up your React development environment.',
          type: 'VIDEO',
          orderIndex: 2,
          courseId: reactCourse.id,
          videoUrl: '/videos/react-setup.mp4',
          videoDuration: 900, // 15 minutes
          thumbnailUrl: '/thumbnails/react-setup.jpg'
        },
        {
          title: 'Components and Props',
          content: 'Learn how to create reusable components and pass data between them using props. Components are the building blocks of React applications.',
          type: 'TEXT', 
          orderIndex: 3,
          courseId: reactCourse.id
        },
        {
          title: 'Building Your First Component',
          content: 'Hands-on video tutorial for creating your first React component.',
          type: 'VIDEO',
          orderIndex: 4,
          courseId: reactCourse.id,
          videoUrl: '/videos/first-component.mp4',
          videoDuration: 1200, // 20 minutes
          thumbnailUrl: '/thumbnails/first-component.jpg'
        },
        {
          title: 'State and Hooks',
          content: 'Understand React state management and modern hooks like useState and useEffect. Hooks allow you to use state and other React features in functional components.',
          type: 'TEXT',
          orderIndex: 5,
          courseId: reactCourse.id
        },
        {
          title: 'useState Hook in Action',
          content: 'Watch how to implement state management using the useState hook.',
          type: 'VIDEO',
          orderIndex: 6,
          courseId: reactCourse.id,
          videoUrl: '/videos/usestate-hook.mp4',
          videoDuration: 1800, // 30 minutes
          thumbnailUrl: '/thumbnails/usestate-hook.jpg'
        }
      ]
    });

    // Create modules for Node.js course
    await prisma.module.createMany({
      data: [
        {
          title: 'Node.js Basics',
          content: 'Introduction to Node.js runtime and core concepts. Node.js allows you to run JavaScript on the server side.',
          type: 'TEXT',
          orderIndex: 1,
          courseId: nodeCourse.id
        },
        {
          title: 'Setting up Node.js Environment',
          content: 'Step-by-step video guide to install and configure Node.js.',
          type: 'VIDEO',
          orderIndex: 2,
          courseId: nodeCourse.id,
          videoUrl: '/videos/nodejs-setup.mp4',
          videoDuration: 600, // 10 minutes
          thumbnailUrl: '/thumbnails/nodejs-setup.jpg'
        },
        {
          title: 'Express.js Framework',
          content: 'Building web applications with Express.js framework. Express is a minimal and flexible Node.js web application framework.',
          type: 'TEXT',
          orderIndex: 3, 
          courseId: nodeCourse.id
        },
        {
          title: 'Creating REST APIs with Express',
          content: 'Learn to build RESTful APIs using Express.js in this comprehensive video.',
          type: 'VIDEO',
          orderIndex: 4,
          courseId: nodeCourse.id,
          videoUrl: '/videos/express-api.mp4',
          videoDuration: 2400, // 40 minutes
          thumbnailUrl: '/thumbnails/express-api.jpg'
        }
      ]
    });

    // Create modules for Python course (Free course for testing)
    await prisma.module.createMany({
      data: [
        {
          title: 'Python Basics',
          content: 'Introduction to Python programming language. Python is a versatile, high-level programming language that is great for beginners.',
          type: 'TEXT',
          orderIndex: 1,
          courseId: pythonCourse.id
        },
        {
          title: 'Python Installation Guide',
          content: 'Complete guide to installing Python and setting up your development environment.',
          type: 'VIDEO',
          orderIndex: 2,
          courseId: pythonCourse.id,
          videoUrl: '/videos/python-install.mp4',
          videoDuration: 800, // 13+ minutes
          thumbnailUrl: '/thumbnails/python-install.jpg'
        },
        {
          title: 'Variables and Data Types',
          content: 'Learn about Python variables, strings, numbers, and basic data types in this foundational lesson.',
          type: 'TEXT',
          orderIndex: 3,
          courseId: pythonCourse.id
        },
        {
          title: 'Working with Lists and Dictionaries',
          content: 'Practical video tutorial on Python lists and dictionaries.',
          type: 'VIDEO',
          orderIndex: 4,
          courseId: pythonCourse.id,
          videoUrl: '/videos/python-data-structures.mp4',
          videoDuration: 1500, // 25 minutes
          thumbnailUrl: '/thumbnails/python-data-structures.jpg'
        }
      ]
    });

    console.log('✅ Modules created (mix of TEXT and VIDEO)');
  } else {
    console.log('ℹ️ Modules already exist, skipping creation');
  }

  // Check if enrollments already exist
  const existingEnrollment = await prisma.enrollment.findFirst({
    where: {
      userId: regularUser.id,
      courseId: reactCourse.id
    }
  });

  if (!existingEnrollment) {
    // Create sample enrollments with progress tracking
    const enrollment1 = await prisma.enrollment.create({
      data: {
        userId: regularUser.id,
        courseId: reactCourse.id,
        progress: 0.0, // Starting with 0% progress
        lastAccessed: new Date()
      }
    });

    const enrollment2 = await prisma.enrollment.create({
      data: {
        userId: regularUser.id,
        courseId: pythonCourse.id, // Enroll in free course
        progress: 0.0,
        lastAccessed: new Date()
      }
    });

    console.log('✅ Sample enrollments created with progress tracking');

    // Create sample module progress (simulate some progress)
    const reactModules = await prisma.module.findMany({
      where: { courseId: reactCourse.id },
      orderBy: { orderIndex: 'asc' }
    });

    // Mark first module as completed
    if (reactModules.length > 0) {
      await prisma.moduleProgress.create({
        data: {
          enrollmentId: enrollment1.id,
          moduleId: reactModules[0].id,
          isCompleted: true,
          completionPercentage: 100.0,
          completedAt: new Date(),
          watchTime: 0 // Text module, no watch time
        }
      });

      // Update enrollment progress
      await prisma.enrollment.update({
        where: { id: enrollment1.id },
        data: { progress: (1 / reactModules.length) * 100 }
      });

      console.log('✅ Sample module progress created');
    }
  } else {
    console.log('ℹ️ Enrollments already exist, skipping creation');
  }

  console.log('🎉 Database seeding completed!');
  console.log('\n📊 Summary:');
  console.log('- Users ready (admin and regular)');
  console.log('- 3 categories ready');
  console.log('- Courses ready (1 free, 2+ paid)');
  console.log('- Modules ready (TEXT and VIDEO mix)');
  console.log('- Enrollments ready with progress tracking');
  console.log('\n🔑 Login credentials:');
  console.log('Admin: admin@example.com / admin123');
  console.log('User: user@example.com / user123');
  console.log('\n🆓 Free course available: Python for Data Science');
  console.log('💰 Paid courses: React, Node.js');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });