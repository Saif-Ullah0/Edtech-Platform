// backend/src/controllers/videoController.js
const videoService = require('../services/videoService');
const { validateVideoFile, deleteVideoFiles } = require('../utils/videoUtils');

class VideoController {
  // Upload video with optional thumbnail
  async uploadVideo(req, res) {
    try {
      const { title, courseId, content, orderIndex } = req.body;
      const videoFile = req.files?.video?.[0];
      const thumbnailFile = req.files?.thumbnail?.[0];

      // Validate required fields
      if (!title || !courseId || !videoFile) {
        return res.status(400).json({ 
          error: 'Title, courseId, and video file are required' 
        });
      }

      // Validate video file
      const validation = validateVideoFile(videoFile);
      if (!validation.isValid) {
        return res.status(400).json({ 
          error: 'Invalid video file',
          details: validation.errors 
        });
      }

      // Use service to handle the upload logic
      const result = await videoService.createVideoModule({
        title,
        courseId: parseInt(courseId),
        content: content || '',
        orderIndex: orderIndex ? parseInt(orderIndex) : 0,
        videoFile,
        thumbnailFile
      });

      res.status(201).json({
        message: 'Video uploaded successfully',
        module: result.module,
        metadata: result.metadata
      });

    } catch (error) {
      console.error('Video upload error:', error);
      
      // Clean up uploaded files on error
      if (req.files?.video?.[0]) {
        deleteVideoFiles(req.files.video[0].path, req.files?.thumbnail?.[0]?.path);
      }

      res.status(500).json({ 
        error: 'Failed to upload video',
        details: error.message 
      });
    }
  }

  // Get all videos for a course
  async getCourseVideos(req, res) {
    try {
      const { courseId } = req.params;
      const { page = 1, limit = 10 } = req.query;

      const result = await videoService.getCourseVideos(
        parseInt(courseId), 
        parseInt(page), 
        parseInt(limit)
      );

      res.json(result);

    } catch (error) {
      console.error('Error fetching course videos:', error);
      res.status(500).json({ error: 'Failed to fetch videos' });
    }
  }

  // Get single video details
  async getVideoById(req, res) {
    try {
      const { id } = req.params;
      const video = await videoService.getVideoById(parseInt(id));

      if (!video) {
        return res.status(404).json({ error: 'Video not found' });
      }

      res.json({ video });

    } catch (error) {
      console.error('Error fetching video:', error);
      res.status(500).json({ error: 'Failed to fetch video' });
    }
  }

  // Update video details
  async updateVideo(req, res) {
    try {
      const { id } = req.params;
      const { title, content, orderIndex } = req.body;

      const updatedVideo = await videoService.updateVideo(parseInt(id), {
        title,
        content,
        orderIndex: orderIndex ? parseInt(orderIndex) : undefined
      });

      if (!updatedVideo) {
        return res.status(404).json({ error: 'Video not found' });
      }

      res.json({
        message: 'Video updated successfully',
        module: updatedVideo
      });

    } catch (error) {
      console.error('Error updating video:', error);
      res.status(500).json({ error: 'Failed to update video' });
    }
  }

  // Delete video
  async deleteVideo(req, res) {
    try {
      const { id } = req.params;
      
      const result = await videoService.deleteVideo(parseInt(id));

      if (!result) {
        return res.status(404).json({ error: 'Video not found' });
      }

      res.json({ message: 'Video deleted successfully' });

    } catch (error) {
      console.error('Error deleting video:', error);
      res.status(500).json({ error: 'Failed to delete video' });
    }
  }

  // Stream video file
  async streamVideo(req, res) {
    try {
      const { id } = req.params;
      
      await videoService.streamVideo(parseInt(id), req, res);

    } catch (error) {
      console.error('Error streaming video:', error);
      res.status(500).json({ error: 'Failed to stream video' });
    }
  }

  // Get video analytics/stats
  async getVideoStats(req, res) {
    try {
      const { courseId } = req.params;
      const stats = await videoService.getVideoStats(parseInt(courseId));

      res.json({ stats });

    } catch (error) {
      console.error('Error fetching video stats:', error);
      res.status(500).json({ error: 'Failed to fetch video statistics' });
    }
  }
}

module.exports = new VideoController();