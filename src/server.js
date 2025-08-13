require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

// ✅ ADD: Prisma import for course purchase endpoint
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const authRoutes = require('./routes/authRoutes');
const protectedRoutes = require('./routes/protectedRoutes');
const userRoutes = require('./routes/userRoutes');
const categoryRoutes = require('./routes/categoryRoutes');
const courseRoutes = require('./routes/courseRoutes');
const enrollmentRoutes = require('./routes/enrollmentRoutes');
const paymentRoutes = require('./routes/paymentRoutes');
const adminCategoryRoutes = require('./routes/admin/categoryAdminRoutes');
const adminCourseRoutes = require('./routes/admin/courseAdminRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const adminModuleRoutes = require('./routes/admin/moduleAdminRoutes');
const adminDashboardRoutes = require('./routes/admin/dashboardAdminRoutes');
const adminEnrollmentRoutes = require('./routes/admin/enrollmentAdminRoutes');
const adminUserRoutes = require('./routes/admin/userAdminRoutes');
const orderRoutes = require("./routes/orderRoutes");

const videoRoutes = require('./routes/videoRoutes');
const progressRoutes = require('./routes/progressRoutes');

const requireAuth = require('./middlewares/requireAuth');
const requireAdmin = require('./middlewares/requireAdmin');
const notesRoutes = require('./routes/notesRoutes');
const chapterRoutes = require('./routes/chapterRoutes');
const chapterAdminRoutes = require('./routes/admin/chapterAdminRoutes');

// ✅ Bundle routes
const bundleRoutes = require('./routes/bundleRoutes');
const bundleAdminRoutes = require('./routes/admin/bundleAdminRoutes');

const commentRoutes = require('./routes/commentRoutes');
const discountRoutes = require('./routes/discountRoutes');

const startOrderCleanupJob = require('./cron/orderCleanupJob');
startOrderCleanupJob();

const app = express();

const uploadDirs = [
  '../uploads',                   
  '../uploads/videos',             
  '../uploads/videos/thumbnails'
];

uploadDirs.forEach(dir => {
  const fullPath = path.join(__dirname, dir);
  if (!fs.existsSync(fullPath)) {
    fs.mkdirSync(fullPath, { recursive: true });
    console.log(`Created directory: ${fullPath}`);
  }
});

app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

app.use('/webhook', webhookRoutes); 

app.use(cors({
  origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
  credentials: true,
}));

// Body parsing middleware
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());

// Public routes
app.use('/api/auth', authRoutes);
app.use('/api/protected', protectedRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/payment', paymentRoutes);
app.use("/api/order", orderRoutes);

app.use('/api/enroll', requireAuth, enrollmentRoutes);
app.use('/api/enrollments', requireAuth, enrollmentRoutes); // Frontend calls /api/enrollments/my-courses

app.use('/api/videos', videoRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/discounts', discountRoutes);

// ✅ FIXED: Bundle routes (middleware is applied at route level)
app.use('/api/bundles', bundleRoutes);
app.use('/api/admin/bundles', bundleAdminRoutes);

// Admin routes (require authentication + admin role)
app.use('/api/admin/categories', requireAuth, requireAdmin, adminCategoryRoutes);
app.use('/api/admin/courses', requireAuth, requireAdmin, adminCourseRoutes);
app.use('/api/admin/modules', requireAuth, requireAdmin, adminModuleRoutes);
app.use('/api/admin/dashboard', requireAuth, requireAdmin, adminDashboardRoutes);
app.use('/api/admin/enrollments', requireAuth, requireAdmin, adminEnrollmentRoutes);
app.use('/api/admin/users', requireAuth, requireAdmin, adminUserRoutes);

app.use('/api/chapters', chapterRoutes);
app.use('/api/admin/chapters', chapterAdminRoutes);

app.get('/api/me', requireAuth, (req, res) => {
  try {
    console.log('GET /api/me - User from token:', req.user);
    
    res.status(200).json({
      id: req.user.userId,
      role: req.user.role,
    });

  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

app.use('/api/courses', (req, res, next) => {
  // Log all course requests for debugging
  console.log(`🎓 Course request: ${req.method} ${req.originalUrl}`);
  
  // Apply auth middleware only for specific endpoints that need it
  const protectedEndpoints = ['/purchase', '/enroll'];
  const needsAuth = protectedEndpoints.some(endpoint => req.path.includes(endpoint));
  
  if (needsAuth) {
    console.log('🔐 Applying auth to course endpoint');
    return requireAuth(req, res, next);
  }
  
  next();
}, courseRoutes);

// 🆕 FIXED: Add course purchase endpoint
app.post('/api/courses/purchase', requireAuth, async (req, res) => {
  try {
    console.log('💰 Course purchase request:', req.body);
    
    const userId = req.user.id;
    const { courseId } = req.body;

    if (!courseId || isNaN(parseInt(courseId))) {
      return res.status(400).json({ error: 'Valid course ID is required' });
    }

    const parsedCourseId = parseInt(courseId);

    // Get course details
    const course = await prisma.course.findUnique({
      where: { id: parsedCourseId },
      select: {
        id: true,
        title: true,
        price: true,
        publishStatus: true,
        isDeleted: true
      }
    });

    if (!course || course.isDeleted || course.publishStatus !== 'PUBLISHED') {
      return res.status(404).json({ error: 'Course not found or not available' });
    }

    if (course.price === 0) {
      return res.status(400).json({ error: 'This is a free course. Use the enroll endpoint instead.' });
    }

    // Check if already enrolled
    const existingEnrollment = await prisma.enrollment.findUnique({
      where: {
        userId_courseId: {
          userId,
          courseId: parsedCourseId
        }
      }
    });

    if (existingEnrollment) {
      return res.status(400).json({ error: 'Already enrolled in this course' });
    }

    // For now, simulate successful payment and create enrollment
    // In production, this would integrate with Stripe or other payment processor
    const enrollment = await prisma.enrollment.create({
      data: {
        userId,
        courseId: parsedCourseId,
        progress: 0,
        paymentTransactionId: `sim_${Date.now()}_${userId}_${parsedCourseId}` // Simulated transaction ID
      },
      include: {
        course: {
          select: {
            id: true,
            title: true,
            price: true
          }
        }
      }
    });

    console.log('✅ Successfully purchased course:', course.title);

    res.status(201).json({
      message: 'Course purchased successfully',
      enrollment: {
        id: enrollment.id,
        courseId: enrollment.courseId,
        courseName: enrollment.course.title,
        purchasedAt: enrollment.createdAt,
        transactionId: enrollment.paymentTransactionId
      }
    });

  } catch (error) {
    console.error('❌ Error purchasing course:', error);
    res.status(500).json({ 
      error: 'Failed to purchase course',
      details: error.message 
    });
  }
});

app.use('/api/debug', require('./routes/debugRoutes'));

app.get('/', (req, res) => {
  res.send('Backend is running');
});

app.use((error, req, res, next) => {
  console.error('Server error:', error);
  
  if (res.headersSent) {
    return next(error);
  }

  res.status(500).json({ 
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message 
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested route ${req.originalUrl} does not exist`
  });
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📱 Frontend URL: http://localhost:3000`);
  console.log(`⚡ API URL: http://localhost:${PORT}/api`);
  console.log(`Uploads directory: ${path.join(__dirname, 'uploads')}`);
  console.log(`Video uploads available at: http://localhost:${PORT}/uploads/videos/`);
});