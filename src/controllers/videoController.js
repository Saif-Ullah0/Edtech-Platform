// src/controllers/videoController.js
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

// Create video with file upload
const createVideo = async (req, res) => {
  try {
    const { title, description, videoUrl, courseId, moduleId, chapterId, duration, orderIndex, isPublished } = req.body;
    
    console.log('🔍 BACKEND Videos: Creating video with data:', req.body);
    
    // Validate required fields
    if (!title || !courseId) {
      if (req.file) deleteFile(req.file.path);
      return res.status(400).json({ error: 'Title and courseId are required' });
    }

    // Must have either videoUrl or uploaded file
    if (!videoUrl && !req.file) {
      return res.status(400).json({ error: 'Either video URL or video file is required' });
    }

    // Validate chapter belongs to module if both are provided
    if (chapterId && moduleId) {
      const chapter = await prisma.chapter.findUnique({
        where: { id: chapterId },
        include: { module: true }
      });
      
      if (!chapter) {
        if (req.file) deleteFile(req.file.path);
        return res.status(400).json({ error: 'Chapter not found' });
      }
      
      if (chapter.moduleId !== parseInt(moduleId)) {
        if (req.file) deleteFile(req.file.path);
        return res.status(400).json({ error: 'Chapter does not belong to the specified module' });
      }
    }
    
    // Generate slug from title
    const slug = title.toLowerCase().replace(/[^a-z0-9]/g, '-').replace(/-+/g, '-');
    
    // Prepare video data
    const videoData = {
      title,
      slug,
      description: description || '',
      videoUrl: videoUrl || '',
      courseId: parseInt(courseId),
      orderIndex: parseInt(orderIndex) || 0,
      isPublished: isPublished === 'true' || isPublished === true,
      duration: duration ? parseInt(duration) : null
    };
    
    // Add module if provided
    if (moduleId) {
      videoData.moduleId = parseInt(moduleId);
    }
    
    // Add chapter if provided (string ID)
    if (chapterId) {
      videoData.chapterId = chapterId;
    }
    
    // Handle file upload
    if (req.file) {
      videoData.fileName = req.file.originalname;
      videoData.fileSize = req.file.size.toString();
      videoData.fileType = path.extname(req.file.originalname).toLowerCase().slice(1);
      // For uploaded files, we'd typically store them in a video streaming service
      // For now, we'll store the local path (you should implement proper video hosting)
      videoData.videoUrl = `/api/videos/stream/${req.file.filename}`;
    }
    
    const video = await prisma.video.create({
      data: videoData,
      include: {
        course: { select: { title: true } },
        module: { select: { title: true } },
        chapter: { select: { title: true } }
      }
    });
    
    console.log('✅ BACKEND Videos: Video created successfully:', video.id);
    res.status(201).json({
      success: true,
      message: 'Video created successfully',
      video
    });
  } catch (error) {
    // Clean up uploaded file if database operation fails
    if (req.file) {
      deleteFile(req.file.path);
    }
    
    console.error('❌ BACKEND Videos: Create video error:', error);
    res.status(500).json({ error: 'Failed to create video' });
  }
};

// Get all videos for admin
const getAllVideos = async (req, res) => {
  try {
    console.log('🔍 BACKEND Videos: Fetching all videos for admin...');
    
    const videos = await prisma.video.findMany({
      where: { isDeleted: false },
      include: {
        course: { select: { title: true } },
        module: { select: { title: true } },
        chapter: { select: { title: true } }
      },
      orderBy: [
        { courseId: 'asc' },
        { orderIndex: 'asc' },
        { createdAt: 'desc' }
      ]
    });
    
    console.log('✅ BACKEND Videos: Found videos:', videos.length);
    res.json(videos);
  } catch (error) {
    console.error('❌ BACKEND Videos: Get videos error:', error);
    res.status(500).json({ error: 'Failed to fetch videos' });
  }
};

// Get videos by course
const getVideosByCourse = async (req, res) => {
  try {
    const { courseId } = req.params;
    
    console.log('🔍 BACKEND Videos: Getting videos for course:', courseId);
    
    const videos = await prisma.video.findMany({
      where: { 
        courseId: parseInt(courseId),
        isDeleted: false,
        isPublished: true
      },
      include: {
        module: { select: { title: true } },
        chapter: { select: { title: true } }
      },
      orderBy: [
        { orderIndex: 'asc' },
        { createdAt: 'desc' }
      ]
    });
    
    console.log('✅ BACKEND Videos: Found course videos:', videos.length);
    res.json(videos);
  } catch (error) {
    console.error('❌ BACKEND Videos: Get course videos error:', error);
    res.status(500).json({ error: 'Failed to fetch course videos' });
  }
};

