// backend/src/services/videoService.js
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');
const { 
  getVideoMetadata, 
  generateVideoUrl, 
  generateThumbnailUrl, 
  deleteVideoFiles 
} = require('../utils/videoUtils');

const prisma = new PrismaClient();

class VideoService {
  async createVideoModule({ title, courseId, content, orderIndex, videoFile, thumbnailFile }) {
    try {
      // Check if course exists
      const course = await prisma.course.findUnique({
        where: { id: courseId }
      });

      if (!course) {
        // Clean up uploaded files
        deleteVideoFiles(videoFile.path, thumbnailFile?.path);
        throw new Error('Course not found');
      }

      let videoMetadata = {};
      try {
        videoMetadata = await getVideoMetadata(videoFile.path);
      } catch (error) {
        console.warn('Could not get video metadata:', error.message);
      }

      // Generate URLs
      const videoUrl = generateVideoUrl(videoFile.path);
      const thumbnailUrl = thumbnailFile ? generateThumbnailUrl(thumbnailFile.path) : null;

      // Create module in database
      const module = await prisma.module.create({
        data: {
          title,
          content,
          type: 'VIDEO',
          courseId,
          orderIndex,
          videoUrl,
          videoSize: BigInt(videoFile.size),
          videoDuration: Math.round(videoMetadata.duration || 0),
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

      return {
        module: {
          ...module,
          videoSize: module.videoSize.toString()
        },
        metadata: videoMetadata
      };

    } catch (error) {
      // Clean up files on error
      if (videoFile) {
        deleteVideoFiles(videoFile.path, thumbnailFile?.path);
      }
      throw error;
    }
  }

  async getCourseVideos(courseId, page = 1, limit = 10) {
    const skip = (page - 1) * limit;

    const [videos, totalCount] = await Promise.all([
      prisma.module.findMany({
        where: {
          courseId,
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
        },
        skip,
        take: limit
      }),
      prisma.module.count({
        where: {
          courseId,
          type: 'VIDEO'
        }
      })
    ]);

    // Convert BigInt to string for JSON serialization
    const formattedVideos = videos.map(video => ({
      ...video,
      videoSize: video.videoSize?.toString()
    }));

    return {
      videos: formattedVideos,
      pagination: {
        currentPage: page,
        totalPages: Math.ceil(totalCount / limit),
        totalCount,
        hasNext: page < Math.ceil(totalCount / limit),
        hasPrev: page > 1
      }
    };
  }

  async getVideoById(id) {
    const module = await prisma.module.findUnique({
      where: { id },
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
      return null;
    }

    return {
      ...module,
      videoSize: module.videoSize?.toString()
    };
  }

  async updateVideo(id, updateData) {
    const module = await prisma.module.findUnique({
      where: { id }
    });

    if (!module || module.type !== 'VIDEO') {
      return null;
    }

    const updatedModule = await prisma.module.update({
      where: { id },
      data: {
        ...(updateData.title && { title: updateData.title }),
        ...(updateData.content !== undefined && { content: updateData.content }),
        ...(updateData.orderIndex !== undefined && { orderIndex: updateData.orderIndex })
      }
    });

    return {
      ...updatedModule,
      videoSize: updatedModule.videoSize?.toString()
    };
  }

  async deleteVideo(id) {
    const module = await prisma.module.findUnique({
      where: { id }
    });

    if (!module || module.type !== 'VIDEO') {
      return null;
    }

    // Delete module from database
    await prisma.module.delete({
      where: { id }
    });

    // Delete physical files
    if (module.videoUrl) {
      const videoPath = module.videoUrl.replace('/uploads/', 'uploads/');
      const thumbnailPath = module.thumbnailUrl ? 
        module.thumbnailUrl.replace('/uploads/', 'uploads/') : null;
      
      deleteVideoFiles(videoPath, thumbnailPath);
    }

    return true;
  }

  async streamVideo(id, req, res) {
    const module = await prisma.module.findUnique({
      where: { id }
    });

    if (!module || module.type !== 'VIDEO' || !module.videoUrl) {
      throw new Error('Video not found');
    }

    const videoPath = module.videoUrl.replace('/uploads/', 'uploads/');
    
    if (!fs.existsSync(videoPath)) {
      throw new Error('Video file not found on disk');
    }

    const stat = fs.statSync(videoPath);
    const fileSize = stat.size;
    const range = req.headers.range;

    if (range) {
      // Handle range requests for video streaming
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
      // Send entire file
      const head = {
        'Content-Length': fileSize,
        'Content-Type': 'video/mp4',
      };
      res.writeHead(200, head);
      fs.createReadStream(videoPath).pipe(res);
    }
  }

  async getVideoStats(courseId) {
    const stats = await prisma.module.aggregate({
      where: {
        courseId,
        type: 'VIDEO'
      },
      _count: {
        id: true
      },
      _sum: {
        videoDuration: true,
        videoSize: true
      },
      _avg: {
        videoDuration: true
      }
    });

    return {
      totalVideos: stats._count.id || 0,
      totalDuration: stats._sum.videoDuration || 0,
      totalSize: stats._sum.videoSize ? stats._sum.videoSize.toString() : '0',
      averageDuration: Math.round(stats._avg.videoDuration || 0),
      formattedTotalDuration: this.formatDuration(stats._sum.videoDuration || 0),
      formattedTotalSize: this.formatFileSize(Number(stats._sum.videoSize || 0))
    };
  }

  formatDuration(seconds) {
    if (!seconds || seconds < 0) return '0:00';
    
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    const secs = Math.floor(seconds % 60);
    
    if (hours > 0) {
      return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    } else {
      return `${minutes}:${secs.toString().padStart(2, '0')}`;
    }
  }

  formatFileSize(bytes) {
    if (!bytes || bytes === 0) return '0 B';
    
    const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }
}

module.exports = new VideoService();