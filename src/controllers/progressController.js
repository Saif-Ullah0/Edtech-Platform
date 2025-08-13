// src/controllers/progressController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Get progress for a specific course
const getCourseProgress = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // Get enrollment with progress
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: userId,
        courseId: parseInt(courseId)
      },
      include: {
        course: {
          include: {
            modules: {
              include: {
                chapters: {
                  orderBy: {
                    order: 'asc'
                  }
                }
              },
              orderBy: {
                orderIndex: 'asc'
              }
            }
          }
        }
      }
    });

    if (!enrollment) {
      return res.status(404).json({ error: 'Not enrolled in this course' });
    }

    // Get module progress
    const moduleProgress = await prisma.moduleProgress.findMany({
      where: {
        enrollmentId: enrollment.id
      },
      include: {
        module: true
      }
    });

    // Get chapter progress using your existing ChapterProgress model
    const chapterProgress = await prisma.chapterProgress.findMany({
      where: {
        userId: userId,
        chapter: {
          module: {
            courseId: parseInt(courseId)
          }
        }
      },
      include: {
        chapter: {
          include: {
            module: true
          }
        }
      }
    });

    const completedModuleIds = moduleProgress
      .filter(mp => mp.isCompleted)
      .map(mp => mp.moduleId);

    const completedChapterIds = chapterProgress
      .filter(cp => cp.isCompleted)
      .map(cp => cp.chapterId);

    res.json({
      enrollmentId: enrollment.id,
      courseId: parseInt(courseId),
      overallProgress: enrollment.progress || 0,
      lastAccessed: enrollment.lastAccessed,
      moduleProgress: moduleProgress,
      chapterProgress: chapterProgress,
      completedModules: completedModuleIds,
      completedChapters: completedChapterIds
    });

  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
};

// Update chapter progress
const updateChapterProgress = async (req, res) => {
  try {
    const { courseId, chapterId, isCompleted, watchTime, completionPercentage } = req.body;
    const userId = req.user.id;

    console.log('📊 Updating chapter progress:', { 
      userId, courseId, chapterId, isCompleted, completionPercentage 
    });

    // Validate input
    if (!courseId || !chapterId) {
      return res.status(400).json({ error: 'Course ID and Chapter ID are required' });
    }

    // Get enrollment
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: userId,
        courseId: parseInt(courseId)
      }
    });

    if (!enrollment) {
      return res.status(404).json({ error: 'Not enrolled in this course' });
    }

    // Get chapter details
    const chapter = await prisma.chapter.findUnique({
      where: { id: chapterId },
      include: { module: true }
    });

    if (!chapter) {
      return res.status(404).json({ error: 'Chapter not found' });
    }

    // Determine completion (auto-complete at 90% for videos)
    let finalIsCompleted = isCompleted || false;
    let finalCompletionPercentage = completionPercentage || 0;

    if (!isCompleted && chapter.type === 'VIDEO') {
      finalIsCompleted = finalCompletionPercentage >= 90;
    }

    // Update or create chapter progress
    const chapterProgressRecord = await prisma.chapterProgress.upsert({
      where: {
        userId_chapterId: {
          userId: userId,
          chapterId: chapterId
        }
      },
      update: {
        isCompleted: finalIsCompleted,
        watchTime: watchTime || 0,
        completionPercentage: finalCompletionPercentage,
        completedAt: finalIsCompleted ? new Date() : null,
        updatedAt: new Date()
      },
      create: {
        userId: userId,
        chapterId: chapterId,
        isCompleted: finalIsCompleted,
        watchTime: watchTime || 0,
        completionPercentage: finalCompletionPercentage,
        completedAt: finalIsCompleted ? new Date() : null
      }
    });

    console.log('✅ Chapter progress updated:', chapterProgressRecord);

    // Calculate module progress based on chapter completion
    const moduleChapters = await prisma.chapter.findMany({
      where: { 
        moduleId: chapter.moduleId,
        publishStatus: 'PUBLISHED'
      },
      include: {
        chapterProgress: {
          where: { userId: userId }
        }
      }
    });

    const totalChapters = moduleChapters.length;
    const completedChapters = moduleChapters.filter(ch => 
      ch.chapterProgress.some(cp => cp.isCompleted)
    ).length;
    
    const moduleProgressPercentage = totalChapters > 0 ? (completedChapters / totalChapters) * 100 : 0;
    const isModuleCompleted = moduleProgressPercentage === 100;

    // Update module progress
    await prisma.moduleProgress.upsert({
      where: {
        enrollmentId_moduleId: {
          enrollmentId: enrollment.id,
          moduleId: chapter.moduleId
        }
      },
      update: {
        isCompleted: isModuleCompleted,
        completionPercentage: moduleProgressPercentage,
        completedAt: isModuleCompleted ? new Date() : null,
        updatedAt: new Date()
      },
      create: {
        enrollmentId: enrollment.id,
        moduleId: chapter.moduleId,
        isCompleted: isModuleCompleted,
        completionPercentage: moduleProgressPercentage,
        completedAt: isModuleCompleted ? new Date() : null
      }
    });

    console.log('✅ Module progress updated:', { moduleId: chapter.moduleId, progress: moduleProgressPercentage });

    // Calculate overall course progress
    const totalCourseModules = await prisma.module.count({
      where: { 
        courseId: parseInt(courseId),
        isPublished: true
      }
    });

    const completedCourseModules = await prisma.moduleProgress.count({
      where: {
        enrollmentId: enrollment.id,
        isCompleted: true
      }
    });

    const overallProgress = totalCourseModules > 0 ? (completedCourseModules / totalCourseModules) * 100 : 0;

    // Update enrollment progress
    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: {
        progress: parseFloat(overallProgress.toFixed(2)),
        lastAccessed: new Date()
      }
    });

    console.log('✅ Course progress updated:', { overallProgress });

    res.json({
      success: true,
      chapterId: chapterId,
      isCompleted: finalIsCompleted,
      completionPercentage: finalCompletionPercentage,
      moduleProgress: moduleProgressPercentage,
      overallProgress: parseFloat(overallProgress.toFixed(2)),
      completedChapters: completedChapters,
      totalChapters: totalChapters
    });

  } catch (error) {
    console.error('❌ Error updating chapter progress:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
};


// Update module progress (keep for backward compatibility)
const updateModuleProgress = async (req, res) => {
  try {
    const { courseId, moduleId, isCompleted } = req.body;
    const userId = req.user.id;

    // Validate input
    if (!courseId || !moduleId) {
      return res.status(400).json({ error: 'Course ID and Module ID are required' });
    }

    // Get enrollment
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: userId,
        courseId: parseInt(courseId)
      }
    });

    if (!enrollment) {
      return res.status(404).json({ error: 'Not enrolled in this course' });
    }

    // Update module progress
    await prisma.moduleProgress.upsert({
      where: {
        enrollmentId_moduleId: {
          enrollmentId: enrollment.id,
          moduleId: parseInt(moduleId)
        }
      },
      update: {
        isCompleted: isCompleted || false,
        completedAt: isCompleted ? new Date() : null,
        updatedAt: new Date()
      },
      create: {
        enrollmentId: enrollment.id,
        moduleId: parseInt(moduleId),
        isCompleted: isCompleted || false,
        completedAt: isCompleted ? new Date() : null
      }
    });

    // Recalculate overall progress
    const totalModules = await prisma.module.count({
      where: { 
        courseId: parseInt(courseId),
        publishStatus: 'PUBLISHED'
      }
    });

    const completedModules = await prisma.moduleProgress.count({
      where: {
        enrollmentId: enrollment.id,
        isCompleted: true
      }
    });

    const overallProgress = totalModules > 0 ? (completedModules / totalModules) * 100 : 0;

    // Update enrollment progress
    await prisma.enrollment.update({
      where: { id: enrollment.id },
      data: {
        progress: parseFloat(overallProgress.toFixed(2)),
        lastAccessed: new Date()
      }
    });

    res.json({
      success: true,
      moduleId: parseInt(moduleId),
      isCompleted: isCompleted || false,
      overallProgress: parseFloat(overallProgress.toFixed(2)),
      completedModules: completedModules,
      totalModules: totalModules
    });

  } catch (error) {
    console.error('❌ Error updating module progress:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
};

// Get progress for all enrolled courses
const getAllProgress = async (req, res) => {
  try {
    const userId = req.user.id;

    const enrollments = await prisma.enrollment.findMany({
      where: {
        userId: userId
      },
      include: {
        course: {
          include: {
            category: true
          }
        }
      },
      orderBy: {
        lastAccessed: 'desc'
      }
    });

    // Add progress details for each enrollment
    const enrollmentsWithProgress = await Promise.all(
      enrollments.map(async (enrollment) => {
        const completedModules = await prisma.moduleProgress.count({
          where: {
            enrollmentId: enrollment.id,
            isCompleted: true
          }
        });

        const totalModules = await prisma.module.count({
          where: {
            courseId: enrollment.courseId,
            publishStatus: 'PUBLISHED'
          }
        });

        const completedChapters = await prisma.chapterProgress.count({
          where: {
            userId: userId,
            isCompleted: true,
            chapter: {
              module: {
                courseId: enrollment.courseId
              }
            }
          }
        });

        const totalChapters = await prisma.chapter.count({
          where: {
            module: {
              courseId: enrollment.courseId,
              publishStatus: 'PUBLISHED'
            }
          }
        });

        return {
          id: enrollment.id,
          course: {
            id: enrollment.course.id,
            title: enrollment.course.title,
            description: enrollment.course.description,
            category: {
              name: enrollment.course.category?.name || 'Uncategorized'
            }
          },
          progress: enrollment.progress || 0,
          lastAccessed: enrollment.lastAccessed,
          enrolledAt: enrollment.createdAt,
          completedModules: completedModules,
          totalModules: totalModules,
          completedChapters: completedChapters,
          totalChapters: totalChapters
        };
      })
    );

    res.json(enrollmentsWithProgress);

  } catch (error) {
    console.error('❌ Error fetching all progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
};

// Reset course progress
const resetCourseProgress = async (req, res) => {
  try {
    const { courseId } = req.params;
    const userId = req.user.id;

    // Get enrollment
    const enrollment = await prisma.enrollment.findFirst({
      where: {
        userId: userId,
        courseId: parseInt(courseId)
      }
    });

    if (!enrollment) {
      return res.status(404).json({ error: 'Not enrolled in this course' });
    }

    // Delete all chapter progress for this user and course
    await prisma.chapterProgress.deleteMany({
      where: {
        userId: userId,
        chapter: {
          module: {
            courseId: parseInt(courseId)
          }
        }
      }
    });

    // Delete all module progress
    await prisma.moduleProgress.deleteMany({
      where: {
        enrollmentId: enrollment.id
      }
    });

    // Reset enrollment progress
    await prisma.enrollment.update({
      where: {
        id: enrollment.id
      },
      data: {
        progress: 0,
        lastAccessed: new Date()
      }
    });

    res.json({ success: true, message: 'Progress reset successfully' });

  } catch (error) {
    console.error('❌ Error resetting progress:', error);
    res.status(500).json({ error: 'Failed to reset progress' });
  }
};

module.exports = {
  getCourseProgress,
  updateModuleProgress,
  updateChapterProgress,
  getAllProgress,
  resetCourseProgress
};