// Get videos by module
const getVideosByModule = async (req, res) => {
  try {
    const { moduleId } = req.params;
    
    console.log('🔍 BACKEND Videos: Getting videos for module:', moduleId);
    
    const videos = await prisma.video.findMany({
      where: { 
        moduleId: parseInt(moduleId),
        isDeleted: false,
        isPublished: true
      },
      include: {
        chapter: { select: { title: true } }
      },
      orderBy: [
        { orderIndex: 'asc' },
        { createdAt: 'desc' }
      ]
    });
    
    console.log('✅ BACKEND Videos: Found module videos:', videos.length);
    res.json(videos);
  } catch (error) {
    console.error('❌ BACKEND Videos: Get module videos error:', error);
    res.status(500).json({ error: 'Failed to fetch module videos' });
  }
};

// Get videos by chapter
const getVideosByChapter = async (req, res) => {
  try {
    const { chapterId } = req.params;
    
    console.log('🔍 BACKEND Videos: Getting videos for chapter:', chapterId);
    
    const videos = await prisma.video.findMany({
      where: { 
        chapterId: chapterId,
        isDeleted: false,
        isPublished: true
      },
      orderBy: [
        { orderIndex: 'asc' },
        { createdAt: 'desc' }
      ]
    });
    
    console.log('✅ BACKEND Videos: Found chapter videos:', videos.length);
    res.json(videos);
  } catch (error) {
    console.error('❌ BACKEND Videos: Get chapter videos error:', error);
    res.status(500).json({ error: 'Failed to fetch chapter videos' });
  }
};

// Update video
const updateVideo = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, description, videoUrl, courseId, moduleId, chapterId, duration, orderIndex, isPublished } = req.body;
    
    console.log('🔍 BACKEND Videos: Updating video:', id, 'with data:', req.body);
    
    // Get existing video
    const existingVideo = await prisma.video.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!existingVideo) {
      if (req.file) {
        deleteFile(req.file.path);
      }
      return res.status(404).json({ error: 'Video not found' });
    }
    
    // Validate chapter belongs to module if both are provided
    if (chapterId && moduleId) {
      const chapter = await prisma.chapter.findUnique({
        where: { id: chapterId },
        include: { module: true }
      });
      
      if (!chapter) {
        if (req.file) deleteFile(req.file.path);
        return res.status(400).json({ error: 'Chapter not found' });
      }
      
      if (chapter.moduleId !== parseInt(moduleId)) {
        if (req.file) deleteFile(req.file.path);
        return res.status(400).json({ error: 'Chapter does not belong to the specified module' });
      }
    }
    
    // Prepare update data
    const updateData = {
      title,
      description: description || '',
      videoUrl: videoUrl || '',
      courseId: parseInt(courseId),
      orderIndex: parseInt(orderIndex) || 0,
      isPublished: isPublished === 'true' || isPublished === true,
      duration: duration ? parseInt(duration) : null
    };
    
    // Handle moduleId (can be set to null)
    if (moduleId) {
      updateData.moduleId = parseInt(moduleId);
    } else {
      updateData.moduleId = null;
    }
    
    // Handle chapterId (can be set to null)
    if (chapterId) {
      updateData.chapterId = chapterId;
    } else {
      updateData.chapterId = null;
    }
    
    // Handle new file upload
    if (req.file) {
      // Delete old file if it exists and was uploaded (not external URL)
      if (existingVideo.fileName && existingVideo.videoUrl && existingVideo.videoUrl.includes('/stream/')) {
        const oldFileName = existingVideo.videoUrl.split('/').pop();
        const oldFilePath = path.join(__dirname, '../../uploads/videos', oldFileName);
        deleteFile(oldFilePath);
      }
      
      // Set new file data
      updateData.fileName = req.file.originalname;
      updateData.fileSize = req.file.size.toString();
      updateData.fileType = path.extname(req.file.originalname).toLowerCase().slice(1);
      updateData.videoUrl = `/api/videos/stream/${req.file.filename}`;
    }
    
    const updatedVideo = await prisma.video.update({
      where: { id: parseInt(id) },
      data: updateData,
      include: {
        course: { select: { title: true } },
        module: { select: { title: true } },
        chapter: { select: { title: true } }
      }
    });
    
    console.log('✅ BACKEND Videos: Video updated successfully:', updatedVideo.id);
    res.json({
      success: true,
      message: 'Video updated successfully',
      video: updatedVideo
    });
  } catch (error) {
    // Clean up uploaded file if database operation fails
    if (req.file) {
      deleteFile(req.file.path);
    }
    
    console.error('❌ BACKEND Videos: Update video error:', error);
    res.status(500).json({ error: 'Failed to update video' });
  }
};

