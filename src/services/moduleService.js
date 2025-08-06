// backend/services/moduleService.js - Updated for your new schema
const prisma = require('../../prisma/client');

// Your existing method - keep as is
const getAllModulesByCourse = async (courseId) => {
  return await prisma.module.findMany({
    where: { courseId },
    include: {
      course: true,
      chapters: true,
      _count: {
        select: {
          chapters: true
        }
      }
    },
    orderBy: {
      orderIndex: 'asc'
    }
  });
};

// Updated method for admin - matches your new schema fields
const getAllModulesForAdmin = async () => {
  try {
    console.log('🔍 MODULE SERVICE: Getting all modules for admin...');
    
    const modules = await prisma.module.findMany({
      include: {
        course: {
          include: {
            category: {
              select: {
                id: true,
                name: true
              }
            }
          }
        },
        chapters: {
          select: {
            id: true,
            title: true,
            type: true,
            publishStatus: true,
            order: true
          },
          orderBy: {
            order: 'asc'
          }
        },
        notes: {
          select: {
            id: true,
            title: true,
            isPublished: true
          }
        },
        _count: {
          select: {
            chapters: true,
            notes: true,
            moduleEnrollments: true,
            bundleItems: true
          }
        }
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    console.log('✅ MODULE SERVICE: Found modules:', modules.length);
    
    // Transform to match frontend expectations
    const transformedModules = modules.map(module => ({
      id: module.id,
      title: module.title,
      slug: module.slug || module.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      description: module.description || '',
      price: module.price || 0,
      isFree: module.isFree || false,
      isPublished: module.isPublished || false,
      publishStatus: module.publishStatus || 'DRAFT',
      orderIndex: module.orderIndex || 0,
      courseId: module.courseId,
      course: module.course,
      chapters: module.chapters,
      notes: module.notes,
      _count: module._count,
      createdAt: module.createdAt,
      updatedAt: module.updatedAt
    }));

    return transformedModules;
    
  } catch (error) {
    console.error('❌ MODULE SERVICE: Error in getAllModulesForAdmin:', error);
    throw error;
  }
};

// Your existing method - updated for new schema
const getModuleById = async (id) => {
  return await prisma.module.findUnique({
    where: { id },
    include: {
      course: {
        include: {
          category: true
        }
      },
      chapters: {
        orderBy: {
          order: 'asc'
        }
      },
      notes: true,
      _count: {
        select: {
          chapters: true
        }
      }
    }
  });
};

// Updated createModule for your new schema
const createModule = async (data) => {
  try {
    console.log('🔍 MODULE SERVICE: Creating module with data:', data);
    
    const { 
      title, 
      description, 
      courseId, 
      price = 0, 
      isFree = true,
      isPublished = false,
      publishStatus = 'DRAFT',
      chapters = [] 
    } = data;
    
    // Validate required fields
    if (!title || !courseId) {
      throw new Error('Title and courseId are required');
    }
    
    // Generate slug from title if not provided
    const slug = data.slug || title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    
    const module = await prisma.module.create({
      data: {
        title,
        description: description || '',
        slug,
        price: isFree ? 0 : parseFloat(price) || 0,
        isFree: Boolean(isFree),
        isPublished: Boolean(isPublished),
        publishStatus,
        courseId: parseInt(courseId),
        orderIndex: data.orderIndex || 0,
        chapters: {
          create: chapters.map((chapter, index) => ({
            title: chapter.title || `Chapter ${index + 1}`,
            description: chapter.description || '',
            type: chapter.type || 'TEXT',
            publishStatus: chapter.publishStatus || 'DRAFT',
            order: index
          }))
        }
      },
      include: {
        course: {
          include: {
            category: true
          }
        },
        chapters: true,
        _count: {
          select: {
            chapters: true
          }
        }
      }
    });

    console.log('✅ MODULE SERVICE: Module created:', module.id);
    return module;
    
  } catch (error) {
    console.error('❌ MODULE SERVICE: Error creating module:', error);
    throw error;
  }
};

// Updated updateModule for your new schema
const updateModule = async (id, data) => {
  try {
    console.log('🔍 MODULE SERVICE: Updating module:', id, 'with data:', data);
    
    const { 
      title, 
      description, 
      courseId, 
      price, 
      isFree, 
      isPublished,
      publishStatus 
    } = data;
    
    const updateData = {};
    if (title !== undefined) updateData.title = title;
    if (description !== undefined) updateData.description = description;
    if (courseId !== undefined) updateData.courseId = parseInt(courseId);
    if (isFree !== undefined) {
      updateData.isFree = Boolean(isFree);
      updateData.price = Boolean(isFree) ? 0 : (parseFloat(price) || 0);
    } else if (price !== undefined) {
      updateData.price = parseFloat(price) || 0;
    }
    if (isPublished !== undefined) updateData.isPublished = Boolean(isPublished);
    if (publishStatus !== undefined) updateData.publishStatus = publishStatus;
    
    // Generate new slug if title changed
    if (title) {
      updateData.slug = title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    }
    
    const module = await prisma.module.update({
      where: { id },
      data: updateData,
      include: {
        course: {
          include: {
            category: true
          }
        },
        chapters: {
          orderBy: {
            order: 'asc'
          }
        },
        _count: {
          select: {
            chapters: true
          }
        }
      }
    });

    console.log('✅ MODULE SERVICE: Module updated:', module.id);
    return module;
    
  } catch (error) {
    console.error('❌ MODULE SERVICE: Error updating module:', error);
    throw error;
  }
};

// Updated deleteModule with safety checks
const deleteModule = async (id) => {
  try {
    console.log('🔍 MODULE SERVICE: Deleting module:', id);
    
    // Check if module has enrollments or bundle items
    const moduleWithCounts = await prisma.module.findUnique({
      where: { id },
      include: {
        _count: {
          select: {
            moduleEnrollments: true,
            bundleItems: true
          }
        }
      }
    });
    
    if (!moduleWithCounts) {
      throw new Error('Module not found');
    }
    
    // Prevent deletion if module has active enrollments
    if (moduleWithCounts._count.moduleEnrollments > 0) {
      throw new Error(`Cannot delete module with ${moduleWithCounts._count.moduleEnrollments} active enrollments`);
    }
    
    // Prevent deletion if module is in bundles
    if (moduleWithCounts._count.bundleItems > 0) {
      throw new Error(`Cannot delete module that is part of ${moduleWithCounts._count.bundleItems} bundles`);
    }
    
    // Safe to delete (chapters will be cascade deleted)
    const result = await prisma.module.delete({
      where: { id }
    });
    
    console.log('✅ MODULE SERVICE: Module deleted successfully:', id);
    return result;
    
  } catch (error) {
    console.error('❌ MODULE SERVICE: Error deleting module:', error);
    throw error;
  }
};

module.exports = {
  getAllModulesByCourse,      // Your existing method
  getAllModulesForAdmin,      // Updated for new schema
  getModuleById,              // Updated for new schema
  createModule,               // Updated for new schema
  updateModule,               // Updated for new schema
  deleteModule                // Updated with safety checks
};