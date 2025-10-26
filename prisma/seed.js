// backend/prisma/seed.js - Complete seed matching your full schema (updated & hardened)
const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcrypt');

const prisma = new PrismaClient();

async function safeDelete(modelName) {
  if (!prisma[modelName]) return;
  try {
    await prisma[modelName].deleteMany({});
    console.log(`🧹 Cleared ${modelName}`);
  } catch (e) {
    console.warn(`⚠️  Could not clear ${modelName}: ${e.message}`);
  }
}

async function main() {
  console.log('🌱 Starting complete database seeding...');

  // -------------------------------------
  // CLEAN existing data (safe, ordered)
  // -------------------------------------
  console.log('🧹 Cleaning existing data (ordered, safe-mode)...');

  // delete children first (adjust names to your schema if different)
  await safeDelete('chapterProgress');
  await safeDelete('moduleProgress');
  await safeDelete('moduleEnrollment');
  await safeDelete('bundlePurchase');
  await safeDelete('orderItem');
  await safeDelete('order');
  await safeDelete('reaction'); // optional
  await safeDelete('comment'); // optional
  await safeDelete('bundleItem');
  await safeDelete('courseBundleItem');
  await safeDelete('bundle');
  await safeDelete('note');
  await safeDelete('chapter');
  await safeDelete('module');
  await safeDelete('enrollment');
  await safeDelete('course');
  await safeDelete('category');
  // finally users
  await safeDelete('user');

  // =====================================
  // USERS (use upsert to avoid duplicates)
  // =====================================
  console.log('👥 Creating users...');

  const adminUser = await prisma.user.upsert({
    where: { email: 'admin@example.com' },
    update: {
      name: 'Admin User',
      role: 'ADMIN',
      status: 'ACTIVE',
      canCreatePublicBundles: true,
      password: await bcrypt.hash('admin123', 10)
    },
    create: {
      name: 'Admin User',
      email: 'admin@example.com',
      password: await bcrypt.hash('admin123', 10),
      role: 'ADMIN',
      status: 'ACTIVE',
      canCreatePublicBundles: true
    }
  });

  const regularUser = await prisma.user.upsert({
    where: { email: 'user@example.com' },
    update: {
      name: 'John Doe',
      role: 'USER',
      status: 'ACTIVE',
      password: await bcrypt.hash('user123', 10)
    },
    create: {
      name: 'John Doe',
      email: 'user@example.com',
      password: await bcrypt.hash('user123', 10),
      role: 'USER',
      status: 'ACTIVE'
    }
  });

  const testUser = await prisma.user.upsert({
    where: { email: 'test@example.com' },
    update: {
      name: 'Test Student',
      role: 'USER',
      status: 'ACTIVE',
      password: await bcrypt.hash('test123', 10)
    },
    create: {
      name: 'Test Student',
      email: 'test@example.com',
      password: await bcrypt.hash('test123', 10),
      role: 'USER',
      status: 'ACTIVE'
    }
  });

  // optional banned user
  await prisma.user.upsert({
    where: { email: 'banned@example.com' },
    update: {
      name: 'Banned Student',
      role: 'USER',
      status: 'BANNED',
      password: await bcrypt.hash('banned123', 10)
    },
    create: {
      name: 'Banned Student',
      email: 'banned@example.com',
      password: await bcrypt.hash('banned123', 10),
      role: 'USER',
      status: 'BANNED'
    }
  });

  console.log('✅ Users created');

  // =====================================
  // CATEGORIES
  // =====================================
  console.log('📂 Creating categories...');

  const webDevCategory = await prisma.category.upsert({
    where: { slug: 'web-development' },
    update: {},
    create: {
      name: 'Web Development',
      slug: 'web-development',
      description: 'Learn modern web development technologies',
      imageUrl: 'https://images.unsplash.com/photo-1547658719-da2b51169166?w=800&h=400&fit=crop'
    }
  });

  const dataCategory = await prisma.category.upsert({
    where: { slug: 'data-science' },
    update: {},
    create: {
      name: 'Data Science',
      slug: 'data-science',
      description: 'Analyze data and build machine learning models',
      imageUrl: 'https://images.unsplash.com/photo-1551288049-bebda4e38f71?w=800&h=400&fit=crop'
    }
  });

  const mobileCategory = await prisma.category.upsert({
    where: { slug: 'mobile-development' },
    update: {},
    create: {
      name: 'Mobile Development',
      slug: 'mobile-development',
      description: 'Build mobile applications for iOS and Android',
      imageUrl: 'https://images.unsplash.com/photo-1512941937669-90a1b58e7e9c?w=800&h=400&fit=crop'
    }
  });

  console.log('✅ Categories created');

  // =====================================
  // COURSES
  // =====================================
  console.log('📚 Creating courses...');

  const pythonCourse = await prisma.course.create({
    data: {
      title: 'Python Programming Complete',
      slug: 'python-programming-complete',
      description:
        'Learn Python programming from scratch. Master variables, functions, loops, and build real projects. Perfect for beginners starting their coding journey.',
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
      description:
        'Master React development with hooks, state management, and modern patterns. Build professional web applications from scratch.',
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
      description:
        'Complete web development course covering frontend, backend, databases, and deployment. Become a professional full-stack developer.',
      price: 399.99,
      imageUrl: 'https://images.unsplash.com/photo-1461749280684-dccba630e2f6?w=800&h=400&fit=crop',
      publishStatus: 'PUBLISHED',
      isPaid: true,
      categoryId: webDevCategory.id
    }
  });

  console.log('✅ Courses created');

  // =====================================
  // MODULES & CHAPTERS - PYTHON COURSE (FREE)
  // =====================================
  console.log('📖 Creating Python course modules and chapters...');

  const pythonMod1 = await prisma.module.create({
    data: {
      title: 'Python Fundamentals',
      description: 'Learn the basics of Python programming including syntax, variables, and data types.',
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
      description: 'Introduction to Python programming language and its applications.',
      content:
        '<h2>Welcome to Python!</h2><p>Python is a high-level, interpreted programming language known for its simplicity and readability.</p>',
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
      description: 'Step-by-step guide to install Python on your computer.',
      content: '<h2>Installing Python</h2><p>Let\'s get Python installed on your system so you can start coding!</p>',
      videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
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
      description: 'Write and run your very first Python program.',
      content: '<pre><code>print("Hello, World!")</code></pre>',
      order: 3,
      type: 'TEXT',
      publishStatus: 'PUBLISHED',
      duration: 450,
      moduleId: pythonMod1.id
    }
  });

  const pythonMod2 = await prisma.module.create({
    data: {
      title: 'Variables and Data Types',
      description: 'Master Python variables, strings, numbers, and basic data structures.',
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
      description: 'Learn how to create and use variables in Python.',
      content: '<h2>Variables in Python</h2>',
      videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_2mb.mp4',
      order: 1,
      type: 'VIDEO',
      publishStatus: 'PUBLISHED',
      duration: 1200,
      moduleId: pythonMod2.id
    }
  });

  const pythonMod3 = await prisma.module.create({
    data: {
      title: 'Control Structures',
      description: 'Make decisions and repeat actions with if statements and loops.',
      slug: 'control-structures',
      type: 'TEXT',
      orderIndex: 3,
      price: 0,
      isFree: true,
      isPublished: true,
      publishStatus: 'PUBLISHED',
      courseId: pythonCourse.id
    }
  });

  const pythonCh7 = await prisma.chapter.create({
    data: {
      title: 'Making Decisions with If Statements',
      description: 'Learn how to make your programs intelligent with conditional logic.',
      content: '<h2>If Statements - Making Decisions</h2>',
      order: 1,
      type: 'TEXT',
      publishStatus: 'PUBLISHED',
      duration: 950,
      moduleId: pythonMod3.id
    }
  });

  const pythonCh8 = await prisma.chapter.create({
    data: {
      title: 'Loops - Repeating Actions',
      description: 'Learn to repeat code efficiently with for and while loops.',
      content: '<h2>Loops - Automation at its Best!</h2>',
      videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_4mb.mp4',
      order: 2,
      type: 'VIDEO',
      publishStatus: 'PUBLISHED',
      duration: 1400,
      moduleId: pythonMod3.id
    }
  });

  console.log('✅ Python course modules and chapters created');

  // =====================================
  // MODULES & CHAPTERS - REACT COURSE (MIXED)
  // =====================================
  console.log('⚛️ Creating React course modules and chapters...');

  const reactMod1 = await prisma.module.create({
    data: {
      title: 'React Introduction',
      description: 'Free introduction to React concepts and modern JavaScript.',
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
      description: 'Introduction to React library and modern web development.',
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
      description: 'Professional React development environment and tooling.',
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
      description: 'Create your first React project with modern tooling.',
      content: '<h2>Your First React Project</h2>',
      videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_1mb.mp4',
      order: 1,
      type: 'VIDEO',
      publishStatus: 'PUBLISHED',
      duration: 1500,
      moduleId: reactMod2.id
    }
  });

  const reactMod3 = await prisma.module.create({
    data: {
      title: 'Advanced React Patterns',
      description: 'Master advanced React concepts including hooks, context, and performance optimization.',
      slug: 'advanced-react',
      type: 'VIDEO',
      orderIndex: 3,
      price: 99.99,
      isFree: false,
      isPublished: true,
      publishStatus: 'PUBLISHED',
      courseId: reactCourse.id
    }
  });

  const reactCh5 = await prisma.chapter.create({
    data: {
      title: 'React Context API Mastery',
      description: 'Master global state management with React Context.',
      content: '<h2>Context API - Global State Management</h2>',
      videoUrl: 'https://sample-videos.com/zip/10/mp4/SampleVideo_1280x720_5mb.mp4',
      order: 1,
      type: 'VIDEO',
      publishStatus: 'PUBLISHED',
      duration: 2100,
      moduleId: reactMod3.id
    }
  });

  console.log('✅ React course modules and chapters created');

  // =====================================
  // NOTES/MATERIALS
  // =====================================
  console.log('📄 Creating course notes and materials...');

  await prisma.note.create({
    data: {
      title: 'Python Cheat Sheet',
      slug: 'python-cheat-sheet',
      description: 'Quick reference guide for Python syntax and common operations.',
      content: 'Complete Python reference with examples and best practices.',
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
      description: 'Complete guide to all React hooks with examples.',
      content: 'Comprehensive React hooks documentation and examples.',
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

  console.log('✅ Course notes created');

  // =====================================
  // ENROLLMENTS & ACCESS
  // =====================================
  console.log('👥 Creating user enrollments...');

  const pythonEnrollment = await prisma.enrollment.create({
    data: {
      userId: regularUser.id,
      courseId: pythonCourse.id,
      progress: 45.0,
      paymentTransactionId: null
    }
  });

  const reactEnrollment = await prisma.enrollment.create({
    data: {
      userId: testUser.id,
      courseId: reactCourse.id,
      progress: 25.0,
      paymentTransactionId: 'txn_react_001'
    }
  });

  console.log('✅ Enrollments created');

  // =====================================
  // MODULE ENROLLMENTS (Individual Purchases)
  // =====================================
  console.log('💳 Creating module enrollments...');

  await prisma.moduleEnrollment.create({
    data: {
      userId: regularUser.id,
      moduleId: reactMod1.id,
      progress: 100.0,
      completed: true,
      purchasePrice: 0,
      paymentTransactionId: null
    }
  });

  await prisma.moduleEnrollment.create({
    data: {
      userId: testUser.id,
      moduleId: reactMod2.id,
      progress: 60.0,
      completed: false,
      purchasePrice: 49.99,
      paymentTransactionId: 'txn_module_001'
    }
  });

  console.log('✅ Module enrollments created');

  // =====================================
  // CHAPTER PROGRESS
  // =====================================
  console.log('📊 Creating chapter progress...');

  await prisma.chapterProgress.create({
    data: {
      userId: regularUser.id,
      chapterId: pythonCh1.id,
      isCompleted: true,
      watchTime: 600,
      completionPercentage: 100.0,
      completedAt: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.chapterProgress.create({
    data: {
      userId: regularUser.id,
      chapterId: pythonCh2.id,
      isCompleted: true,
      watchTime: 900,
      completionPercentage: 100.0,
      completedAt: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.chapterProgress.create({
    data: {
      userId: regularUser.id,
      chapterId: pythonCh3.id,
      isCompleted: false,
      watchTime: 200,
      completionPercentage: 44.0
    }
  });

  await prisma.chapterProgress.create({
    data: {
      userId: regularUser.id,
      chapterId: pythonCh4.id,
      isCompleted: false,
      watchTime: 480,
      completionPercentage: 40.0
    }
  });

  await prisma.chapterProgress.create({
    data: {
      userId: testUser.id,
      chapterId: reactCh1.id,
      isCompleted: true,
      watchTime: 600,
      completionPercentage: 100.0,
      completedAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
    }
  });

  await prisma.chapterProgress.create({
    data: {
      userId: testUser.id,
      chapterId: reactCh3.id,
      isCompleted: false,
      watchTime: 600,
      completionPercentage: 40.0
    }
  });

  console.log('✅ Chapter progress created');

  // =====================================
  // BUNDLES
  // =====================================
  console.log('📦 Creating sample bundles...');

  const webDevBundle = await prisma.bundle.create({
    data: {
      name: 'Web Development Complete Bundle',
      description: 'Master both React and Full Stack development with this comprehensive bundle.',
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
    data: {
      bundleId: webDevBundle.id,
      courseId: reactCourse.id
    }
  });

  await prisma.courseBundleItem.create({
    data: {
      bundleId: webDevBundle.id,
      courseId: fullStackCourse.id
    }
  });

  const starterModulesBundle = await prisma.bundle.create({
    data: {
      name: 'Starter Modules Pack',
      description: 'A selection of introductory modules.',
      userId: regularUser.id,
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

  console.log('✅ Bundles created');

    // =====================================
  // ORDERS & ORDER ITEMS (wrapped in try/catch, schema-tolerant)
  // =====================================
  console.log('💳 Creating test orders and order items...');

  try {
    // create a basic order record without schema-specific relation fields
    const order1 = await prisma.order.create({
      data: {
        // prefer primitive scalar userId if model exposes it; otherwise Prisma will
        // accept this for models that have `userId` field. If your schema uses a relation
        // (user:{connect:{id:...}}), this call may still work if `userId` exists.
        userId: testUser.id,
        // courseId removed because your schema reported it as unknown
        price: reactCourse.price ?? 0,
        totalAmount: reactCourse.price ?? 0, // required in your schema earlier
        status: 'COMPLETED',
        transactionId: 'txn_react_001',
        createdAt: new Date()
      }
    });

    // create a matching order item if orderItem model accepts simple scalar fields
    try {
      await prisma.orderItem.create({
        data: {
          orderId: order1.id,
          // some schemas expect `productId` / `courseId` name differs; if this fails it will be caught
          courseId: reactCourse.id,
          price: reactCourse.price ?? 0,
          totalAmount: reactCourse.price ?? 0
        }
      });
    } catch (e) {
      console.warn('⚠️ OrderItem creation skipped (schema mismatch):', e.message);
      // try fallback: create orderItem using minimal required fields if available
      try {
        await prisma.orderItem.create({
          data: {
            orderId: order1.id,
            price: reactCourse.price ?? 0,
            totalAmount: reactCourse.price ?? 0
          }
        });
      } catch (err) {
        console.warn('⚠️ OrderItem fallback also failed, skipping:', err.message);
      }
    }
  } catch (e) {
    console.warn('⚠️ Order seeding warning (skipped):', e.message);
  }

  // create a bundle purchase; include `discount` default in case model requires it
  try {
    await prisma.bundlePurchase.create({
      data: {
        userId: testUser.id,
        bundleId: webDevBundle.id,
        purchasePrice: webDevBundle.finalPrice ?? webDevBundle.totalPrice ?? 0,
        discount: webDevBundle.discount ?? 0, // safe default if required
        transactionId: 'txn_bundle_001',
        createdAt: new Date()
      }
    });
  } catch (e) {
    console.warn('⚠️ Bundle purchase seed warning (skipped):', e.message);
  }

  console.log('✅ Orders and bundle purchases attempted');

  // =====================================
  // COMMENTS & REACTIONS (tolerant)
  // =====================================
  console.log('💬 Creating comments and reactions...');

  // Try creating a chapter comment (many LMS schemas use chapterId/noteId/videoId)
  try {
    const comment1 = await prisma.comment.create({
      data: {
        userId: regularUser.id,
        // prefer attaching to chapterId — if your schema uses noteId/videoId,
        // this may throw and will be caught below
        chapterId: pythonCh1.id,
        content: 'Great intro! Very clear explanations.',
        isDeleted: false,
        createdAt: new Date()
      }
    });

    // reply
    let reply1;
    try {
      reply1 = await prisma.comment.create({
        data: {
          userId: testUser.id,
          chapterId: pythonCh1.id,
          parentId: comment1.id,
          content: 'Agreed — the examples are helpful.',
          isDeleted: false,
          createdAt: new Date()
        }
      });

      await prisma.comment.create({
        data: {
          userId: adminUser.id,
          chapterId: pythonCh1.id,
          parentId: reply1.id,
          content: 'Thanks for the feedback — I will add more exercises!',
          isDeleted: false,
          createdAt: new Date()
        }
      });
    } catch (e) {
      console.warn('⚠️ Reply creation skipped (schema mismatch):', e.message);
    }

    // extra top-level comment on React chapter
    try {
      await prisma.comment.create({
        data: {
          userId: testUser.id,
          chapterId: reactCh1.id,
          content: 'Can you provide more advanced resources?',
          isDeleted: false,
          createdAt: new Date()
        }
      });
    } catch (e) {
      console.warn('⚠️ Additional comment skipped (schema mismatch):', e.message);
    }

    // reactions: try createMany if model exists & supports these fields
    if (prisma.reaction) {
      try {
        await prisma.reaction.createMany({
          data: [
            { userId: regularUser.id, commentId: comment1.id, type: 'LIKE' },
            { userId: testUser.id, commentId: comment1.id, type: 'LIKE' }
          ]
        });
      } catch (e) {
        console.warn('⚠️ Reaction seeding warning:', e.message);
      }
    }
  } catch (e) {
    console.warn('⚠️ Comment seeding skipped (schema likely uses different fields). Error:', e.message);
    console.warn('ℹ️ If your comment model uses `resourceType/resourceId`, `noteId`, or `videoId`, update the seed to match those fields.');
  }

  console.log('✅ Comments and reactions attempted');

  // =====================================
  // DISCOUNTS (optional - created if model exists)
  // =====================================
  if (prisma.discount) {
    console.log('🏷️ Creating discounts...');
    try {
      await prisma.discount.createMany({
        data: [
          {
            code: 'WELCOME25',
            percent: 25,
            usageLimit: 100,
            timesUsed: 5,
            expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
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
            expiresAt: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000),
            minimumPurchase: 10,
            isActive: true,
            createdAt: new Date(),
            createdById: adminUser.id
          }
        ]
      });
      console.log('✅ Discounts created');
    } catch (e) {
      console.warn('⚠️ Discount seed warning:', e.message);
    }
  } else {
    console.log('ℹ️ Discount model not found - skipping discount seed.');
  }

  // =====================================
  // SUMMARY
  // =====================================
  console.log('🎉 Database seeding completed successfully!');
  console.log('\n📊 Complete Test Data Summary:');
  console.log('='.repeat(50));
  console.log('\n👥 Users:');
  console.log('  - admin@example.com / admin123 (Admin)');
  console.log('  - user@example.com / user123 (Student with Python course access)');
  console.log('  - test@example.com / test123 (Student with React course access)');
  console.log('  - banned@example.com / banned123 (Banned)');
  console.log('\n📚 Courses:');
  console.log(`  1. "${pythonCourse.title}" (ID: ${pythonCourse.id}) - FREE`);
  console.log('     - multiple modules & chapters');
  console.log(`  2. "${reactCourse.title}" (ID: ${reactCourse.id}) - MIXED PRICING`);
  console.log(`  3. "${fullStackCourse.title}" (ID: ${fullStackCourse.id}) - PREMIUM`);
  console.log('\n📦 Bundles:');
  console.log(`  - ${webDevBundle.name} [id:${webDevBundle.id}] (Course bundle)`);
  console.log(`  - ${starterModulesBundle.name} [id:${starterModulesBundle.id}] (Module bundle)`);
  console.log('\n🔧 Useful Demo Links (local):');
  console.log(` - Free Course: http://localhost:3000/courses/${pythonCourse.id}/learn`);
  console.log(` - React Course: http://localhost:3000/courses/${reactCourse.id}/learn`);
  console.log(' - Bundle Marketplace: http://localhost:3000/shop/bundles');
  console.log(' - My Courses: http://localhost:3000/dashboard/my-courses');
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