// Delete video
const deleteVideo = async (req, res) => {
  try {
    const { id } = req.params;
    
    console.log('🔍 BACKEND Videos: Deleting video:', id);
    
    const video = await prisma.video.findUnique({
      where: { id: parseInt(id) }
    });
    
    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }
    
    // Delete file if it's an uploaded file (not external URL)
    if (video.fileName && video.videoUrl && video.videoUrl.includes('/stream/')) {
      const fileName = video.videoUrl.split('/').pop();
      const filePath = path.join(__dirname, '../../uploads/videos', fileName);
      deleteFile(filePath);
    }
    
    // Soft delete the video
    await prisma.video.update({
      where: { id: parseInt(id) },
      data: { isDeleted: true }
    });
    
    console.log('✅ BACKEND Videos: Video deleted successfully');
    res.json({
      success: true,
      message: 'Video deleted successfully'
    });
  } catch (error) {
    console.error('❌ BACKEND Videos: Delete video error:', error);
    res.status(500).json({ error: 'Failed to delete video' });
  }
};

// Stream video file (for uploaded videos)
// Update your streamVideo function in backend/src/controllers/videoController.js

const streamVideo = (req, res) => {
  try {
    const filename = req.params.filename;
    const videoPath = path.join(__dirname, '../../uploads/videos', filename);

    // Check if file exists
    if (!fs.existsSync(videoPath)) {
      return res.status(404).json({ error: 'Video file not found' });
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    // Add CORS headers for video streaming
    res.header('Access-Control-Allow-Origin', process.env.CORS_ORIGIN || 'http://localhost:3000');
    res.header('Access-Control-Allow-Credentials', 'true');
    res.header('Access-Control-Allow-Headers', 'Range');

    if (range) {
      // Support for video seeking (range requests)
      const parts = range.replace(/bytes=/, "").split("-");
      const start = parseInt(parts[0], 10);
      const end = parts[1] ? parseInt(parts[1], 10) : fileSize - 1;
      const chunksize = (end - start) + 1;
      const file = fs.createReadStream(videoPath, { start, end });
      const head = {
        'Content-Range': `bytes ${start}-${end}/${fileSize}`,
        'Accept-Ranges': 'bytes',
        'Content-Length': chunksize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(206, head);
      file.pipe(res);
    } else {
      // No range request, send entire file
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
        'Accept-Ranges': 'bytes',
      };
      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
    }
  } catch (error) {
    console.error('Error streaming video:', error);
    res.status(500).json({ error: 'Failed to stream video' });
  }
};

const getVideoById = async (req, res) => {
  try {
    const videoId = parseInt(req.params.id);
    
    if (isNaN(videoId)) {
      return res.status(400).json({ error: 'Invalid video ID' });
    }

    const video = await prisma.video.findUnique({
      where: { id: videoId },
      include: {
        course: {
          select: {
            id: true,
            title: true
          }
        },
        module: {
          select: {
            id: true,
            title: true
          }
        },
        chapter: {
          select: {
            id: true,
            title: true
          }
        }
      }
    });

    if (!video) {
      return res.status(404).json({ error: 'Video not found' });
    }

    // Only return published videos for public access
    if (!video.isPublished) {
      return res.status(404).json({ error: 'Video not found' });
    }

    res.json(video);
  } catch (error) {
    console.error('Error fetching video:', error);
    res.status(500).json({ error: 'Failed to fetch video' });
  }
};

module.exports = {
  createVideo,
  getAllVideos,
  getVideosByCourse,
  getVideosByModule,
  getVideosByChapter,
  updateVideo,
  deleteVideo,
  streamVideo,
  getVideoById
};