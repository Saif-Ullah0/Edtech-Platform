// backend/src/controllers/courseController.js
// Enhanced version with better error handling and data structure

const courseService = require('../services/courseService');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// 🆕 ENHANCED: Get single course by ID with proper data structure
// Add this to your existing courseController.js - UPDATE the getCourseById function

const getCourseById = async (req, res) => {
  try {
    console.log('🎓 Fetching course:', req.params.id);
    
    const courseId = parseInt(req.params.id);
    const userId = req.user?.id; // 🆕 NEW: Get user ID from auth middleware
    
    console.log('👤 User ID from request:', userId); // 🆕 NEW: Debug log
    
    if (isNaN(courseId)) {
      console.log('❌ Invalid course ID:', req.params.id);
      return res.status(400).json({ error: 'Invalid course ID' });
    }

    // 🆕 ENHANCED: Include videos in the course query
    const course = await prisma.course.findUnique({
      where: { 
        id: courseId,
        isDeleted: false 
      },
      include: {
        category: true,
        modules: {
          where: { isPublished: true },
          include: {
            chapters: {
              where: { publishStatus: 'PUBLISHED' },
              include: {
                // 🆕 NEW: Include videos for each chapter
                videos: {
                  where: { 
                    isDeleted: false,
                    isPublished: true 
                  },
                  select: {
                    id: true,
                    videoUrl: true,
                    fileName: true,
                    duration: true,
                    fileSize: true
                  }
                }
              },
              orderBy: { order: 'asc' }
            }
          },
          orderBy: { orderIndex: 'asc' }
        }
      }
    });
    
    if (!course || course.isDeleted) {
      console.log('❌ Course not found:', courseId);
      return res.status(404).json({ error: 'Course not found' });
    }
    
    // Check if course is published (for students)
    if (course.publishStatus !== 'PUBLISHED') {
      console.log('❌ Course not published:', courseId);
      return res.status(404).json({ error: 'Course not available' });
    }

    // 🆕 NEW: Check if user is enrolled
    let userEnrollment = null;
    if (userId) {
      console.log('🔍 Checking enrollment for user:', userId, 'in course:', courseId);
      
      userEnrollment = await prisma.enrollment.findFirst({
        where: {
          userId: userId,
          courseId: courseId
        },
        select: {
          id: true,
          progress: true,
          lastAccessed: true,
          createdAt: true
        }
      });
      
      console.log('📋 Enrollment result:', userEnrollment); // 🆕 NEW: Debug log
    } else {
      console.log('❌ No user ID found in request - user not authenticated');
    }

    // 🆕 ENHANCED: Transform course data with video URLs
    const enhancedCourse = {
      id: course.id,
      title: course.title,
      description: course.description,
      price: course.price || 0,
      imageUrl: course.imageUrl,
      publishStatus: course.publishStatus,
      isPaid: course.isPaid || course.price > 0,
      
      // Add missing fields that frontend expects
      duration: calculateCourseDuration(course.modules),
      level: determineCourseLevel(course.modules),
      enrollmentCount: await getEnrollmentCount(courseId),
      rating: 4.5,
      reviewCount: 12,
      createdAt: course.createdAt,
      updatedAt: course.updatedAt,
      
      category: {
        id: course.category?.id,
        name: course.category?.name || 'Uncategorized',
        description: course.category?.description
      },
      
      creator: {
        id: 1,
        name: 'Course Instructor',
        email: 'instructor@example.com',
        bio: 'Experienced educator passionate about teaching',
        isAdmin: true
      },
      
      // 🆕 ENHANCED: Transform modules with video data
      modules: course.modules ? course.modules.map(module => ({
        id: module.id,
        title: module.title,
        description: module.description || `Learn about ${module.title}`,
        duration: calculateModuleDuration(module.chapters),
        orderIndex: module.orderIndex,
        isPublished: module.isPublished,
        price: module.price || 0,
        isFree: module.isFree || module.price === 0,
        
        // 🆕 NEW: Transform chapters with video data
        chapters: module.chapters ? module.chapters.map(chapter => {
          // Get the first video for this chapter
          const video = chapter.videos?.[0];
          
          // 🆕 NEW: Generate proper video URL
          const videoUrl = video 
            ? (video.videoUrl?.startsWith('http') 
              ? video.videoUrl 
              : `${req.protocol}://${req.get('host')}${video.videoUrl}`)
            : chapter.videoUrl; // Fallback to chapter videoUrl

          return {
            id: chapter.id,
            title: chapter.title,
            description: chapter.description,
            content: chapter.content,
            videoUrl: videoUrl, // 🆕 NEW: Include video URL
            type: chapter.type,
            duration: chapter.videoDuration || video?.duration || 300,
            orderIndex: chapter.order,
            isPublished: chapter.publishStatus === 'PUBLISHED',
            isFree: module.isFree || false,
            isCompleted: false, // Will be populated for enrolled users
            
            // 🆕 NEW: Video metadata
            hasVideo: !!video || !!chapter.videoUrl,
            videoDuration: video?.duration || chapter.videoDuration,
            videoSize: video?.fileSize,
            thumbnailUrl: chapter.thumbnailUrl
          };
        }) : []
      })) : []
    };

    console.log('✅ Course fetched successfully:', enhancedCourse.title);
    console.log('📊 Course stats:', {
      modules: enhancedCourse.modules.length,
      totalChapters: enhancedCourse.modules.reduce((sum, m) => sum + m.chapters.length, 0),
      videosFound: enhancedCourse.modules.reduce((sum, m) => 
        sum + m.chapters.filter(ch => ch.hasVideo).length, 0),
      duration: enhancedCourse.duration,
      userEnrolled: !!userEnrollment // 🆕 NEW: Log enrollment status
    });

    // 🆕 NEW: Return both course and enrollment data
    res.status(200).json({ 
      course: enhancedCourse,
      userEnrollment: userEnrollment // 🆕 NEW: This was missing!
    });
    
  } catch (error) {
    console.error('❌ Error fetching course:', error);
    res.status(500).json({ 
      error: 'Failed to fetch course details',
      details: error.message 
    });
  }
};

