// controllers/chapterController.js
const chapterService = require('../services/chapterService');

// Get chapters for a module (student view - only published)
const getChaptersByModule = async (req, res) => {
  try {
    const { moduleId } = req.params;
    console.log('🔍 Fetching chapters for module:', moduleId);
    
    const chapters = await chapterService.getChaptersByModuleId(moduleId);
    
    console.log('✅ Found chapters:', chapters.length);
    res.status(200).json(chapters);
  } catch (error) {
    console.error('❌ Error fetching chapters:', error);
    res.status(500).json({ error: 'Failed to fetch chapters' });
  }
};

// Get chapters for a module (admin view - all chapters)
const getChaptersByModuleForAdmin = async (req, res) => {
  try {
    const { moduleId } = req.params;
    console.log('🔍 Admin fetching chapters for module:', moduleId);
    
    const chapters = await chapterService.getChaptersByModuleIdForAdmin(moduleId);
    
    console.log('✅ Admin found chapters:', chapters.length);
    res.status(200).json(chapters);
  } catch (error) {
    console.error('❌ Error fetching chapters for admin:', error);
    res.status(500).json({ error: 'Failed to fetch chapters' });
  }
};

// Get single chapter
const getChapterById = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId;
    
    console.log('🔍 Fetching chapter:', id, 'for user:', userId);
    
    const chapter = userId 
      ? await chapterService.getChapterWithProgress(id, userId)
      : await chapterService.getChapterById(id);
    
    if (!chapter) {
      return res.status(404).json({ error: 'Chapter not found' });
    }
    
    // Check if chapter is published (for students)
    if (chapter.publishStatus !== 'PUBLISHED' && req.user?.role !== 'ADMIN') {
      return res.status(404).json({ error: 'Chapter not available' });
    }
    
    console.log('✅ Chapter found:', chapter.title);
    res.status(200).json(chapter);
  } catch (error) {
    console.error('❌ Error fetching chapter:', error);
    res.status(500).json({ error: 'Failed to fetch chapter details' });
  }
};

// Get single chapter (admin view)
const getChapterByIdForAdmin = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 Admin fetching chapter:', id);
    
    const chapter = await chapterService.getChapterByIdForAdmin(id);
    
    if (!chapter) {
      return res.status(404).json({ error: 'Chapter not found' });
    }
    
    console.log('✅ Admin chapter found:', chapter.title);
    res.status(200).json(chapter);
  } catch (error) {
    console.error('❌ Error fetching chapter for admin:', error);
    res.status(500).json({ error: 'Failed to fetch chapter details' });
  }
};

// Create new chapter (admin only)
const createChapter = async (req, res) => {
  try {
    const { moduleId, title, description, content, videoUrl, type, order, publishStatus } = req.body;

    console.log('🔍 Creating chapter:', { moduleId, title, type });

    if (!moduleId || !title || !type) {
      return res.status(400).json({ 
        error: 'Module ID, title, and type are required' 
      });
    }

    // Validate type
    const validTypes = ['TEXT', 'VIDEO', 'PDF', 'QUIZ'];
    if (!validTypes.includes(type)) {
      return res.status(400).json({ 
        error: 'Invalid chapter type. Must be: TEXT, VIDEO, PDF, or QUIZ' 
      });
    }

    const chapterData = {
      moduleId,
      title,
      description,
      content,
      videoUrl,
      type,
      order: order || 1,
      publishStatus: publishStatus || 'DRAFT' // Default to draft
    };

    const chapter = await chapterService.createChapter(chapterData);
    
    console.log('✅ Chapter created:', chapter.id);
    res.status(201).json({ chapter });
  } catch (error) {
    console.error('❌ Error creating chapter:', error);
    res.status(500).json({ error: 'Failed to create chapter' });
  }
};

// Update chapter (admin only)
const updateChapter = async (req, res) => {
  try {
    const { id } = req.params;
    const updateData = req.body;
    
    console.log('🔍 Updating chapter:', id);

    // Validate type if provided
    if (updateData.type) {
      const validTypes = ['TEXT', 'VIDEO', 'PDF', 'QUIZ'];
      if (!validTypes.includes(updateData.type)) {
        return res.status(400).json({ 
          error: 'Invalid chapter type. Must be: TEXT, VIDEO, PDF, or QUIZ' 
        });
      }
    }

    const updatedChapter = await chapterService.updateChapter(id, updateData);
    
    console.log('✅ Chapter updated:', updatedChapter.id);
    res.status(200).json(updatedChapter);
  } catch (error) {
    console.error('❌ Error updating chapter:', error);
    res.status(500).json({ error: 'Failed to update chapter' });
  }
};

// Delete chapter (admin only)
const deleteChapter = async (req, res) => {
  try {
    const { id } = req.params;
    console.log('🔍 Deleting chapter:', id);
    
    await chapterService.deleteChapter(id);
    
    console.log('✅ Chapter deleted:', id);
    res.status(204).send();
  } catch (error) {
    console.error('❌ Error deleting chapter:', error);
    res.status(500).json({ error: 'Failed to delete chapter' });
  }
};

// Update chapter progress (authenticated users)
const updateChapterProgress = async (req, res) => {
  try {
    const { id } = req.params; // chapter ID
    const userId = req.user?.userId;
    const { watchTime, completionPercentage, isCompleted } = req.body;

    console.log('🔍 Updating progress for chapter:', id, 'user:', userId);

    if (!userId) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const progress = await chapterService.updateChapterProgress(id, userId, {
      watchTime,
      completionPercentage,
      isCompleted
    });

    console.log('✅ Progress updated:', progress.id);
    res.status(200).json(progress);
  } catch (error) {
    console.error('❌ Error updating chapter progress:', error);
    res.status(500).json({ error: 'Failed to update progress' });
  }
};

// Get all chapters for a course (useful for course overview)
const getChaptersByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    console.log('🔍 Fetching all chapters for course:', courseId);
    
    const chapters = await chapterService.getChaptersByCourseId(courseId);
    
    console.log('✅ Found chapters for course:', chapters.length);
    res.status(200).json(chapters);
  } catch (error) {
    console.error('❌ Error fetching chapters by course:', error);
    res.status(500).json({ error: 'Failed to fetch course chapters' });
  }
};

module.exports = {
  getChaptersByModule,
  getChaptersByModuleForAdmin,
  getChapterById,
  getChapterByIdForAdmin,
  createChapter,
  updateChapter,
  deleteChapter,
  updateChapterProgress,
  getChaptersByCourse
};