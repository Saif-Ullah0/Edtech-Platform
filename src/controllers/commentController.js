// Update your backend/src/controllers/commentController.js
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const getComments = async (req, res) => {
  try {
    const { resourceType, resourceId } = req.params;
    
    if (!['VIDEO', 'NOTE'].includes(resourceType.toUpperCase())) {
      return res.status(400).json({ error: 'Invalid resource type' });
    }
    
    const id = parseInt(resourceId);
    if (isNaN(id)) {
      return res.status(400).json({ error: 'Invalid resource ID' });
    }

    // Build where clause based on resource type
    const whereClause = resourceType.toUpperCase() === 'VIDEO' 
      ? { videoId: id, isDeleted: false }
      : { noteId: id, isDeleted: false };

    const comments = await prisma.comment.findMany({
      where: whereClause,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        reactions: true
      },
      orderBy: {
        createdAt: 'desc'
      }
    });

    // Transform comments to match frontend expectations
    const userId = req.user?.userId; // Get user ID from auth middleware if available
    
    const transformedComments = comments.map(comment => {
      const userReaction = userId 
        ? comment.reactions.find(r => r.userId === userId)?.type || null
        : null;

      return {
        id: comment.id,
        content: comment.content,
        authorId: comment.userId,  // Map userId to authorId for frontend
        author: comment.user,      // Map user to author for frontend
        parentId: comment.parentId,
        resourceType: resourceType.toUpperCase(),
        resourceId: id,
        likes: comment.likesCount,
        dislikes: comment.dislikesCount,
        userReaction: userReaction,
        createdAt: comment.createdAt,
        updatedAt: comment.updatedAt
      };
    });

    // ✅ Return array directly (not wrapped in success/data)
    res.json(transformedComments);
    
  } catch (error) {
    console.error('Error fetching comments:', error);
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
};

const createComment = async (req, res) => {
  try {
    const { content, resourceType, resourceId, parentId } = req.body;
    const userId = req.user.userId;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    if (!['VIDEO', 'NOTE'].includes(resourceType)) {
      return res.status(400).json({ error: 'Invalid resource type' });
    }

    // Build create data based on resource type
    const createData = {
      content: content.trim(),
      userId: userId,
      parentId: parentId ? parseInt(parentId) : null
    };

    // Add resource-specific field
    if (resourceType === 'VIDEO') {
      createData.videoId = parseInt(resourceId);
    } else {
      createData.noteId = parseInt(resourceId);
    }

    const comment = await prisma.comment.create({
      data: createData,
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        }
      }
    });

    // Return the comment in the format expected by frontend
    const formattedComment = {
      id: comment.id,
      content: comment.content,
      authorId: comment.userId,  // Map userId to authorId for frontend
      author: comment.user,      // Map user to author for frontend
      parentId: comment.parentId,
      resourceType: resourceType,
      resourceId: parseInt(resourceId),
      likes: 0,
      dislikes: 0,
      userReaction: null,
      createdAt: comment.createdAt,
      updatedAt: comment.updatedAt
    };

    // ✅ Return comment directly (not wrapped in success/data)
    res.status(201).json(formattedComment);
    
  } catch (error) {
    console.error('Error creating comment:', error);
    res.status(500).json({ error: 'Failed to create comment' });
  }
};