// 🆕 ENHANCED: Get all courses with better filtering
const getCourses = async (req, res) => {
  try {
    console.log('🎓 Fetching courses with filters:', req.query);
    
    const { category, search, level, price } = req.query;
    
    let courses = await courseService.getAllCourses(category);

    // Apply additional filters
    if (search) {
      const searchTerm = search.toLowerCase();
      courses = courses.filter(course => 
        course.title.toLowerCase().includes(searchTerm) ||
        course.description.toLowerCase().includes(searchTerm) ||
        course.category?.name.toLowerCase().includes(searchTerm)
      );
    }

    if (level) {
      courses = courses.filter(course => 
        determineCourseLevel(course.modules) === level.toUpperCase()
      );
    }

    if (price === 'free') {
      courses = courses.filter(course => course.price === 0);
    } else if (price === 'paid') {
      courses = courses.filter(course => course.price > 0);
    }

    // Transform courses for frontend
    const enhancedCourses = await Promise.all(courses.map(async (course) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      price: course.price || 0,
      imageUrl: course.imageUrl,
      publishStatus: course.publishStatus,
      isPaid: course.isPaid || course.price > 0,
      
      duration: calculateCourseDuration(course.modules),
      level: determineCourseLevel(course.modules),
      enrollmentCount: await getEnrollmentCount(course.id),
      
      category: {
        id: course.category?.id,
        name: course.category?.name || 'Uncategorized'
      },
      
      modules: course.modules ? course.modules.filter(m => m.isPublished).length : 0,
      chapters: course.modules ? course.modules.reduce((sum, m) => 
        sum + (m.chapters ? m.chapters.filter(c => c.publishStatus === 'PUBLISHED').length : 0), 0) : 0,
      
      createdAt: course.createdAt
    })));

    console.log('✅ Found courses:', enhancedCourses.length);

    res.status(200).json({
      courses: enhancedCourses,
      total: enhancedCourses.length,
      filters: { category, search, level, price }
    });
    
  } catch (error) {
    console.error('❌ Error fetching courses:', error);
    res.status(500).json({ 
      error: 'Failed to fetch courses',
      details: error.message 
    });
  }
};

