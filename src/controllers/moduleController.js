const moduleService = require('../services/moduleService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getModules = async (req, res) => {
  const { courseId } = req.query;
  
  try {
    console.log('🔍 BACKEND Modules: Fetching modules...');
    console.log('🔍 BACKEND Modules: courseId from query:', courseId);
    
    let modules;
    
    if (courseId) {
      // Original functionality - get modules for specific course
      console.log('🔍 BACKEND Modules: Getting modules for course:', courseId);
      modules = await moduleService.getAllModulesByCourse(Number(courseId));
    } else {
      // New admin functionality - get ALL modules across all courses
      console.log('🔍 BACKEND Modules: Getting ALL modules for admin...');
      modules = await moduleService.getAllModulesForAdmin();
    }
    
    console.log('✅ BACKEND Modules: Found modules:', modules.length);
    res.status(200).json(modules);
  } catch (error) {
    console.error('❌ BACKEND Modules: Error fetching modules:', error);
    res.status(500).json({ error: 'Failed to fetch modules' });
  }
};

// In your moduleController.js, update getModuleById to show detailed errors:

const getModuleById = async (req, res) => {
  try {
    console.log('🔍 BACKEND Modules: Fetching module by ID:', req.params.id);
    console.log('🔍 BACKEND Modules: ID type:', typeof req.params.id);
    
    const module = await prisma.module.findUnique({
      where: { id: Number(req.params.id) },
      include: {
        course: {
          select: {
            id: true,
            title: true
          }
        },
        chapters: {
          select: {
            id: true,
            title: true,
            order: true,
            publishStatus: true
          },
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
    
    console.log('🔍 BACKEND Modules: Raw module data:', JSON.stringify(module, null, 2));
    
    if (!module) {
      console.log('❌ BACKEND Modules: Module not found:', req.params.id);
      return res.status(404).json({ error: 'Module not found' });
    }
    
    console.log('✅ BACKEND Modules: Module found:', module.title);
    console.log('✅ BACKEND Modules: Chapters found:', module.chapters?.length || 0);
    res.status(200).json(module);
  } catch (error) {
    console.error('❌ BACKEND Modules: Detailed error:', error);
    console.error('❌ BACKEND Modules: Error stack:', error.stack);
    console.error('❌ BACKEND Modules: Error message:', error.message);
    res.status(500).json({ error: 'Failed to fetch module', details: error.message });
  }
};

const createModule = async (req, res) => {
  try {
    console.log('🔍 BACKEND Modules: Creating new module...');
    console.log('🔍 BACKEND Modules: Request body:', req.body);
    
    // Validate required fields
    const { title, description, courseId } = req.body;
    if (!title || !description || !courseId) {
      return res.status(400).json({ 
        error: 'Title, description, and courseId are required' 
      });
    }
    
    const module = await moduleService.createModule(req.body);
    
    console.log('✅ BACKEND Modules: Module created successfully:', module);
    res.status(201).json(module);
  } catch (error) {
    console.error('❌ BACKEND Modules: Error creating module:', error);
    res.status(500).json({ error: 'Failed to create module' });
  }
};

const updateModule = async (req, res) => {
  try {
    console.log('🔍 BACKEND Modules: Updating module:', req.params.id);
    console.log('🔍 BACKEND Modules: Update data:', req.body);
    
    const module = await moduleService.updateModule(Number(req.params.id), req.body);
    
    console.log('✅ BACKEND Modules: Module updated successfully:', module);
    res.status(200).json(module);
  } catch (error) {
    console.error('❌ BACKEND Modules: Error updating module:', error);
    res.status(500).json({ error: 'Failed to update module' });
  }
};

const deleteModule = async (req, res) => {
  try {
    console.log('🔍 BACKEND Modules: Deleting module:', req.params.id);
    
    await moduleService.deleteModule(Number(req.params.id));
    
    console.log('✅ BACKEND Modules: Module deleted successfully');
    res.status(200).json({ message: 'Module deleted successfully' });
  } catch (error) {
    console.error('❌ BACKEND Modules: Error deleting module:', error);
    res.status(500).json({ error: 'Failed to delete module' });
  }
};

module.exports = {
  getModules,
  getModuleById,
  createModule,
  updateModule,
  deleteModule
};