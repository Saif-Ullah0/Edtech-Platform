// backend/prisma/seed.js
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

  // Create test user for module purchases
  let testUser = await prisma.user.findUnique({
    where: { email: 'test@example.com' }
  });

  if (!testUser) {
    testUser = await prisma.user.create({
      data: {
        name: 'Test User',
        email: 'test@example.com',
        password: await bcrypt.hash('test123', 10),
        role: 'USER'
      }
    });
    console.log('✅ Test user created:', testUser.email);
  } else {
    console.log('ℹ️ Test user already exists:', testUser.email);
  }

  // Create or find categories
  const categories = [
    {
      name: 'Web Development',
      slug: 'web-development',
      description: 'Learn modern web development technologies',
      imageUrl: 'https://images.unsplash.com/photo-1547658719-da2b51169166?w=800&h=400&fit=crop'
    },
    {
      name: 'Mobile Development',
      slug: 'mobile-development',
      description: 'Build mobile applications for iOS and Android',
      imageUrl: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&h=400&fit=crop'
    },
    {
      name: 'Data Science',
      slug: 'data-science',
      description: 'Analyze data and build machine learning models',
      imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=400&fit=crop'
    },
    {
      name: 'UI/UX Design',
      slug: 'ui-ux-design',
      description: 'Create beautiful and user-friendly interfaces',
      imageUrl: 'https://images.unsplash.com/photo-1581291518857-4e27b48ff24e?w=800&h=400&fit=crop'
    }
  ];

  for (const categoryData of categories) {
    await prisma.category.upsert({
      where: { slug: categoryData.slug },
      update: categoryData,
      create: categoryData
    });
  }

  console.log('✅ Categories ready');

  // Get category references
  const webDevCategory = await prisma.category.findUnique({ where: { slug: 'web-development' } });
  const dataCategory = await prisma.category.findUnique({ where: { slug: 'data-science' } });
  const designCategory = await prisma.category.findUnique({ where: { slug: 'ui-ux-design' } });

  // Handle courses with try-catch to avoid unique constraint errors
  const coursesData = [
    {
      title: 'React Fundamentals Enhanced',
      slug: 'react-fundamentals-enhanced',
      description: 'Learn React from scratch with modern hooks and best practices. Master component-based architecture and state management.',
      price: 99.99,
      imageUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&h=400&fit=crop',
      categoryId: webDevCategory.id
    },
    {
      title: 'Node.js Backend Mastery',
      slug: 'nodejs-backend-mastery',
      description: 'Build scalable backend applications with Node.js, Express, and databases. Learn API development and server architecture.',
      price: 149.99,
      imageUrl: 'https://images.unsplash.com/photo-1627398242454-45a1465c2479?w=800&h=400&fit=crop',
      categoryId: webDevCategory.id
    },
    {
      title: 'Python Data Science Complete',
      slug: 'python-data-science-complete',
      description: 'Learn Python programming for data analysis and machine learning. Perfect for beginners and career changers.',
      price: 0,
      imageUrl: 'https://images.unsplash.com/photo-1526379879527-8559ecfcaec0?w=800&h=400&fit=crop',
      categoryId: dataCategory.id
    },
    {
      title: 'Full Stack Developer Bootcamp',
      slug: 'fullstack-developer-bootcamp',
      description: 'Complete web development course covering frontend, backend, databases, and deployment. Perfect for becoming a full-stack developer.',
      price: 299.99,
      imageUrl: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=400&fit=crop',
      categoryId: webDevCategory.id
    },
    {
      title: 'UI/UX Design Professional',
      slug: 'ui-ux-design-professional',
      description: 'Master user interface and user experience design. Learn design thinking, prototyping, and user research.',
      price: 199.99,
      imageUrl: 'https://images.unsplash.com/photo-1586717791821-3f44a563fa4c?w=800&h=400&fit=crop',
      categoryId: designCategory.id
    }
  ];

  const createdCourses = {};
  for (const courseData of coursesData) {
    try {
      // Try to find existing course first
      let existingCourse = await prisma.course.findFirst({
        where: {
          OR: [
            { slug: courseData.slug },
            { title: courseData.title }
          ]
        }
      });

      if (existingCourse) {
        // Update existing course
        const course = await prisma.course.update({
          where: { id: existingCourse.id },
          data: courseData
        });
        createdCourses[courseData.slug] = course;
        console.log(`🔄 Updated existing course: ${course.title}`);
      } else {
        // Create new course
        const course = await prisma.course.create({
          data: courseData
        });
        createdCourses[courseData.slug] = course;
        console.log(`✅ Created new course: ${course.title}`);
      }
    } catch (error) {
      console.log(`⚠️ Skipping course ${courseData.title} due to constraint: ${error.message}`);
      // Try to find the existing course anyway
      const existingCourse = await prisma.course.findFirst({
        where: {
          OR: [
            { slug: courseData.slug.replace('-enhanced', '').replace('-mastery', '').replace('-complete', '').replace('-bootcamp', '').replace('-professional', '') },
            { title: { contains: courseData.title.split(' ')[0] } }
          ]
        }
      });
      if (existingCourse) {
        createdCourses[courseData.slug] = existingCourse;
        console.log(`🔍 Found existing course: ${existingCourse.title}`);
      }
    }
  }

  console.log('✅ Courses ready');

  // Check if we need to update existing modules with payment fields
  console.log('🔄 Checking and updating modules with payment fields...');

  // Update existing modules that don't have payment fields
  try {
    await prisma.module.updateMany({
      where: {
        OR: [
          { price: null },
          { isFree: null },
          { isPublished: null }
        ]
      },
      data: {
        price: 0,
        isFree: true,
        isPublished: true
      }
    });
    console.log('✅ Updated existing modules with payment fields');
  } catch (error) {
    console.log('ℹ️ Modules already have payment fields or update not needed');
  }

  // Function to safely create/update modules
  async function createOrUpdateModules(courseKey, modulesData) {
    const course = createdCourses[courseKey];
    if (!course) {
      console.log(`⚠️ Course ${courseKey} not found, skipping modules`);
      return;
    }

    for (const moduleData of modulesData) {
      try {
        const existingModule = await prisma.module.findFirst({
          where: {
            courseId: course.id,
            orderIndex: moduleData.orderIndex
          }
        });

        if (existingModule) {
          // Update existing module
          await prisma.module.update({
            where: { id: existingModule.id },
            data: {
              ...moduleData,
              courseId: course.id
            }
          });
        } else {
          // Create new module
          await prisma.module.create({
            data: {
              ...moduleData,
              courseId: course.id
            }
          });
        }
      } catch (error) {
        console.log(`⚠️ Skipping module ${moduleData.title}: ${error.message}`);
      }
    }
  }

  // React Course Modules
  const reactModulesData = [
    {
      title: 'Introduction to React',
      content: 'Welcome to React! Learn the basics of React including components, JSX, and the virtual DOM.',
      type: 'TEXT',
      orderIndex: 1,
      price: 0,
      isFree: true,
      isPublished: true
    },
    {
      title: 'React Installation & Setup',
      content: 'Complete guide to setting up your React development environment.',
      type: 'VIDEO',
      orderIndex: 2,
      videoDuration: 900,
      price: 15.99,
      isFree: false,
      isPublished: true
    },
    {
      title: 'Components and Props',
      content: 'Learn how to create reusable components and pass data between them using props.',
      type: 'TEXT',
      orderIndex: 3,
      price: 19.99,
      isFree: false,
      isPublished: true
    },
    {
      title: 'Building Your First Component',
      content: 'Hands-on tutorial for creating your first React component.',
      type: 'VIDEO',
      orderIndex: 4,
      videoDuration: 1200,
      price: 25.99,
      isFree: false,
      isPublished: true
    },
    {
      title: 'State and Hooks',
      content: 'Understand React state management and modern hooks like useState and useEffect.',
      type: 'TEXT',
      orderIndex: 5,
      price: 29.99,
      isFree: false,
      isPublished: true
    },
    {
      title: 'useState Hook in Action',
      content: 'Watch how to implement state management using the useState hook.',
      type: 'VIDEO',
      orderIndex: 6,
      videoDuration: 1800,
      price: 35.99,
      isFree: false,
      isPublished: true
    }
  ];

  await createOrUpdateModules('react-fundamentals-enhanced', reactModulesData);

  // Node.js Course Modules  
  const nodeModulesData = [
    {
      title: 'Node.js Basics',
      content: 'Introduction to Node.js runtime and core concepts.',
      type: 'TEXT',
      orderIndex: 1,
      price: 0,
      isFree: true,
      isPublished: true
    },
    {
      title: 'Setting up Node.js Environment',
      content: 'Step-by-step guide to install and configure Node.js.',
      type: 'VIDEO',
      orderIndex: 2,
      videoDuration: 600,
      price: 22.99,
      isFree: false,
      isPublished: true
    },
    {
      title: 'Express.js Framework',
      content: 'Building web applications with Express.js framework.',
      type: 'TEXT',
      orderIndex: 3,
      price: 39.99,
      isFree: false,
      isPublished: true
    },
    {
      title: 'Creating REST APIs with Express',
      content: 'Learn to build RESTful APIs using Express.js.',
      type: 'VIDEO',
      orderIndex: 4,
      videoDuration: 2400,
      price: 49.99,
      isFree: false,
      isPublished: true
    },
    {
      title: 'Database Integration',
      content: 'Connect your Node.js app to MongoDB and PostgreSQL.',
      type: 'TEXT',
      orderIndex: 5,
      price: 45.99,
      isFree: false,
      isPublished: true
    }
  ];

  await createOrUpdateModules('nodejs-backend-mastery', nodeModulesData);

  // Python Course Modules (All free)
  const pythonModulesData = [
    {
      title: 'Python Basics',
      content: 'Introduction to Python programming language.',
      type: 'TEXT',
      orderIndex: 1,
      price: 0,
      isFree: true,
      isPublished: true
    },
    {
      title: 'Python Installation Guide',
      content: 'Complete guide to installing Python and setting up your environment.',
      type: 'VIDEO',
      orderIndex: 2,
      videoDuration: 800,
      price: 0,
      isFree: true,
      isPublished: true
    },
    {
      title: 'Variables and Data Types',
      content: 'Learn about Python variables, strings, numbers, and basic data types.',
      type: 'TEXT',
      orderIndex: 3,
      price: 0,
      isFree: true,
      isPublished: true
    },
    {
      title: 'Working with Lists and Dictionaries',
      content: 'Practical tutorial on Python lists and dictionaries.',
      type: 'VIDEO',
      orderIndex: 4,
      videoDuration: 1500,
      price: 0,
      isFree: true,
      isPublished: true
    }
  ];

  await createOrUpdateModules('python-data-science-complete', pythonModulesData);

  // Full Stack Course Modules
  const fullStackModulesData = [
    {
      title: 'Full Stack Overview',
      content: 'Introduction to full stack development and modern web architecture.',
      type: 'TEXT',
      orderIndex: 1,
      price: 0,
      isFree: true,
      isPublished: true
    },
    {
      title: 'Frontend Fundamentals',
      content: 'HTML, CSS, and JavaScript fundamentals for modern web development.',
      type: 'VIDEO',
      orderIndex: 2,
      videoDuration: 3600,
      price: 59.99,
      isFree: false,
      isPublished: true
    },
    {
      title: 'React Advanced Concepts',
      content: 'Advanced React patterns, context, and performance optimization.',
      type: 'VIDEO',
      orderIndex: 3,
      videoDuration: 4200,
      price: 79.99,
      isFree: false,
      isPublished: true
    },
    {
      title: 'Backend API Development',
      content: 'Build robust APIs with authentication and database integration.',
      type: 'VIDEO',
      orderIndex: 4,
      videoDuration: 5400,
      price: 89.99,
      isFree: false,
      isPublished: true
    },
    {
      title: 'Database Design & Management',
      content: 'Learn SQL, NoSQL, and database optimization techniques.',
      type: 'TEXT',
      orderIndex: 5,
      price: 69.99,
      isFree: false,
      isPublished: true
    },
    {
      title: 'Deployment & DevOps',
      content: 'Deploy applications to AWS, Docker, and CI/CD pipelines.',
      type: 'VIDEO',
      orderIndex: 6,
      videoDuration: 3000,
      price: 99.99,
      isFree: false,
      isPublished: true
    }
  ];

  await createOrUpdateModules('fullstack-developer-bootcamp', fullStackModulesData);

  // Design Course Modules
  const designModulesData = [
    {
      title: 'Design Thinking Fundamentals',
      content: 'Introduction to design thinking process and user-centered design.',
      type: 'TEXT',
      orderIndex: 1,
      price: 0,
      isFree: true,
      isPublished: true
    },
    {
      title: 'User Research Methods',
      content: 'Learn various user research techniques and how to conduct interviews.',
      type: 'VIDEO',
      orderIndex: 2,
      videoDuration: 2700,
      price: 45.99,
      isFree: false,
      isPublished: true
    },
    {
      title: 'Wireframing and Prototyping',
      content: 'Create wireframes and interactive prototypes using modern tools.',
      type: 'VIDEO',
      orderIndex: 3,
      videoDuration: 3300,
      price: 55.99,
      isFree: false,
      isPublished: true
    },
    {
      title: 'Visual Design Principles',
      content: 'Master color theory, typography, and visual hierarchy.',
      type: 'TEXT',
      orderIndex: 4,
      price: 39.99,
      isFree: false,
      isPublished: true
    },
    {
      title: 'Advanced Prototyping',
      content: 'Build high-fidelity prototypes and conduct usability testing.',
      type: 'VIDEO',
      orderIndex: 5,
      videoDuration: 4500,
      price: 75.99,
      isFree: false,
      isPublished: true
    }
  ];

  await createOrUpdateModules('ui-ux-design-professional', designModulesData);

  console.log('✅ Modules created/updated with pricing');

  // Get any free course for sample enrollment
  const freeCourse = Object.values(createdCourses).find(course => course.price === 0);
  
  if (freeCourse) {
    // Create sample enrollment for free course only
    const existingEnrollment = await prisma.enrollment.findFirst({
      where: {
        userId: regularUser.id,
        courseId: freeCourse.id
      }
    });

    if (!existingEnrollment) {
      await prisma.enrollment.create({
        data: {
          userId: regularUser.id,
          courseId: freeCourse.id,
          progress: 25.0,
          lastAccessed: new Date()
        }
      });

      console.log('✅ Sample enrollment created (free course only)');
    }
  }

  console.log('🎉 Database seeding completed!');
  console.log('\n📊 Summary:');
  console.log('- 3 Users ready (admin, regular, test)');
  console.log('- 4 Categories ready');
  console.log(`- ${Object.keys(createdCourses).length} Courses ready (1 free, others paid)`);
  console.log('- Modules ready with mixed pricing (FREE and PAID)');
  console.log('- Payment fields added to all modules');
  
  console.log('\n🔑 Login credentials:');
  console.log('Admin: admin@example.com / admin123');
  console.log('User: user@example.com / user123');
  console.log('Test: test@example.com / test123');
  
  console.log('\n🆓 Free course available for testing');
  console.log('💰 Paid courses with module pricing');
  console.log('🛒 Module payment system ready for testing!');
  
  console.log('\n💡 Module Pricing Strategy:');
  console.log('- First module always FREE (introduction)');
  console.log('- Text modules: $15 - $45');
  console.log('- Video modules: $20 - $99'); 
  console.log('- Progressive pricing based on complexity');
  
  console.log('\n🎯 Ready to test:');
  console.log('1. Login with any user account');
  console.log('2. Browse courses and see module pricing');
  console.log('3. Use the Module Shop to purchase individual modules');
  console.log('4. Create and purchase bundles');
  console.log('5. Test the complete payment flow!');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });