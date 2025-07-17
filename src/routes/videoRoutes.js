// src/routes/videoRoutes.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const { PrismaClient } = require('@prisma/client');
const router = express.Router();

const prisma = new PrismaClient();

// Import YOUR existing auth middleware
const requireAuth = require('../middlewares/requireAuth');
const requireAdmin = require('../middlewares/requireAdmin');

// Enhanced multer setup with proper file organization
// Replace the multer configuration with this fixed version:
const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => {
      let uploadPath;
      
      if (file.fieldname === 'video') {
        // For now, use a single videos directory
        uploadPath = `uploads/videos`;
      } else if (file.fieldname === 'thumbnail') {
        uploadPath = 'uploads/videos/thumbnails';
      }
      
      // Create directory if it doesn't exist
      if (!fs.existsSync(uploadPath)) {
        fs.mkdirSync(uploadPath, { recursive: true });
      }
      
      cb(null, uploadPath);
    },
    filename: (req, file, cb) => {
      const uniqueName = `${Date.now()}_${Math.round(Math.random() * 1E9)}`;
      const fileExtension = path.extname(file.originalname);
      
      let prefix = '';
      if (file.fieldname === 'thumbnail') {
        prefix = 'thumb_';
      }
      
      cb(null, `${prefix}${uniqueName}${fileExtension}`);
    }
  }),
  limits: {
    fileSize: 500 * 1024 * 1024, // 500MB limit
  }
});

// Simple test route
router.get('/test', (req, res) => {
  res.json({ 
    message: 'Video routes are working!',
    timestamp: new Date().toISOString()
  });
});

// Test authenticated route
router.get('/auth-test', requireAuth, (req, res) => {
  res.json({
    message: 'Authentication working with cookies!',
    user: req.user
  });
});

// VIDEO STREAMING ROUTE (ADD THIS!)
router.get('/stream/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    console.log(`🎬 Streaming request for video ID: ${id}`);

    // Get video module from database
    const module = await prisma.module.findUnique({
      where: { id: parseInt(id) }
    });

    if (!module || module.type !== 'VIDEO' || !module.videoUrl) {
      console.log(`❌ Video not found: ID ${id}`);
      return res.status(404).json({ error: 'Video not found' });
    }

    // Build file path - remove leading slash and convert to local path
    const videoPath = module.videoUrl.replace(/^\/uploads\//, 'uploads/');
    const fullVideoPath = path.join(process.cwd(), videoPath);
    
    console.log(`🔍 Looking for video at: ${fullVideoPath}`);

    // Check if file exists
    if (!fs.existsSync(fullVideoPath)) {
      console.log(`❌ Video file not found on disk: ${fullVideoPath}`);
      return res.status(404).json({ error: 'Video file not found on disk' });
    }

    // Get file stats
    const stat = fs.statSync(fullVideoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    console.log(`📊 Video file size: ${fileSize} bytes`);
    console.log(`🎯 Range header: ${range || 'none'}`);

    // Set content type based on file extension
    const ext = path.extname(fullVideoPath).toLowerCase();
    let contentType = 'video/mp4'; // default
    
    switch (ext) {
      case '.mp4':
        contentType = 'video/mp4';
        break;
      case '.webm':
        contentType = 'video/webm';
        break;
      case '.ogg':
        contentType = 'video/ogg';
        break;
      case '.avi':
        contentType = 'video/x-msvideo';
        break;
      case '.mov':
        contentType = 'video/quicktime';
        break;
    }

    if (range) {
      // Handle range requests for video streaming (partial content)
      console.log(`🎬 Handling range request: ${range}`);
      
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      
      const file = fs.createReadStream(fullVideoPath, { start, end });
      
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': contentType,
        'Cache-Control': 'no-cache'
      };
      
      console.log(`📤 Sending partial content: ${start}-${end}/${fileSize}`);
      res.writeHead(206, head);
      file.pipe(res);
      
    } else {
      // Send entire file
      console.log(`📤 Sending entire file: ${fileSize} bytes`);
      
      const head = {
        'Content-Length': fileSize,
        'Content-Type': contentType,
        'Accept-Ranges': 'bytes',
        'Cache-Control': 'no-cache'
      };
      
      res.writeHead(200, head);
      fs.createReadStream(fullVideoPath).pipe(res);
    }

  } catch (error) {
    console.error('❌ Error streaming video:', error);
    res.status(500).json({ 
      error: 'Failed to stream video',
      message: error.message 
    });
  }
});

// Get single video details
router.get('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const module = await prisma.module.findUnique({
      where: { id: parseInt(id) },
      include: {
        course: {
          select: {
            title: true,
            slug: true,
            id: true
          }
        }
      }
    });

    if (!module || module.type !== 'VIDEO') {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Convert BigInt to string
    const formattedModule = {
      ...module,
      videoSize: module.videoSize?.toString()
    };

    res.json({ video: formattedModule });

  } catch (error) {
    console.error('Error fetching video:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
});

