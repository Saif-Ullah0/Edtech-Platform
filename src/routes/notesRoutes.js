// src/routes/notesRoutes.js
const express = require('express');
const router = express.Router();
const {
  createNote,
  getAllNotes,
  getNotesByCourse,
  getNotesByModule,
  updateNote,
  deleteNote,
  downloadNote,
  viewNote
} = require('../controllers/notesController');
const requireAuth = require('../middlewares/requireAuth');
const { uploadSingleNote } = require('../middlewares/notesUpload');

// Admin routes (protected)
router.post('/', requireAuth, uploadSingleNote, createNote);
router.get('/admin/all', requireAuth, getAllNotes);
router.put('/:id', requireAuth, uploadSingleNote, updateNote);
router.delete('/:id', requireAuth, deleteNote);

// Public routes (for students)
router.get('/course/:courseId', getNotesByCourse);
router.get('/module/:moduleId', getNotesByModule);

// File serving routes
router.get('/download/:filename', downloadNote);
router.get('/view/:filename', viewNote);

module.exports = router;