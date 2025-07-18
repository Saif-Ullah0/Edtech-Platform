// Create a file: backend/debug/checkProgress.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function checkProgress() {
  console.log('🔍 Checking database progress data...\n');

  try {
    // Check enrollments
    const enrollments = await prisma.enrollment.findMany({
      include: {
        user: { select: { name: true, email: true } },
        course: { select: { title: true } },
        moduleProgress: {
          include: {
            module: { select: { title: true, type: true } }
          }
        }
      }
    });

    console.log('📚 ENROLLMENTS:', enrollments.length);
    enrollments.forEach(enrollment => {
      console.log(`\n👤 User: ${enrollment.user.name} (${enrollment.user.email})`);
      console.log(`📖 Course: ${enrollment.course.title}`);
      console.log(`📊 Progress: ${enrollment.progress}%`);
      console.log(`🕒 Last Accessed: ${enrollment.lastAccessed}`);
      console.log(`✅ Completed Modules: ${enrollment.moduleProgress.filter(mp => mp.isCompleted).length}`);
      
      if (enrollment.moduleProgress.length > 0) {
        console.log('   Module Progress:');
        enrollment.moduleProgress.forEach(mp => {
          console.log(`   - ${mp.module.title} (${mp.module.type}): ${mp.isCompleted ? '✅ COMPLETED' : '❌ NOT COMPLETED'} - ${mp.completionPercentage}%`);
        });
      } else {
        console.log('   ⚠️ No module progress found');
      }
    });

    // Check all module progress
    const allModuleProgress = await prisma.moduleProgress.findMany({
      include: {
        enrollment: {
          include: {
            user: { select: { email: true } },
            course: { select: { title: true } }
          }
        },
        module: { select: { title: true, type: true } }
      }
    });

    console.log(`\n🎯 TOTAL MODULE PROGRESS RECORDS: ${allModuleProgress.length}`);
    allModuleProgress.forEach(mp => {
      console.log(`- ${mp.enrollment.user.email} -> ${mp.enrollment.course.title} -> ${mp.module.title}: ${mp.isCompleted ? '✅' : '❌'} (${mp.completionPercentage}%)`);
    });

    // Check if tables exist
    const tableCheck = await prisma.$queryRaw`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' 
      AND table_name IN ('Enrollment', 'ModuleProgress')
    `;
    
    console.log('\n🗃️ DATABASE TABLES:');
    console.log(tableCheck);

  } catch (error) {
    console.error('❌ Error checking progress:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkProgress();