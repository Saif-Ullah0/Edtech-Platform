// src/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const serverless = require('serverless-http'); // <- required for Vercel serverless handler

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// ----- ROUTES & CONTROLLERS -----
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

const bundleRoutes = require('./routes/bundleRoutes');
const bundleAdminRoutes = require('./routes/admin/bundleAdminRoutes');

const commentRoutes = require('./routes/commentRoutes');
const discountRoutes = require('./routes/discountRoutes');

const startOrderCleanupJob = require('./cron/orderCleanupJob');

const passport = require('./passportConfig');

const app = express();

// -----------------------------
// IMPORTANT: Only run these operations locally (not on Vercel)
// Vercel sets process.env.VERCEL = '1' — also check NODE_ENV
// -----------------------------
const IS_VERCEL = !!process.env.VERCEL; // true on Vercel
const IS_PROD = process.env.NODE_ENV === 'production' || IS_VERCEL;

// Create upload directories only when running locally or on a server with a writable FS
if (!IS_VERCEL) {
  const uploadDirs = [
    path.join(__dirname, '..', 'uploads'),
    path.join(__dirname, '..', 'uploads', 'videos'),
    path.join(__dirname, '..', 'uploads', 'videos', 'thumbnails'),
  ];

  uploadDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });

  // Serve uploads locally for dev
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
} else {
  // On Vercel we should not try to create or serve local uploads
  // Consider using cloud storage (Supabase Storage / S3 / Cloudinary) for uploads
  console.log('Running on Vercel — local uploads disabled; use cloud storage.');
}

// Webhook should still be reachable; note: external webhooks must call your Vercel URL
app.use('/webhook', webhookRoutes);

app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(passport.initialize()); // Passport init (safe for serverless)

// ROUTES
app.use('/api/auth', authRoutes);
app.use('/api/protected', protectedRoutes);
app.use('/api/users', userRoutes);
app.use('/api/categories', categoryRoutes);
app.use('/api/courses', courseRoutes);
app.use('/api/payment', paymentRoutes);
app.use('/api/order', orderRoutes);

app.use('/api/enroll', requireAuth, enrollmentRoutes);
app.use('/api/enrollments', requireAuth, enrollmentRoutes);

app.use('/api/videos', videoRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/notes', notesRoutes);
app.use('/api/comments', commentRoutes);
app.use('/api/discounts', discountRoutes);

app.use('/api/bundles', bundleRoutes);
app.use('/api/admin/bundles', bundleAdminRoutes);

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
    res.status(200).json({ id: req.user.userId, role: req.user.role });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

app.use('/api/debug', require('./routes/debugRoutes'));

app.get('/', (req, res) => {
  res.send('Backend is running');
});

// Error handler
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  if (res.headersSent) return next(error);
  res.status(500).json({
    error: 'Internal server error',
    message: IS_PROD ? 'Something went wrong' : error.message,
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested route ${req.originalUrl} does not exist`,
  });
});

// -----------------------------
// Start cron job only when running locally or on a server (not serverless)
// -----------------------------
if (!IS_VERCEL) {
  try {
    startOrderCleanupJob();
    console.log('Order cleanup cron started (local only)');
  } catch (err) {
    console.warn('Could not start order cleanup job locally:', err);
  }
} else {
  console.log('Skipping cron start on Vercel (serverless environment)');
}

// -----------------------------
// Local listen (only when not running serverless on Vercel)
// -----------------------------
if (!IS_VERCEL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Frontend URL: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
    console.log(`⚡ API URL: http://localhost:${PORT}/api`);
  });
}

// Export serverless handler for Vercel (and other serverless platforms)
module.exports = app;              // keep for unit tests or import
module.exports.handler = serverless(app);
