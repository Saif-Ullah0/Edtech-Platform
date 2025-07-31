// scripts/migrateToChapters.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function migrateModulesToChapters() {
  console.log('🚀 Starting migration from Modules to Chapters...');
  
  try {
    // Get all modules to check what content exists
    const allModules = await prisma.module.findMany({
      select: {
        id: true,
        title: true,
        content: true,
        videoUrl: true,
        videoSize: true,
        videoDuration: true,
        thumbnailUrl: true,
        type: true,
        orderIndex: true
      }
    });

    console.log(`📊 Found ${allModules.length} total modules`);

    // Filter modules that have content
    const modulesWithContent = allModules.filter(module => 
      module.content || module.videoUrl
    );

    console.log(`📊 Found ${modulesWithContent.length} modules with content to migrate`);
    console.log(`📊 Found ${allModules.length - modulesWithContent.length} modules without content (will remain as containers)`);

    if (modulesWithContent.length === 0) {
      console.log('✅ No content to migrate - all modules are already containers');
      return;
    }

    // Migrate each module with content
    for (const module of modulesWithContent) {
      console.log(`\n🔄 Processing module: ${module.title} (ID: ${module.id})`);
      
      // Determine chapter type
      let chapterType = 'TEXT';
      if (module.videoUrl) {
        chapterType = 'VIDEO';
      } else if (module.type === 'PDF') {
        chapterType = 'PDF';
      } else if (module.type === 'QUIZ') {
        chapterType = 'QUIZ';
      }

      // Create chapter from module content
      const chapterData = {
        title: `${module.title} - Content`, // Distinguish from module title
        description: `Content migrated from module: ${module.title}`,
        content: module.content,
        videoUrl: module.videoUrl,
        videoSize: module.videoSize,
        videoDuration: module.videoDuration,
        thumbnailUrl: module.thumbnailUrl,
        duration: module.videoDuration || 0,
        order: 1, // First (and likely only) chapter in the module
        type: chapterType,
        publishStatus: 'PUBLISHED', // Keep existing content published
        moduleId: module.id
      };

      try {
        const chapter = await prisma.chapter.create({
          data: chapterData
        });

        console.log(`  ✅ Created chapter: "${chapter.title}" (Type: ${chapterType})`);
      } catch (chapterError) {
        console.error(`  ❌ Failed to create chapter for module ${module.id}:`, chapterError.message);
      }
    }

    console.log('\n🎉 Content migration completed!');
    
    // Show summary
    const newChapters = await prisma.chapter.count();
    console.log(`📊 Total chapters created: ${newChapters}`);

    // Ask user before clearing module content fields
    console.log('\n🤔 Do you want to clear the content fields from modules now?');
    console.log('   This will remove content, videoUrl, videoSize, etc. from Module table');
    console.log('   (The content is now safe in the Chapter table)');
    console.log('\n   To clear fields, run: node scripts/clearModuleContent.js');
    
  } catch (error) {
    console.error('❌ Migration failed:', error);
    console.error('Stack trace:', error.stack);
  } finally {
    await prisma.$disconnect();
  }
}

// Helper function to show migration status
async function showMigrationStatus() {
  try {
    const modulesWithContent = await prisma.module.count({
      where: {
        OR: [
          { content: { not: null } },
          { videoUrl: { not: null } }
        ]
      }
    });

    const totalChapters = await prisma.chapter.count();
    const totalModules = await prisma.module.count();

    console.log('\n📊 MIGRATION STATUS:');
    console.log(`   Total modules: ${totalModules}`);
    console.log(`   Modules with content: ${modulesWithContent}`);
    console.log(`   Total chapters: ${totalChapters}`);
    
    if (modulesWithContent > 0 && totalChapters === 0) {
      console.log('   Status: ⚠️  Migration needed');
    } else if (modulesWithContent > 0 && totalChapters > 0) {
      console.log('   Status: ⚠️  Partial migration (modules still have content)');
    } else if (totalChapters > 0) {
      console.log('   Status: ✅ Migration completed');
    } else {
      console.log('   Status: ✅ No content to migrate');
    }
  } catch (error) {
    console.error('Error checking migration status:', error);
  }
}

// Run migration
if (require.main === module) {
  // Check if --status flag is provided
  if (process.argv.includes('--status')) {
    showMigrationStatus();
  } else {
    migrateModulesToChapters();
  }
}

module.exports = { migrateModulesToChapters, showMigrationStatus };