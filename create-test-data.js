// Create this file: backend/create-test-data.js
// Run with: node create-test-data.js

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function createTestData() {
  try {
    console.log('🚀 Creating test data...');

    // 1. Create a test category
    const category = await prisma.category.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        name: 'Test Category',
        slug: 'test-category',
        description: 'Test category for comments'
      }
    });
    console.log('✅ Category created:', category.name);

    // 2. Create a test course
    const course = await prisma.course.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        title: 'Test Course for Comments',
        slug: 'test-course-comments',
        description: 'A test course to test our comment system',
        price: 0,
        categoryId: 1,
        publishStatus: 'PUBLISHED',
        isPaid: false
      }
    });
    console.log('✅ Course created:', course.title);

    // 3. Create a test note
    const note = await prisma.note.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        title: 'Test Note for Comments',
        slug: 'test-note-comments',
        description: 'A test note to test comments',
        content: 'This is test content for our comment system.',
        courseId: 1,
        isPublished: true
      }
    });
    console.log('✅ Note created:', note.title);

    // 4. Create a test video
    const video = await prisma.video.upsert({
      where: { id: 1 },
      update: {},
      create: {
        id: 1,
        title: 'Test Video for Comments',
        slug: 'test-video-comments',
        description: 'A test video to test comments',
        videoUrl: 'https://example.com/test-video.mp4',
        courseId: 1,
        isPublished: true
      }
    });
    console.log('✅ Video created:', video.title);

    console.log('\n🎉 Test data created successfully!');
    console.log('\n📝 You can now test comments on:');
    console.log('- Note ID: 1');
    console.log('- Video ID: 1');
    console.log('- Course ID: 1');

  } catch (error) {
    console.error('❌ Error creating test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

createTestData();