const updateComment = async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);
    const { content } = req.body;
    const userId = req.user.userId;

    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Comment content is required' });
    }

    // Check if comment exists and user owns it
    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId }
    });

    if (!existingComment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (existingComment.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to edit this comment' });
    }

    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: { 
        content: content.trim(),
        isEdited: true
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true
          }
        },
        reactions: true
      }
    });

    // Get user reaction
    const userReaction = updatedComment.reactions.find(r => r.userId === userId)?.type || null;

    // Determine resource type and ID
    const resourceType = updatedComment.videoId ? 'VIDEO' : 'NOTE';
    const resourceId = updatedComment.videoId || updatedComment.noteId;

    const formattedComment = {
      id: updatedComment.id,
      content: updatedComment.content,
      authorId: updatedComment.userId,
      author: updatedComment.user,
      parentId: updatedComment.parentId,
      resourceType: resourceType,
      resourceId: resourceId,
      likes: updatedComment.likesCount,
      dislikes: updatedComment.dislikesCount,
      userReaction: userReaction,
      createdAt: updatedComment.createdAt,
      updatedAt: updatedComment.updatedAt
    };

    res.json(formattedComment);
    
  } catch (error) {
    console.error('Error updating comment:', error);
    res.status(500).json({ error: 'Failed to update comment' });
  }
};

const deleteComment = async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);
    const userId = req.user.userId;

    // Check if comment exists and user owns it
    const existingComment = await prisma.comment.findUnique({
      where: { id: commentId }
    });

    if (!existingComment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    if (existingComment.userId !== userId) {
      return res.status(403).json({ error: 'Not authorized to delete this comment' });
    }

    // Soft delete - mark as deleted instead of actually deleting
    await prisma.comment.update({
      where: { id: commentId },
      data: { isDeleted: true }
    });

    res.json({ message: 'Comment deleted successfully' });
    
  } catch (error) {
    console.error('Error deleting comment:', error);
    res.status(500).json({ error: 'Failed to delete comment' });
  }
};

const toggleReaction = async (req, res) => {
  try {
    const commentId = parseInt(req.params.id);
    const { reactionType } = req.body;
    const userId = req.user.userId;

    if (!['LIKE', 'DISLIKE'].includes(reactionType)) {
      return res.status(400).json({ error: 'Invalid reaction type' });
    }

    // Check if comment exists
    const comment = await prisma.comment.findUnique({
      where: { id: commentId }
    });

    if (!comment || comment.isDeleted) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Check if user already has a reaction
    const existingReaction = await prisma.commentReaction.findUnique({
      where: {
        userId_commentId: {
          userId,
          commentId
        }
      }
    });

    let userReaction = null;
    let likesChange = 0;
    let dislikesChange = 0;

    if (existingReaction) {
      if (existingReaction.type === reactionType) {
        // Remove reaction if same type
        await prisma.commentReaction.delete({
          where: { id: existingReaction.id }
        });
        
        // Update counters
        if (reactionType === 'LIKE') {
          likesChange = -1;
        } else {
          dislikesChange = -1;
        }
      } else {
        // Update reaction if different type
        await prisma.commentReaction.update({
          where: { id: existingReaction.id },
          data: { type: reactionType }
        });
        userReaction = reactionType;
        
        // Update counters
        if (existingReaction.type === 'LIKE' && reactionType === 'DISLIKE') {
          likesChange = -1;
          dislikesChange = 1;
        } else if (existingReaction.type === 'DISLIKE' && reactionType === 'LIKE') {
          likesChange = 1;
          dislikesChange = -1;
        }
      }
    } else {
      // Create new reaction
      await prisma.commentReaction.create({
        data: {
          userId,
          commentId,
          type: reactionType
        }
      });
      userReaction = reactionType;
      
      // Update counters
      if (reactionType === 'LIKE') {
        likesChange = 1;
      } else {
        dislikesChange = 1;
      }
    }

    // Update comment counters
    const updatedComment = await prisma.comment.update({
      where: { id: commentId },
      data: {
        likesCount: Math.max(0, comment.likesCount + likesChange),
        dislikesCount: Math.max(0, comment.dislikesCount + dislikesChange)
      }
    });

    res.json({
      likes: updatedComment.likesCount,
      dislikes: updatedComment.dislikesCount,
      userReaction
    });
    
  } catch (error) {
    console.error('Error toggling reaction:', error);
    res.status(500).json({ error: 'Failed to toggle reaction' });
  }
};

module.exports = {
  getComments,
  createComment,
  updateComment,
  deleteComment,
  toggleReaction
};