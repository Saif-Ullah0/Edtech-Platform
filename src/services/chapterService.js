// services/chapterService.js
const prisma = require('../../prisma/client');

// Get all chapters for a module (student view - only published)
const getChaptersByModuleId = async (moduleId) => {
  const chapters = await prisma.chapter.findMany({
    where: {
      moduleId: parseInt(moduleId),
      publishStatus: 'PUBLISHED' // Only published chapters for students
    },
    orderBy: {
      order: 'asc'
    }
  });

  // Convert BigInt fields to strings for JSON serialization
  return chapters.map(chapter => ({
    ...chapter,
    videoSize: chapter.videoSize ? chapter.videoSize.toString() : null
  }));
};

// Admin: Get all chapters (including drafts)
const getChaptersByModuleIdForAdmin = async (moduleId) => {
  const chapters = await prisma.chapter.findMany({
    where: {
      moduleId: parseInt(moduleId)
    },
    orderBy: {
      order: 'asc'
    }
  });

  // Convert BigInt fields to strings for JSON serialization
  return chapters.map(chapter => ({
    ...chapter,
    videoSize: chapter.videoSize ? chapter.videoSize.toString() : null
  }));
};

// Get single chapter
const getChapterById = async (id) => {
  const chapter = await prisma.chapter.findUnique({
    where: { id },
    include: {
      module: {
        select: {
          id: true,
          title: true,
          course: {
            select: {
              id: true,
              title: true,
              slug: true
            }
          }
        }
      }
    }
  });

  // Convert BigInt to string if needed
  if (chapter && chapter.videoSize) {
    chapter.videoSize = chapter.videoSize.toString();
  }

  return chapter;
};

// Admin: Get single chapter (including drafts)
const getChapterByIdForAdmin = async (id) => {
  return await getChapterById(id); // Same logic for now
};

// Create new chapter
const createChapter = async (data) => {
  // Convert moduleId to integer if it's a string
  const chapterData = {
    ...data,
    moduleId: parseInt(data.moduleId)
  };

  return await prisma.chapter.create({
    data: chapterData,
    include: {
      module: {
        select: {
          id: true,
          title: true
        }
      }
    }
  });
};

// Update chapter
const updateChapter = async (id, data) => {
  // If moduleId is being updated, convert to integer
  if (data.moduleId) {
    data.moduleId = parseInt(data.moduleId);
  }

  const updatedChapter = await prisma.chapter.update({
    where: { id },
    data,
    include: {
      module: {
        select: {
          id: true,
          title: true
        }
      }
    }
  });

  // Convert BigInt to string if needed
  if (updatedChapter && updatedChapter.videoSize) {
    updatedChapter.videoSize = updatedChapter.videoSize.toString();
  }

  return updatedChapter;
};

// Delete chapter
const deleteChapter = async (id) => {
  return await prisma.chapter.delete({
    where: { id }
  });
};

// Get chapter with user progress
const getChapterWithProgress = async (chapterId, userId) => {
  const chapter = await getChapterById(chapterId);
  
  if (!chapter || !userId) {
    return chapter;
  }

  const progress = await prisma.chapterProgress.findUnique({
    where: {
      userId_chapterId: {
        userId: parseInt(userId),
        chapterId: chapterId
      }
    }
  });

  return {
    ...chapter,
    progress: progress || {
      isCompleted: false,
      watchTime: 0,
      completionPercentage: 0
    }
  };
};

// Update chapter progress
const updateChapterProgress = async (chapterId, userId, progressData) => {
  const { watchTime, completionPercentage, isCompleted } = progressData;

  const progress = await prisma.chapterProgress.upsert({
    where: {
      userId_chapterId: {
        userId: parseInt(userId),
        chapterId: chapterId
      }
    },
    update: {
      watchTime: watchTime || 0,
      completionPercentage: completionPercentage || 0,
      isCompleted: isCompleted || false,
      completedAt: isCompleted ? new Date() : null
    },
    create: {
      userId: parseInt(userId),
      chapterId: chapterId,
      watchTime: watchTime || 0,
      completionPercentage: completionPercentage || 0,
      isCompleted: isCompleted || false,
      completedAt: isCompleted ? new Date() : null
    }
  });

  return progress;
};

// Get all chapters for a course (across all modules)
const getChaptersByCourseId = async (courseId) => {
  const chapters = await prisma.chapter.findMany({
    where: {
      publishStatus: 'PUBLISHED',
      module: {
        courseId: parseInt(courseId),
        isPublished: true
      }
    },
    include: {
      module: {
        select: {
          id: true,
          title: true,
          orderIndex: true
        }
      }
    },
    orderBy: [
      { module: { orderIndex: 'asc' } },
      { order: 'asc' }
    ]
  });

  // Convert BigInt fields to strings
  return chapters.map(chapter => ({
    ...chapter,
    videoSize: chapter.videoSize ? chapter.videoSize.toString() : null
  }));
};

module.exports = {
  getChaptersByModuleId,
  getChaptersByModuleIdForAdmin,
  getChapterById,
  getChapterByIdForAdmin,
  createChapter,
  updateChapter,
  deleteChapter,
  getChapterWithProgress,
  updateChapterProgress,
  getChaptersByCourseId
};