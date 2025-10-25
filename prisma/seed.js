// backend/prisma/seed.js - Enhanced seed matching full schema & demo flows
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function safeDelete(modelName) {
  // helper to call deleteMany if model exists on prisma client
  if (prisma[modelName]) {
    try {
      await prisma[modelName].deleteMany({});
    } catch (e) {
      console.warn(`⚠️  Warning deleting ${modelName}:`, e.message);
    }
  }
}

async function main() {
  console.log('🌱 Starting enhanced database seeding...');

  // -------------------------
  // CLEAN EXISTING DATA (safe order)
  // -------------------------
  console.log('🧹 Cleaning existing data (safe-mode)...');

  // delete children first
  await safeDelete('chapterProgress');
  await safeDelete('moduleProgress');
  await safeDelete('moduleEnrollment');
  await safeDelete('bundlePurchase');
  await safeDelete('bundleItem');
  await safeDelete('courseBundleItem');
  await safeDelete('bundle');
  await safeDelete('reaction');
  await safeDelete('comment');
  await safeDelete('note');
  await safeDelete('chapter');
  await safeDelete('module');
  await safeDelete('enrollment');
  await safeDelete('orderItem');
  await safeDelete('order');
  await safeDelete('discount'); // optional
  await safeDelete('course');
  await safeDelete('category');
  await safeDelete('user');

  // -------------------------
  // USERS (admin + students + blocked user)
  // -------------------------
  console.log('👥 Creating users...');

  const adminUser = await prisma.user.create({
    data: {
      name: 'Admin User',
      email: 'admin@example.com',
      password: await bcrypt.hash('admin123', 10),
      role: 'ADMIN',
      status: 'ACTIVE',
      canCreatePublicBundles: true
    }
  });

  const userJohn = await prisma.user.create({
    data: {
      name: 'John Doe',
      email: 'user@example.com',
      password: await bcrypt.hash('user123', 10),
      role: 'USER',
      status: 'ACTIVE'
    }
  });

  const userTest = await prisma.user.create({
    data: {
      name: 'Test Student',
      email: 'test@example.com',
      password: await bcrypt.hash('test123', 10),
      role: 'USER',
      status: 'ACTIVE'
    }
  });

  const bannedUser = await prisma.user.create({
    data: {
      name: 'Banned Student',
      email: 'banned@example.com',
      password: await bcrypt.hash('banned123', 10),
      role: 'USER',
      status: 'BANNED'
    }
  });

  console.log('✅ Users ready');

  // -------------------------
  // CATEGORIES
  // -------------------------
  console.log('📂 Creating categories...');

  const webDevCategory = await prisma.category.create({
    data: {
      name: 'Web Development',
      slug: 'web-development',
      description: 'Learn modern web development technologies',
      imageUrl: 'https://images.unsplash.com/photo-1547658719-da2b51169166?w=800&h=400&fit=crop'
    }
  });

  const dataCategory = await prisma.category.create({
    data: {
      name: 'Data Science',
      slug: 'data-science',
      description: 'Analyze data and build machine learning models',
      imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=400&fit=crop'
    }
  });

  console.log('✅ Categories created');

  // -------------------------
  // COURSES
  // -------------------------
  console.log('📚 Creating courses...');

  const pythonCourse = await prisma.course.create({
    data: {
      title: 'Python Programming Complete',
      slug: 'python-programming-complete',
      description:
        'Learn Python programming from scratch. Master variables, functions, loops, and build real projects.',
      price: 0,
      imageUrl: 'https://images.unsplash.com/photo-1526379879527-8559ecfcaec0?w=800&h=400&fit=crop',
      publishStatus: 'PUBLISHED',
      isPaid: false,
      categoryId: dataCategory.id
    }
  });

  const reactCourse = await prisma.course.create({
    data: {
      title: 'React Development Mastery',
      slug: 'react-development-mastery',
      description: 'Master React with hooks, state management, and modern patterns.',
      price: 199.99,
      imageUrl: 'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800&h=400&fit=crop',
      publishStatus: 'PUBLISHED',
      isPaid: true,
      categoryId: webDevCategory.id
    }
  });

  const fullStackCourse = await prisma.course.create({
    data: {
      title: 'Full Stack Developer Bootcamp',
      slug: 'fullstack-developer-bootcamp',
      description: 'Frontend, backend, databases, and deployment – a complete program.',
      price: 399.99,
      imageUrl: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=400&fit=crop',
      publishStatus: 'PUBLISHED',
      isPaid: true,
      categoryId: webDevCategory.id
    }
  });

  console.log('✅ Courses created');

  // -------------------------
  // MODULES + CHAPTERS (PYTHON)
  // -------------------------
  console.log('📖 Creating Python modules and chapters...');

  const pythonMod1 = await prisma.module.create({
    data: {
      title: 'Python Fundamentals',
      description: 'Basics of Python programming.',
      slug: 'python-fundamentals',
      type: 'TEXT',
      orderIndex: 1,
      price: 0,
      isFree: true,
      isPublished: true,
      publishStatus: 'PUBLISHED',
      courseId: pythonCourse.id
    }
  });

  const pythonCh1 = await prisma.chapter.create({
    data: {
      title: 'What is Python?',
      description: 'Intro to Python.',
      content:
        '<h2>Welcome to Python!</h2><p>Python is a high-level, interpreted programming language...</p>',
      order: 1,
      type: 'TEXT',
      publishStatus: 'PUBLISHED',
      duration: 600,
      moduleId: pythonMod1.id
    }
  });

  const pythonCh2 = await prisma.chapter.create({
    data: {
      title: 'Installing Python',
      description: 'How to install Python.',
      content: '<h2>Installing Python</h2><p>Download from python.org...</p>',
      videoUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
      order: 2,
      type: 'VIDEO',
      publishStatus: 'PUBLISHED',
      duration: 900,
      moduleId: pythonMod1.id
    }
  });

  const pythonCh3 = await prisma.chapter.create({
    data: {
      title: 'Your First Python Program',
      description: 'Write your first program.',
      content: '<pre><code>print("Hello, World!")</code></pre>',
      order: 3,
      type: 'TEXT',
      publishStatus: 'PUBLISHED',
      duration: 450,
      moduleId: pythonMod1.id
    }
  });

  // Module 2
  const pythonMod2 = await prisma.module.create({
    data: {
      title: 'Variables and Data Types',
      description: 'Strings, numbers, lists, and dicts.',
      slug: 'variables-data-types',
      type: 'VIDEO',
      orderIndex: 2,
      price: 0,
      isFree: true,
      isPublished: true,
      publishStatus: 'PUBLISHED',
      courseId: pythonCourse.id
    }
  });

  const pythonCh4 = await prisma.chapter.create({
    data: {
      title: 'Understanding Variables',
      description: 'Create and use variables.',
      content: '<h2>Variables in Python</h2>',
      videoUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
      order: 1,
      type: 'VIDEO',
      publishStatus: 'PUBLISHED',
      duration: 1200,
      moduleId: pythonMod2.id
    }
  });

  console.log('✅ Python modules & chapters created');

  // -------------------------
  // MODULES + CHAPTERS (REACT)
  // -------------------------
  console.log('⚛️ Creating React modules and chapters...');

  const reactMod1 = await prisma.module.create({
    data: {
      title: 'React Introduction',
      description: 'Intro to React.',
      slug: 'react-introduction',
      type: 'TEXT',
      orderIndex: 1,
      price: 0,
      isFree: true,
      isPublished: true,
      publishStatus: 'PUBLISHED',
      courseId: reactCourse.id
    }
  });

  const reactCh1 = await prisma.chapter.create({
    data: {
      title: 'What is React?',
      description: 'React overview.',
      content: '<h2>Welcome to React!</h2>',
      order: 1,
      type: 'TEXT',
      publishStatus: 'PUBLISHED',
      duration: 600,
      moduleId: reactMod1.id
    }
  });

  const reactMod2 = await prisma.module.create({
    data: {
      title: 'React Environment Setup',
      description: 'Tooling and setup.',
      slug: 'react-setup',
      type: 'VIDEO',
      orderIndex: 2,
      price: 49.99,
      isFree: false,
      isPublished: true,
      publishStatus: 'PUBLISHED',
      courseId: reactCourse.id
    }
  });

  const reactCh3 = await prisma.chapter.create({
    data: {
      title: 'Setting Up Create React App',
      description: 'Create first React project.',
      content: '<h2>Your First React Project</h2>',
      videoUrl: 'https://sample-videos.com/video123/mp4/720/big_buck_bunny_720p_1mb.mp4',
      order: 1,
      type: 'VIDEO',
      publishStatus: 'PUBLISHED',
      duration: 1500,
      moduleId: reactMod2.id
    }
  });

  console.log('✅ React modules & chapters created');

  // -------------------------
  // NOTES / MATERIALS
  // -------------------------
  console.log('📄 Creating notes and downloadable materials...');

  await prisma.note.create({
    data: {
      title: 'Python Cheat Sheet',
      slug: 'python-cheat-sheet',
      description: 'Reference for Python.',
      content: 'Complete Python reference with examples.',
      fileUrl: 'https://example.com/python-cheat-sheet.pdf',
      fileName: 'python-cheat-sheet.pdf',
      fileSize: '2.5 MB',
      fileType: 'application/pdf',
      isPublished: true,
      orderIndex: 1,
      courseId: pythonCourse.id,
      moduleId: pythonMod1.id
    }
  });

  await prisma.note.create({
    data: {
      title: 'React Hooks Reference',
      slug: 'react-hooks-reference',
      description: 'Guide to React hooks.',
      content: 'Comprehensive hooks documentation.',
      fileUrl: 'https://example.com/react-hooks-guide.pdf',
      fileName: 'react-hooks-guide.pdf',
      fileSize: '3.2 MB',
      fileType: 'application/pdf',
      isPublished: true,
      orderIndex: 1,
      courseId: reactCourse.id,
      moduleId: reactMod1.id
    }
  });

  console.log('✅ Notes/materials created');

  // -------------------------
  // ENROLLMENTS & MODULE ENROLLMENTS
  // -------------------------
  console.log('👥 Creating enrollments & module purchases...');

  const pythonEnrollment = await prisma.enrollment.create({
    data: {
      userId: userJohn.id,
      courseId: pythonCourse.id,
      progress: 45.0,
      paymentTransactionId: null
    }
  });

  const reactEnrollment = await prisma.enrollment.create({
    data: {
      userId: userTest.id,
      courseId: reactCourse.id,
      progress: 25.0,
      paymentTransactionId: 'txn_react_001'
    }
  });

  await prisma.moduleEnrollment.create({
    data: {
      userId: userJohn.id,
      moduleId: reactMod1.id,
      progress: 100.0,
      completed: true,
      purchasePrice: 0,
      paymentTransactionId: null
    }
  });

  await prisma.moduleEnrollment.create({
    data: {
      userId: userTest.id,
      moduleId: reactMod2.id,
      progress: 60.0,
      completed: false,
      purchasePrice: 49.99,
      paymentTransactionId: 'txn_module_001'
    }
  });

  console.log('✅ Enrollments & module enrollments created');

  // -------------------------
  // CHAPTER PROGRESS
  // -------------------------
  console.log('📊 Creating chapter progress records...');

  await prisma.chapterProgress.createMany({
    data: [
      {
        userId: userJohn.id,
        chapterId: pythonCh1.id,
        isCompleted: true,
        watchTime: 600,
        completionPercentage: 100.0,
        completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
      },
      {
        userId: userJohn.id,
        chapterId: pythonCh2.id,
        isCompleted: true,
        watchTime: 900,
        completionPercentage: 100.0,
        completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
      },
      {
        userId: userJohn.id,
        chapterId: pythonCh3.id,
        isCompleted: false,
        watchTime: 200,
        completionPercentage: 44.0
      },
      {
        userId: userTest.id,
        chapterId: reactCh1.id,
        isCompleted: true,
        watchTime: 600,
        completionPercentage: 100.0,
        completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
      }
    ]
  });

  console.log('✅ Chapter progress created');

  // -------------------------
  // BUNDLES (course bundles + module bundles) + COURSE BUNDLE ITEMS
  // -------------------------
  console.log('📦 Creating bundles (course & module bundles)...');

  const webDevBundle = await prisma.bundle.create({
    data: {
      name: 'Web Development Complete Bundle',
      description: 'Master React + Full Stack in one bundle',
      userId: adminUser.id,
      totalPrice: (reactCourse.price || 199.99) + (fullStackCourse.price || 399.99),
      discount: 25,
      finalPrice: 449.99,
      type: 'COURSE',
      isActive: true,
      isFeatured: true,
      isPopular: true,
      isPublic: true,
      salesCount: 15,
      revenue: 6749.85,
      viewCount: 245
    }
  });

  await prisma.courseBundleItem.create({
    data: { bundleId: webDevBundle.id, courseId: reactCourse.id }
  });
  await prisma.courseBundleItem.create({
    data: { bundleId: webDevBundle.id, courseId: fullStackCourse.id }
  });

  // Module bundle (only modules)
  const starterModulesBundle = await prisma.bundle.create({
    data: {
      name: 'Starter Modules Pack',
      description: 'A selection of introductory modules.',
      userId: userJohn.id,
      totalPrice: 49.99,
      discount: 10,
      finalPrice: 44.99,
      type: 'MODULE',
      isActive: true,
      isFeatured: false,
      isPopular: false,
      isPublic: true,
      salesCount: 3,
      revenue: 134.97,
      viewCount: 42
    }
  });

  await prisma.bundleItem.create({
    data: { bundleId: starterModulesBundle.id, moduleId: reactMod1.id }
  });
  await prisma.bundleItem.create({
    data: { bundleId: starterModulesBundle.id, moduleId: pythonMod1.id }
  });

  console.log('✅ Bundles created and linked');

  // -------------------------
  // ORDERS / ORDER ITEMS (simulate purchases)
  // -------------------------
  console.log('💳 Creating test orders and order items...');

  const order1 = await prisma.order.create({
    data: {
      userId: userTest.id,
      courseId: reactCourse.id,
      price: reactCourse.price,
      status: 'COMPLETED',
      createdAt: new Date(),
      transactionId: 'txn_react_001'
    }
  });

  await prisma.orderItem.create({
    data: {
      orderId: order1.id,
      courseId: reactCourse.id,
      price: reactCourse.price
    }
  });

  // Bundle purchase (user bought webDevBundle)
  await prisma.bundlePurchase.create({
    data: {
      userId: userTest.id,
      bundleId: webDevBundle.id,
      purchasePrice: webDevBundle.finalPrice,
      transactionId: 'txn_bundle_001',
      createdAt: new Date()
    }
  });

  console.log('✅ Orders and bundle purchases created');

  // -------------------------
  // COMMENTS & REACTIONS (nested threads)
  // -------------------------
  console.log('💬 Creating comments and reactions...');

  // Root comment on Python chapter 1 by John
  const comment1 = await prisma.comment.create({
    data: {
      userId: userJohn.id,
      resourceType: 'CHAPTER',
      resourceId: pythonCh1.id,
      content: 'Great intro! Very clear explanations.',
      isDeleted: false,
      createdAt: new Date()
    }
  });

  // Reply by test user
  const reply1 = await prisma.comment.create({
    data: {
      userId: userTest.id,
      resourceType: 'CHAPTER',
      resourceId: pythonCh1.id,
      parentId: comment1.id,
      content: 'Agreed — the examples are helpful.',
      isDeleted: false,
      createdAt: new Date()
    }
  });

  // Nested reply by admin
  const reply2 = await prisma.comment.create({
    data: {
      userId: adminUser.id,
      resourceType: 'CHAPTER',
      resourceId: pythonCh1.id,
      parentId: reply1.id,
      content: 'Thanks for the feedback — I will add more exercises!',
      isDeleted: false,
      createdAt: new Date()
    }
  });

  // Another top-level comment on React chapter
  const comment2 = await prisma.comment.create({
    data: {
      userId: userTest.id,
      resourceType: 'CHAPTER',
      resourceId: reactCh1.id,
      content: 'Can you provide more advanced resources?',
      isDeleted: false,
      createdAt: new Date()
    }
  });

  // Reactions
  if (prisma.reaction) {
    await prisma.reaction.createMany({
      data: [
        { userId: userJohn.id, commentId: comment1.id, type: 'LIKE' },
        { userId: userTest.id, commentId: comment1.id, type: 'LIKE' },
        { userId: adminUser.id, commentId: reply1.id, type: 'LIKE' }
      ]
    });
  } else {
    // fallback: if reaction model does not exist, try creating like/dislike as fields on comment (if applicable)
    // (no-op if not supported)
  }

  console.log('✅ Comments and reactions created');

  // -------------------------
  // DISCOUNTS (optional - only if model exists)
  // -------------------------
  if (prisma.discount) {
    console.log('🏷️ Creating discounts (optional model exists)...');
    await prisma.discount.createMany({
      data: [
        {
          code: 'WELCOME25',
          percent: 25,
          usageLimit: 100,
          timesUsed: 5,
          expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
          minimumPurchase: 0,
          isActive: true,
          createdAt: new Date(),
          createdById: adminUser.id
        },
        {
          code: 'STUDENT10',
          percent: 10,
          usageLimit: 1000,
          timesUsed: 50,
          expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 year
          minimumPurchase: 10,
          isActive: true,
          createdAt: new Date(),
          createdById: adminUser.id
        }
      ]
    });
    console.log('✅ Discounts created');
  } else {
    console.log('ℹ️ No discount model found - skipping discount seed.');
  }

  // -------------------------
  // FINISH & SUMMARY
  // -------------------------
  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📊 Test Data Summary');
  console.log('='.repeat(50));
  console.log('👥 Users:');
  console.log(' - admin@example.com / admin123 (Admin)');
  console.log(' - user@example.com / user123 (Student)');
  console.log(' - test@example.com / test123 (Student)');
  console.log(' - banned@example.com / banned123 (Banned)');
  console.log('\n📚 Courses:');
  console.log(` - ${pythonCourse.title} (FREE) [id:${pythonCourse.id}]`);
  console.log(` - ${reactCourse.title} (MIXED) [id:${reactCourse.id}]`);
  console.log(` - ${fullStackCourse.title} (PREMIUM) [id:${fullStackCourse.id}]`);
  console.log('\n📦 Bundles:');
  console.log(` - ${webDevBundle.name} [id:${webDevBundle.id}] (Course bundle)`);
  console.log(` - ${starterModulesBundle.name} [id:${starterModulesBundle.id}] (Module bundle)`);
  console.log('\n💬 Comments: nested threads created for demo.');
  console.log('\n🔧 Useful Demo Links (local):');
  console.log(` - Free Course: http://localhost:3000/courses/${pythonCourse.id}/learn`);
  console.log(` - React Course: http://localhost:3000/courses/${reactCourse.id}/learn`);
  console.log(` - Bundle Marketplace: http://localhost:3000/shop/bundles`);
  console.log(` - My Courses (as logged-in user): http://localhost:3000/dashboard/my-courses`);
  console.log('='.repeat(50));
  console.log('🚀 Ready to test: authentication, admin dashboards, bundles, checkout flows, comments, progress tracking, and downloads.');
}

main()
  .catch((e) => {
    console.error('❌ Seeding failed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
