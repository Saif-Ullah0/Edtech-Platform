// backend/services/moduleService.js - PERFECT for your schema
const prisma = require('../../prisma/client');

// Your existing method - keep as is
const getAllModulesByCourse = async (courseId) => {
  return await prisma.module.findMany({
    where: { courseId },
    include: {
      course: true
    }
  });
};

// PERFECT method for admin - uses your exact schema
const getAllModulesForAdmin = async () => {
  try {
    console.log('🔍 MODULE SERVICE: Getting all modules for admin...');
    
    const modules = await prisma.module.findMany({
      select: {
        id: true,
        title: true,
        content: true,
        courseId: true,
        course: {
          select: {
            id: true,
            title: true,
            category: {
              select: {
                name: true
              }
            }
          }
        }
      },
      orderBy: {
        id: 'desc'  // Order by ID since no createdAt
      }
    });

    console.log('✅ MODULE SERVICE: Found modules:', modules.length);
    
    // Transform to match frontend expectations
    const transformedModules = modules.map(module => ({
      id: module.id,
      title: module.title,
      slug: module.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      description: module.content, // Map content to description
      order: 1, // Default since your schema doesn't have order
      isPublished: true, // Default since your schema doesn't have isPublished
      createdAt: new Date().toISOString(), // Default since no createdAt
      course: module.course,
      _count: {
        lessons: 0 // Default since no lessons relation
      }
    }));

    return transformedModules;
    
  } catch (error) {
    console.error('❌ MODULE SERVICE: Error in getAllModulesForAdmin:', error);
    throw error;
  }
};

// Your existing method - keep as is  
const getModuleById = async (id) => {
  return await prisma.module.findUnique({
    where: { id },
    include: {
      course: {
        include: {
          category: true
        }
      }
    }
  });
};

// PERFECT createModule for your schema
const createModule = async (data) => {
  try {
    console.log('🔍 MODULE SERVICE: Creating module with data:', data);
    
    const { title, description, courseId } = data;
    
    // Validate required fields
    if (!title || !description || !courseId) {
      throw new Error('Title, description, and courseId are required');
    }
    
    const module = await prisma.module.create({
      data: {
        title,
        content: description, // Map description to content
        courseId: parseInt(courseId)
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            category: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    console.log('✅ MODULE SERVICE: Module created:', module);

    // Transform response to match frontend expectations
    return {
      id: module.id,
      title: module.title,
      slug: module.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      description: module.content,
      order: 1,
      isPublished: true,
      createdAt: new Date().toISOString(),
      course: module.course,
      _count: {
        lessons: 0
      }
    };
    
  } catch (error) {
    console.error('❌ MODULE SERVICE: Error creating module:', error);
    throw error;
  }
};

// PERFECT updateModule for your schema
const updateModule = async (id, data) => {
  try {
    console.log('🔍 MODULE SERVICE: Updating module:', id, 'with data:', data);
    
    const { title, description, courseId } = data;
    
    const updateData = {};
    if (title) updateData.title = title;
    if (description) updateData.content = description; // Map description to content
    if (courseId) updateData.courseId = parseInt(courseId);
    
    const module = await prisma.module.update({
      where: { id },
      data: updateData,
      include: {
        course: {
          select: {
            id: true,
            title: true,
            category: {
              select: {
                name: true
              }
            }
          }
        }
      }
    });

    console.log('✅ MODULE SERVICE: Module updated:', module);

    // Transform response to match frontend expectations
    return {
      id: module.id,
      title: module.title,
      slug: module.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, ''),
      description: module.content,
      order: 1,
      isPublished: true,
      createdAt: new Date().toISOString(),
      course: module.course,
      _count: {
        lessons: 0
      }
    };
    
  } catch (error) {
    console.error('❌ MODULE SERVICE: Error updating module:', error);
    throw error;
  }
};

// Your existing method - keep as is
const deleteModule = async (id) => {
  return await prisma.module.delete({
    where: { id }
  });
};

module.exports = {
  getAllModulesByCourse,      // Your existing method
  getAllModulesForAdmin,      // PERFECT method for admin
  getModuleById,
  createModule,
  updateModule,
  deleteModule
};