// Helper Functions
const calculateCourseDuration = (modules) => {
  if (!modules || !Array.isArray(modules)) return 3600; // Default 1 hour
  
  return modules.reduce((total, module) => {
    if (!module.chapters || !Array.isArray(module.chapters)) return total + 1800; // Default 30 min per module
    
    return total + module.chapters.reduce((moduleTotal, chapter) => 
      moduleTotal + (chapter.videoDuration || 300), 0); // Default 5 min per chapter
  }, 0);
};

const calculateModuleDuration = (chapters) => {
  if (!chapters || !Array.isArray(chapters)) return 1800; // Default 30 min
  
  return chapters.reduce((total, chapter) => 
    total + (chapter.videoDuration || 300), 0);
};

const determineCourseLevel = (modules) => {
  if (!modules || modules.length === 0) return 'BEGINNER';
  if (modules.length <= 3) return 'BEGINNER';
  if (modules.length <= 6) return 'INTERMEDIATE';
  return 'ADVANCED';
};

const getEnrollmentCount = async (courseId) => {
  try {
    return await prisma.enrollment.count({
      where: { courseId }
    });
  } catch (error) {
    console.error('Error counting enrollments:', error);
    return 0;
  }
};

// 🆕 ENHANCED: Course creation with proper validation
const createCourse = async (req, res) => {
  try {
    console.log('🎓 Creating course:', req.body);
    
    const { title, slug, description, price, imageUrl, categoryId, publishStatus, isPaid } = req.body;

    if (!title || !slug || !description || !categoryId) {
      return res.status(400).json({ error: 'Missing required fields: title, slug, description, categoryId' });
    }

    // 🆕 Validate pricing logic
    if (isPaid && (!price || price <= 0)) {
      return res.status(400).json({ error: 'Paid courses must have a price greater than 0' });
    }

    const courseData = {
      title,
      slug,
      description,
      price: isPaid ? parseFloat(price) : 0,
      imageUrl,
      categoryId: parseInt(categoryId),
      publishStatus: publishStatus || 'DRAFT',
      isPaid: isPaid || false
    };

    const course = await courseService.createCourse(courseData);
    
    console.log('✅ Course created successfully:', course.title);
    res.status(201).json({ 
      message: 'Course created successfully',
      course 
    });
    
  } catch (error) {
    console.error('❌ Error creating course:', error);
    
    if (error.message.includes('pricing')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ 
      error: 'Failed to create course',
      details: error.message 
    });
  }
};

// 🆕 ENHANCED: Course update with proper validation
const updateCourse = async (req, res) => {
  try {
    console.log('🎓 Updating course:', req.params.id, req.body);
    
    const courseId = parseInt(req.params.id);
    const updateData = req.body;

    if (isNaN(courseId)) {
      return res.status(400).json({ error: 'Invalid course ID' });
    }

    // 🆕 Validate pricing logic if being updated
    if (updateData.isPaid && (!updateData.price || updateData.price <= 0)) {
      return res.status(400).json({ error: 'Paid courses must have a price greater than 0' });
    }

    const updatedCourse = await courseService.updateCourse(courseId, updateData);
    
    console.log('✅ Course updated successfully:', updatedCourse.title);
    res.status(200).json({
      message: 'Course updated successfully',
      course: updatedCourse
    });
    
  } catch (error) {
    console.error('❌ Error updating course:', error);
    
    if (error.message.includes('pricing')) {
      return res.status(400).json({ error: error.message });
    }
    
    res.status(500).json({ 
      error: 'Failed to update course',
      details: error.message 
    });
  }
};