// Full upload route with database integration
router.post('/upload', 
  requireAuth, 
  requireAdmin, 
  upload.fields([
    { name: 'video', maxCount: 1 },
    { name: 'thumbnail', maxCount: 1 }
  ]),
  async (req, res) => {
    try {
      console.log('Upload route reached!');
      console.log('Request body:', req.body);
      console.log('Request files:', req.files);
      
      const { title, courseId, content, orderIndex } = req.body;
      const videoFile = req.files?.video?.[0];
      const thumbnailFile = req.files?.thumbnail?.[0];
      
      // Validate required fields
      if (!title || !courseId || !videoFile) {
        return res.status(400).json({
          error: 'Missing required fields',
          message: 'Title, courseId, and video file are required'
        });
      }
      
      // Check if course exists
      const course = await prisma.course.findUnique({
        where: { id: parseInt(courseId) }
      });
      
      if (!course) {
        return res.status(404).json({
          error: 'Course not found',
          message: `Course with ID ${courseId} does not exist`
        });
      }
      
      // Generate URLs for the files
      const videoUrl = `/uploads/videos/${videoFile.filename}`;
      const thumbnailUrl = thumbnailFile ? `/uploads/videos/thumbnails/${thumbnailFile.filename}` : null;
      
      // Create video module in database
      const module = await prisma.module.create({
        data: {
          title,
          content: content || '',
          type: 'VIDEO',
          courseId: parseInt(courseId),
          orderIndex: orderIndex ? parseInt(orderIndex) : 0,
          videoUrl,
          videoSize: BigInt(videoFile.size),
          videoDuration: 0, // We'll add metadata extraction later
          thumbnailUrl
        },
        include: {
          course: {
            select: {
              title: true,
              slug: true
            }
          }
        }
      });
      
      console.log('✅ Video module created:', module.id);
      
      res.status(201).json({
        message: 'Video uploaded and saved successfully!',
        module: {
          ...module,
          videoSize: module.videoSize.toString() // Convert BigInt to string for JSON
        },
        fileInfo: {
          videoFile: {
            originalName: videoFile.originalname,
            filename: videoFile.filename,
            size: videoFile.size,
            path: videoFile.path
          },
          thumbnailFile: thumbnailFile ? {
            originalName: thumbnailFile.originalname,
            filename: thumbnailFile.filename,
            size: thumbnailFile.size,
            path: thumbnailFile.path
          } : null
        }
      });
      
    } catch (error) {
      console.error('Upload error:', error);
      
      // Clean up uploaded files on error
      if (req.files?.video?.[0]) {
        try {
          fs.unlinkSync(req.files.video[0].path);
          if (req.files?.thumbnail?.[0]) {
            fs.unlinkSync(req.files.thumbnail[0].path);
          }
        } catch (cleanupError) {
          console.error('File cleanup error:', cleanupError);
        }
      }
      
      res.status(500).json({
        error: 'Upload failed',
        message: error.message
      });
    }
  }
);

// Get videos for a course
router.get('/course/:courseId', requireAuth, async (req, res) => {
  try {
    const { courseId } = req.params;
    
    const modules = await prisma.module.findMany({
      where: {
        courseId: parseInt(courseId),
        type: 'VIDEO'
      },
      orderBy: {
        orderIndex: 'asc'
      },
      include: {
        course: {
          select: {
            title: true,
            slug: true
          }
        }
      }
    });
    
    // Convert BigInt to string for JSON serialization
    const formattedModules = modules.map(module => ({
      ...module,
      videoSize: module.videoSize?.toString()
    }));
    
    res.json({
      videos: formattedModules,
      count: formattedModules.length,
      course: modules[0]?.course || null
    });
    
  } catch (error) {
    console.error('Error fetching videos:', error);
    res.status(500).json({
      error: 'Failed to fetch videos',
      message: error.message
    });
  }
});

// Update video details
router.put('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { title, content, orderIndex } = req.body;

    const module = await prisma.module.findUnique({
      where: { id: parseInt(id) }
    });

    if (!module || module.type !== 'VIDEO') {
      return res.status(404).json({ error: 'Video not found' });
    }

    const updatedModule = await prisma.module.update({
      where: { id: parseInt(id) },
      data: {
        ...(title && { title }),
        ...(content !== undefined && { content }),
        ...(orderIndex !== undefined && { orderIndex: parseInt(orderIndex) })
      }
    });

    res.json({
      message: 'Video updated successfully',
      module: {
        ...updatedModule,
        videoSize: updatedModule.videoSize?.toString()
      }
    });

  } catch (error) {
    console.error('Error updating video:', error);
    res.status(500).json({ error: 'Failed to update video' });
  }
});

// Delete video
router.delete('/:id', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    
    const module = await prisma.module.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!module || module.type !== 'VIDEO') {
      return res.status(404).json({
        error: 'Video not found'
      });
    }
    
    // Delete from database
    await prisma.module.delete({
      where: { id: parseInt(id) }
    });
    
    // Delete physical files
    if (module.videoUrl) {
      const videoPath = module.videoUrl.replace('/uploads/', 'uploads/');
      if (fs.existsSync(videoPath)) {
        fs.unlinkSync(videoPath);
      }
    }
    
    if (module.thumbnailUrl) {
      const thumbnailPath = module.thumbnailUrl.replace('/uploads/', 'uploads/');
      if (fs.existsSync(thumbnailPath)) {
        fs.unlinkSync(thumbnailPath);
      }
    }
    
    res.json({
      message: 'Video deleted successfully'
    });
    
  } catch (error) {
    console.error('Error deleting video:', error);
    res.status(500).json({
      error: 'Failed to delete video',
      message: error.message
    });
  }
});

module.exports = router;