// src/controllers/notesController.js
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

// Helper function to delete file
const deleteFile = (filePath) => {
  if (filePath && fs.existsSync(filePath)) {
    fs.unlinkSync(filePath);
  }
};

// Create note with file upload
const createNote = async (req, res) => {
  try {
    const { title, description, content, courseId, moduleId, orderIndex } = req.body;
    
    // Generate slug from title
    const slug = title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    
    // Prepare note data
    const noteData = {
      title,
      slug,
      description: description || '',
      content: content || '',
      courseId: parseInt(courseId),
      orderIndex: parseInt(orderIndex) || 0
    };
    
    // Add module if provided
    if (moduleId) {
      noteData.moduleId = parseInt(moduleId);
    }
    
    // Handle file upload
    if (req.file) {
      noteData.fileUrl = `/api/notes/download/${req.file.filename}`;
      noteData.fileName = req.file.originalname;
      noteData.fileSize = req.file.size.toString();
      noteData.fileType = path.extname(req.file.originalname).toLowerCase().slice(1);
    }
    
    const note = await prisma.note.create({
      data: noteData,
      include: {
        course: { select: { title: true } },
        module: { select: { title: true } }
      }
    });
    
    res.status(201).json({
      success: true,
      message: 'Note created successfully',
      note
    });
  } catch (error) {
    // Clean up uploaded file if database operation fails
    if (req.file) {
      deleteFile(req.file.path);
    }
    
    console.error('Create note error:', error);
    res.status(500).json({ error: 'Failed to create note' });
  }
};

// Get all notes
const getAllNotes = async (req, res) => {
  try {
    const notes = await prisma.note.findMany({
      where: { isDeleted: false },
      include: {
        course: { select: { title: true } },
        module: { select: { title: true } }
      },
      orderBy: [
        { courseId: 'asc' },
        { orderIndex: 'asc' },
        { createdAt: 'desc' }
      ]
    });
    
    res.json(notes);
  } catch (error) {
    console.error('Get notes error:', error);
    res.status(500).json({ error: 'Failed to fetch notes' });
  }
};

// Get notes by course
const getNotesByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    
    const notes = await prisma.note.findMany({
      where: { 
        courseId: parseInt(courseId),
        isDeleted: false,
        isPublished: true
      },
      include: {
        module: { select: { title: true } }
      },
      orderBy: [
        { orderIndex: 'asc' },
        { createdAt: 'desc' }
      ]
    });
    
    res.json(notes);
  } catch (error) {
    console.error('Get course notes error:', error);
    res.status(500).json({ error: 'Failed to fetch course notes' });
  }
};

// Get notes by module
const getNotesByModule = async (req, res) => {
  try {
    const { moduleId } = req.params;
    
    const notes = await prisma.note.findMany({
      where: { 
        moduleId: parseInt(moduleId),
        isDeleted: false,
        isPublished: true
      },
      orderBy: [
        { orderIndex: 'asc' },
        { createdAt: 'desc' }
      ]
    });
    
    res.json(notes);
  } catch (error) {
    console.error('Get module notes error:', error);
    res.status(500).json({ error: 'Failed to fetch module notes' });
  }
};

// Update note
const updateNote = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, content, courseId, moduleId, orderIndex, isPublished } = req.body;
    
    // Get existing note
    const existingNote = await prisma.note.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!existingNote) {
      if (req.file) {
        deleteFile(req.file.path);
      }
      return res.status(404).json({ error: 'Note not found' });
    }
    
    // Prepare update data
    const updateData = {
      title,
      description: description || '',
      content: content || '',
      courseId: parseInt(courseId),
      orderIndex: parseInt(orderIndex) || 0,
      isPublished: isPublished === 'true'
    };
    
    // Add module if provided
    if (moduleId) {
      updateData.moduleId = parseInt(moduleId);
    } else {
      updateData.moduleId = null;
    }
    
    // Handle new file upload
    if (req.file) {
      // Delete old file
      if (existingNote.fileUrl) {
        const oldFileName = existingNote.fileUrl.split('/').pop();
        const oldFilePath = path.join(__dirname, '../../uploads/notes', oldFileName);
        deleteFile(oldFilePath);
      }
      
      // Set new file data
      updateData.fileUrl = `/api/notes/download/${req.file.filename}`;
      updateData.fileName = req.file.originalname;
      updateData.fileSize = req.file.size.toString();
      updateData.fileType = path.extname(req.file.originalname).toLowerCase().slice(1);
    }
    
    const updatedNote = await prisma.note.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        course: { select: { title: true } },
        module: { select: { title: true } }
      }
    });
    
    res.json({
      success: true,
      message: 'Note updated successfully',
      note: updatedNote
    });
  } catch (error) {
    // Clean up uploaded file if database operation fails
    if (req.file) {
      deleteFile(req.file.path);
    }
    
    console.error('Update note error:', error);
    res.status(500).json({ error: 'Failed to update note' });
  }
};

// Delete note
const deleteNote = async (req, res) => {
  try {
    const { id } = req.params;
    
    const note = await prisma.note.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!note) {
      return res.status(404).json({ error: 'Note not found' });
    }
    
    // Delete file if exists
    if (note.fileUrl) {
      const fileName = note.fileUrl.split('/').pop();
      const filePath = path.join(__dirname, '../../uploads/notes', fileName);
      deleteFile(filePath);
    }
    
    // Soft delete the note
    await prisma.note.update({
      where: { id: parseInt(id) },
      data: { isDeleted: true }
    });
    
    res.json({
      success: true,
      message: 'Note deleted successfully'
    });
  } catch (error) {
    console.error('Delete note error:', error);
    res.status(500).json({ error: 'Failed to delete note' });
  }
};

// Download note file
const downloadNote = async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../../uploads/notes', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Get note info for download tracking
    const note = await prisma.note.findFirst({
      where: { fileUrl: { endsWith: filename } }
    });
    
    if (note) {
      // Increment download count
      await prisma.note.update({
        where: { id: note.id },
        data: { downloadCount: { increment: 1 } }
      });
    }
    
    // Set appropriate headers
    const ext = path.extname(filename).toLowerCase();
    const mimeTypes = {
      '.pdf': 'application/pdf',
      '.doc': 'application/msword',
      '.docx': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      '.txt': 'text/plain',
      '.ppt': 'application/vnd.ms-powerpoint',
      '.pptx': 'application/vnd.openxmlformats-officedocument.presentationml.presentation'
    };
    
    const mimeType = mimeTypes[ext] || 'application/octet-stream';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', `attachment; filename="${note?.fileName || filename}"`);
    
    res.sendFile(filePath);
  } catch (error) {
    console.error('Download note error:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
};

// View note file (for PDFs in browser)
const viewNote = async (req, res) => {
  try {
    const { filename } = req.params;
    const filePath = path.join(__dirname, '../../uploads/notes', filename);
    
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    const ext = path.extname(filename).toLowerCase();
    
    // Only allow viewing of PDFs and text files
    if (!['.pdf', '.txt'].includes(ext)) {
      return res.status(400).json({ error: 'File type not supported for viewing' });
    }
    
    const mimeType = ext === '.pdf' ? 'application/pdf' : 'text/plain';
    res.setHeader('Content-Type', mimeType);
    res.setHeader('Content-Disposition', 'inline');
    
    res.sendFile(filePath);
  } catch (error) {
    console.error('View note error:', error);
    res.status(500).json({ error: 'Failed to view file' });
  }
};

module.exports = {
  createNote,
  getAllNotes,
  getNotesByCourse,
  getNotesByModule,
  updateNote,
  deleteNote,
  downloadNote,
  viewNote
};