// 🆕 ENHANCED: Course deletion with proper logging
const deleteCourse = async (req, res) => {
  try {
    console.log('🎓 Deleting course:', req.params.id);
    
    const courseId = parseInt(req.params.id);
    
    if (isNaN(courseId)) {
      return res.status(400).json({ error: 'Invalid course ID' });
    }
    
    await courseService.softDeleteCourse(courseId);
    
    console.log('✅ Course deleted successfully:', courseId);
    res.status(204).send();
    
  } catch (error) {
    console.error('❌ Error deleting course:', error);
    res.status(500).json({ 
      error: 'Failed to delete course',
      details: error.message 
    });
  }
};

// 🆕 ENHANCED: Course search with better results
const searchCourses = async (req, res) => {
  try {
    console.log('🎓 Searching courses:', req.query);
    
    const { query } = req.query;

    if (!query || typeof query !== 'string') {
      return res.status(400).json({ error: 'Search query is required' });
    }

    const courses = await courseService.searchCourses(query);
    
    // Transform search results
    const enhancedResults = await Promise.all(courses.map(async (course) => ({
      id: course.id,
      title: course.title,
      description: course.description,
      price: course.price || 0,
      imageUrl: course.imageUrl,
      isPaid: course.isPaid || course.price > 0,
      
      category: course.category,
      enrollmentCount: await getEnrollmentCount(course.id)
    })));

    console.log('✅ Search results:', enhancedResults.length);
    res.status(200).json({
      courses: enhancedResults,
      total: enhancedResults.length,
      query
    });
    
  } catch (error) {
    console.error('❌ Error searching courses:', error);
    res.status(500).json({ 
      error: 'Failed to search courses',
      details: error.message 
    });
  }
};

// Keep existing admin functions
const getCourseByIdForAdmin = async (req, res) => {
  try {
    const course = await courseService.getCourseByIdForAdmin(parseInt(req.params.id));
    if (!course || course.isDeleted) {
      return res.status(404).json({ error: 'Course not found' });
    }
    res.status(200).json(course);
  } catch (error) {
    console.error('Error fetching course for admin:', error);
    res.status(500).json({ error: 'Failed to fetch course details' });
  }
};

const getCoursesForAdmin = async (req, res) => {
  try {
    const { category } = req.query;
    const courses = await courseService.getAllCoursesForAdmin(category);
    res.status(200).json(courses);
  } catch (error) {
    console.error('Error fetching courses for admin:', error);
    res.status(500).json({ error: 'Failed to fetch courses' });
  }
};

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

