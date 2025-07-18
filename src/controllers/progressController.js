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

    const completedModuleIds = moduleProgress
      .filter(mp => mp.isCompleted)
      .map(mp => mp.moduleId);

    res.json({
      enrollmentId: enrollment.id,
      courseId: parseInt(courseId),
      overallProgress: enrollment.progress || 0,
      lastAccessed: enrollment.lastAccessed,
      moduleProgress: moduleProgress,
      completedModules: completedModuleIds
    });

  } catch (error) {
    console.error('Error fetching progress:', error);
    res.status(500).json({ error: 'Failed to fetch progress' });
  }
};

// Update module progress
const updateModuleProgress = async (req, res) => {
  try {
    const { courseId, moduleId, isCompleted, watchTime, completionPercentage } = req.body;
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

    // Update or create module progress
    const moduleProgress = await prisma.moduleProgress.upsert({
      where: {
        enrollmentId_moduleId: {
          enrollmentId: enrollment.id,
          moduleId: parseInt(moduleId)
        }
      },
      update: {
        isCompleted: isCompleted || false,
        watchTime: watchTime || 0,
        completionPercentage: completionPercentage || 0,
        completedAt: isCompleted ? new Date() : null
      },
      create: {
        enrollmentId: enrollment.id,
        moduleId: parseInt(moduleId),
        isCompleted: isCompleted || false,
        watchTime: watchTime || 0,
        completionPercentage: completionPercentage || 0,
        completedAt: isCompleted ? new Date() : null
      }
    });

    // Calculate overall course progress
    const totalModules = await prisma.module.count({
      where: {
        courseId: parseInt(courseId)
      }
    });

    const completedModules = await prisma.moduleProgress.count({
      where: {
        enrollmentId: enrollment.id,
        isCompleted: true,
        module: {
          courseId: parseInt(courseId)
        }
      }
    });

    const overallProgress = totalModules > 0 ? (completedModules / totalModules) * 100 : 0;

    // Update enrollment progress and last accessed
    await prisma.enrollment.update({
      where: {
        id: enrollment.id
      },
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
    console.error('Error updating progress:', error);
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
            courseId: enrollment.courseId
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
          totalModules: totalModules
        };
      })
    );

    res.json(enrollmentsWithProgress);

  } catch (error) {
    console.error('Error fetching all progress:', error);
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
    console.error('Error resetting progress:', error);
    res.status(500).json({ error: 'Failed to reset progress' });
  }
};

module.exports = {
  getCourseProgress,
  updateModuleProgress,
  getAllProgress,
  resetCourseProgress
};