const purchaseCourse = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId, discountCode } = req.body;

    if (!courseId || isNaN(parseInt(courseId))) {
      return res.status(400).json({ success: false, message: 'Valid course ID is required' });
    }

    const parsedCourseId = parseInt(courseId);

    const course = await prisma.course.findUnique({
      where: { id: parsedCourseId },
      select: {
        id: true,
        title: true,
        price: true,
        publishStatus: true,
        isDeleted: true,
      },
    });

    if (!course || course.isDeleted || course.publishStatus !== 'PUBLISHED') {
      return res.status(404).json({ success: false, message: 'Course not found or not available' });
    }

    if (course.price === 0) {
      return res.status(400).json({ success: false, message: 'This is a free course. Use the enroll endpoint instead.' });
    }

    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId: parsedCourseId,
        },
      },
    });

    if (existingEnrollment) {
      return res.status(400).json({ 
        success: false, 
        message: 'Already enrolled in this course',
        redirectUrl: `/courses/${parsedCourseId}/modules`
      });
    }

    let originalAmount = course.price;
    let discountAmount = 0;
    let finalAmount = originalAmount;
    let appliedDiscountCode = null;

    if (discountCode) {
      const discount = await prisma.discountCode.findUnique({
        where: { code: discountCode.toUpperCase() },
        include: {
          usages: { where: { userId } },
        },
      });

      if (!discount || !discount.isActive) {
        return res.status(400).json({ success: false, message: 'Invalid or inactive discount code' });
      }

      if (discount.expiresAt && new Date() > discount.expiresAt) {
        return res.status(400).json({ success: false, message: 'This discount code has expired' });
      }

      if (discount.startsAt && new Date() < discount.startsAt) {
        return res.status(400).json({ success: false, message: 'This discount code is not yet active' });
      }

      if (discount.maxUses && discount.usedCount >= discount.maxUses) {
        return res.status(400).json({ success: false, message: 'This discount code has reached its usage limit' });
      }

      if (discount.maxUsesPerUser && discount.usages.length >= discount.maxUsesPerUser) {
        return res.status(400).json({ success: false, message: 'You have already used this discount code' });
      }

      if (discount.minPurchaseAmount && originalAmount < discount.minPurchaseAmount) {
        return res.status(400).json({ success: false, message: `Minimum purchase amount of $${discount.minPurchaseAmount} required` });
      }

      if (discount.applicableToType !== 'ALL' && discount.applicableToType !== 'COURSE') {
        return res.status(400).json({ success: false, message: 'This discount code is not applicable to courses' });
      }

      if (discount.type === 'PERCENTAGE') {
        discountAmount = (originalAmount * discount.value) / 100;
        if (discount.maxDiscountAmount && discountAmount > discount.maxDiscountAmount) {
          discountAmount = discount.maxDiscountAmount;
        }
      } else {
        discountAmount = Math.min(discount.value, originalAmount);
      }

      finalAmount = Math.max(0, originalAmount - discountAmount);
      appliedDiscountCode = discount;
    }

    const order = await prisma.order.create({
      data: {
        userId,
        status: 'PENDING',
        totalAmount: finalAmount,
      },
    });

    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        courseId: parsedCourseId,
        price: finalAmount,
      },
    });

    if (finalAmount === 0) {
      const enrollment = await prisma.$transaction(async (tx) => {
        const newEnrollment = await tx.enrollment.create({
          data: {
            userId,
            courseId: parsedCourseId,
            progress: 0,
            paymentTransactionId: `free_${Date.now()}_${userId}_${parsedCourseId}`,
          },
          include: {
            course: {
              select: { id: true, title: true, price: true },
            },
          },
        });

        if (appliedDiscountCode) {
          await tx.discountUsage.create({
            data: {
              discountCodeId: appliedDiscountCode.id,
              userId,
              orderId: order.id,
              originalAmount,
              discountAmount,
              finalAmount,
            },
          });

          await tx.discountCode.update({
            where: { id: appliedDiscountCode.id },
            data: { usedCount: { increment: 1 } },
          });
        }

        await tx.order.update({
          where: { id: order.id },
          data: { status: 'COMPLETED' },
        });

        return newEnrollment;
      });

      return res.status(201).json({
        success: true,
        enrollment: {
          id: enrollment.id,
          courseId: enrollment.courseId,
          courseName: enrollment.course.title,
          purchasedAt: enrollment.createdAt,
          transactionId: enrollment.paymentTransactionId,
          redirectUrl: `/courses/${parsedCourseId}/modules`,
          discountApplied: appliedDiscountCode
            ? {
                code: appliedDiscountCode.code,
                discountAmount: Number(discountAmount.toFixed(2)),
                finalAmount: Number(finalAmount.toFixed(2)),
                originalAmount: Number(originalAmount.toFixed(2)),
              }
            : null,
        },
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: course.title,
              metadata: { courseId: parsedCourseId },
            },
            unit_amount: Math.round(finalAmount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&course_id=${parsedCourseId}`,
      cancel_url: `${process.env.FRONTEND_URL}/courses/${parsedCourseId}`,
      metadata: {
        userId: userId.toString(),
        orderId: order.id.toString(),
        courseId: parsedCourseId.toString(),
        discountCode: appliedDiscountCode ? appliedDiscountCode.code : null,
        discountAmount: discountAmount.toString(),
        finalAmount: finalAmount.toString(),
      },
    });

    res.status(200).json({
      success: true,
      sessionId: session.id,
      url: session.url,
      orderId: order.id,
      discountApplied: appliedDiscountCode
        ? {
            code: appliedDiscountCode.code,
            discountAmount: Number(discountAmount.toFixed(2)),
            finalAmount: Number(finalAmount.toFixed(2)),
            originalAmount: Number(originalAmount.toFixed(2)),
          }
        : null,
    });
  } catch (error) {
    console.error('Error purchasing course:', error);
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message,
    });
  }
};

// NEW: Get bundles
const getBundles = async (req, res) => {
  try {
    const { type } = req.query;
    const bundles = await prisma.bundle.findMany({
      where: { 
        type: type || 'COURSE',
        isActive: true 
      },
      include: { 
        courseItems: { 
          include: { 
            course: { 
              select: { id: true, title: true, price: true, imageUrl: true } 
            } 
          } 
        } 
      }
    });

    const transformedBundles = bundles.map(bundle => ({
      id: bundle.id,
      name: bundle.name,
      description: bundle.description,
      type: bundle.type,
      finalPrice: bundle.finalPrice,
      totalPrice: bundle.totalPrice,
      discount: bundle.discount,
      savings: bundle.totalPrice - bundle.finalPrice,
      savingsPercentage: Math.round(((bundle.totalPrice - bundle.finalPrice) / bundle.totalPrice) * 100),
      isFeatured: bundle.isFeatured,
      isPopular: bundle.isPopular,
      totalItems: bundle.courseItems.length,
      courseItems: bundle.courseItems.map(item => ({
        course: {
          id: item.course.id,
          title: item.course.title,
          price: item.course.price,
          imageUrl: item.course.imageUrl
        }
      }))
    }));

    res.json({ success: true, bundles: transformedBundles });
  } catch (error) {
    console.error('Error fetching bundles:', error);
    res.status(500).json({ success: false, message: 'Failed to fetch bundles' });
  }
};

// NEW: Check enrollment
const checkEnrollment = async (req, res) => {
  try {
    const userId = req.user.id;
    const courseId = parseInt(req.params.courseId);

    if (isNaN(courseId)) {
      return res.status(400).json({ success: false, message: 'Valid course ID is required' });
    }

    const enrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId,
        },
      },
      select: {
        id: true,
        progress: true,
        lastAccessed: true,
        enrolledAt: true,
        completed: true,
      },
    });

    if (!enrollment) {
      return res.status(404).json({ success: false, message: 'Not enrolled' });
    }

    res.json({ success: true, enrollment });
  } catch (error) {
    console.error('Error checking enrollment:', error);
    res.status(500).json({ success: false, message: 'Failed to check enrollment' });
  }
};

// NEW: Enroll in free course
const enrollFreeCourse = async (req, res) => {
  try {
    const userId = req.user.id;
    const { courseId } = req.body;

    if (!courseId || isNaN(parseInt(courseId))) {
      return res.status(400).json({ success: false, message: 'Valid course ID is required' });
    }

    const parsedCourseId = parseInt(courseId);

    const course = await prisma.course.findUnique({
      where: { id: parsedCourseId },
      select: { id: true, price: true, publishStatus: true, isDeleted: true },
    });

    if (!course || course.isDeleted || course.publishStatus !== 'PUBLISHED') {
      return res.status(404).json({ success: false, message: 'Course not found or not available' });
    }

    if (course.price > 0) {
      return res.status(400).json({ success: false, message: 'This is a paid course. Use the purchase endpoint instead.' });
    }

    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId: parsedCourseId,
        },
      },
    });

    if (existingEnrollment) {
      return res.status(400).json({ 
        success: false, 
        message: 'Already enrolled in this course',
        redirectUrl: `/courses/${parsedCourseId}/modules`
      });
    }

    const enrollment = await prisma.enrollment.create({
      data: {
        userId,
        courseId: parsedCourseId,
        progress: 0,
        enrolledAt: new Date(),
        lastAccessed: new Date(),
        paymentTransactionId: `free_${Date.now()}_${userId}_${parsedCourseId}`,
      },
      include: {
        course: { select: { id: true, title: true } },
      },
    });

    res.status(201).json({
      success: true,
      enrollment: {
        id: enrollment.id,
        courseId: enrollment.courseId,
        courseName: enrollment.course.title,
        enrolledAt: enrollment.enrolledAt,
        transactionId: enrollment.paymentTransactionId,
        redirectUrl: `/courses/${parsedCourseId}/modules`
      },
    });
  } catch (error) {
    console.error('Error enrolling in free course:', error);
    res.status(500).json({ success: false, message: 'Failed to enroll' });
  }
};

// NEW: Purchase bundle
const purchaseBundle = async (req, res) => {
  try {
    const userId = req.user.id;
    const { bundleId, discountCode } = req.body;

    if (!bundleId || isNaN(parseInt(bundleId))) {
      return res.status(400).json({ success: false, message: 'Valid bundle ID is required' });
    }

    const parsedBundleId = parseInt(bundleId);

    const bundle = await prisma.bundle.findUnique({
      where: { id: parsedBundleId },
      include: {
        courseItems: { include: { course: true } },
      },
    });

    if (!bundle || !bundle.isActive) {
      return res.status(404).json({ success: false, message: 'Bundle not found or not available' });
    }

    const existingEnrollments = await prisma.enrollment.findMany({
      where: {
        userId,
        courseId: { in: bundle.courseItems.map(item => item.course.id) },
      },
    });

    if (existingEnrollments.length === bundle.courseItems.length) {
      return res.status(400).json({ 
        success: false, 
        message: 'You already own all courses in this bundle',
        redirectUrl: '/my-courses'
      });
    }

    let originalAmount = bundle.finalPrice;
    let discountAmount = 0;
    let finalAmount = originalAmount;
    let appliedDiscountCode = null;

    if (discountCode) {
      const discount = await prisma.discountCode.findUnique({
        where: { code: discountCode.toUpperCase() },
        include: {
          usages: { where: { userId } },
        },
      });

      if (!discount || !discount.isActive) {
        return res.status(400).json({ success: false, message: 'Invalid or inactive discount code' });
      }

      if (discount.expiresAt && new Date() > discount.expiresAt) {
        return res.status(400).json({ success: false, message: 'This discount code has expired' });
      }

      if (discount.startsAt && new Date() < discount.startsAt) {
        return res.status(400).json({ success: false, message: 'This discount code is not yet active' });
      }

      if (discount.maxUses && discount.usedCount >= discount.maxUses) {
        return res.status(400).json({ success: false, message: 'This discount code has reached its usage limit' });
      }

      if (discount.maxUsesPerUser && discount.usages.length >= discount.maxUsesPerUser) {
        return res.status(400).json({ success: false, message: 'You have already used this discount code' });
      }

      if (discount.minPurchaseAmount && originalAmount < discount.minPurchaseAmount) {
        return res.status(400).json({ success: false, message: `Minimum purchase amount of $${discount.minPurchaseAmount} required` });
      }

      if (discount.applicableToType !== 'ALL' && discount.applicableToType !== 'BUNDLE') {
        return res.status(400).json({ success: false, message: 'This discount code is not applicable to bundles' });
      }

      if (discount.type === 'PERCENTAGE') {
        discountAmount = (originalAmount * discount.value) / 100;
        if (discount.maxDiscountAmount && discountAmount > discount.maxDiscountAmount) {
          discountAmount = discount.maxDiscountAmount;
        }
      } else {
        discountAmount = Math.min(discount.value, originalAmount);
      }

      finalAmount = Math.max(0, originalAmount - discountAmount);
      appliedDiscountCode = discount;
    }

    const order = await prisma.order.create({
      data: {
        userId,
        status: 'PENDING',
        totalAmount: finalAmount,
      },
    });

    await prisma.orderItem.create({
      data: {
        orderId: order.id,
        bundleId: parsedBundleId,
        price: finalAmount,
      },
    });

    if (finalAmount === 0) {
      const enrollments = await prisma.$transaction(async (tx) => {
        const newEnrollments = await Promise.all(
          bundle.courseItems.map(item =>
            tx.enrollment.create({
              data: {
                userId,
                courseId: item.course.id,
                progress: 0,
                enrolledAt: new Date(),
                lastAccessed: new Date(),
                paymentTransactionId: `free_bundle_${Date.now()}_${userId}_${parsedBundleId}`,
              },
              include: {
                course: { select: { id: true, title: true } },
              },
            })
          )
        );

        if (appliedDiscountCode) {
          await tx.discountUsage.create({
            data: {
              discountCodeId: appliedDiscountCode.id,
              userId,
              orderId: order.id,
              originalAmount,
              discountAmount,
              finalAmount,
            },
          });

          await tx.discountCode.update({
            where: { id: appliedDiscountCode.id },
            data: { usedCount: { increment: 1 } },
          });
        }

        await tx.order.update({
          where: { id: order.id },
          data: { status: 'COMPLETED' },
        });

        return newEnrollments;
      });

      return res.status(201).json({
        success: true,
        enrollments: enrollments.map(enrollment => ({
          id: enrollment.id,
          courseId: enrollment.courseId,
          courseName: enrollment.course.title,
          enrolledAt: enrollment.enrolledAt,
          transactionId: enrollment.paymentTransactionId,
        })),
        redirectUrl: '/my-courses',
        discountApplied: appliedDiscountCode
          ? {
              code: appliedDiscountCode.code,
              discountAmount: Number(discountAmount.toFixed(2)),
              finalAmount: Number(finalAmount.toFixed(2)),
              originalAmount: Number(originalAmount.toFixed(2)),
            }
          : null,
      });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [
        {
          price_data: {
            currency: 'usd',
            product_data: {
              name: bundle.name,
              metadata: { bundleId: parsedBundleId },
            },
            unit_amount: Math.round(finalAmount * 100),
          },
          quantity: 1,
        },
      ],
      mode: 'payment',
      success_url: `${process.env.FRONTEND_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}&bundle_id=${parsedBundleId}`,
      cancel_url: `${process.env.FRONTEND_URL}/courses/${bundle.courseItems[0]?.course.id || parsedCourseId}`,
      metadata: {
        userId: userId.toString(),
        orderId: order.id.toString(),
        bundleId: parsedBundleId.toString(),
        discountCode: appliedDiscountCode ? appliedDiscountCode.code : null,
        discountAmount: discountAmount.toString(),
        finalAmount: finalAmount.toString(),
      },
    });

    res.status(200).json({
      success: true,
      sessionId: session.id,
      url: session.url,
      orderId: order.id,
      discountApplied: appliedDiscountCode
        ? {
            code: appliedDiscountCode.code,
            discountAmount: Number(discountAmount.toFixed(2)),
            finalAmount: Number(finalAmount.toFixed(2)),
            originalAmount: Number(originalAmount.toFixed(2)),
          }
        : null,
    });
  } catch (error) {
    console.error('Error purchasing bundle:', error);
    res.status(500).json({
      success: false,
      message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message,
    });
  }
};

module.exports = {
  getCourses,
  getCoursesForAdmin,
  getCourseById,
  getCourseByIdForAdmin,
  createCourse,
  updateCourse,
  deleteCourse,
  searchCourses,
  purchaseCourse,
  getBundles,
  enrollFreeCourse,
  checkEnrollment,
  purchaseBundle,
};