// src/server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// IMPORTANT: load serverless wrapper only when needed
let serverless;
const isServerless = !!process.env.VERCEL || !!process.env.FUNCTIONS_WORKER_RUNTIME;

try {
  if (isServerless) {
    serverless = require('serverless-http');
  }
} catch (err) {
  // serverless-http may not be installed locally in some environments
  console.warn('serverless-http not available:', err.message);
}

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
const orderRoutes = require('./routes/orderRoutes');

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

// NOTE: Do NOT run background cron jobs in serverless environment.
// Start cron job only when running as a long-lived server (local).
if (!isServerless) {
  const startOrderCleanupJob = require('./cron/orderCleanupJob');
  startOrderCleanupJob();
} else {
  console.log('⚠️ Running in serverless environment — cron jobs are disabled.');
}

const passport = require('./passportConfig');

const app = express();

// Create uploads directories only in non-serverless (local) environment
if (!isServerless) {
  const uploadDirs = [
    path.join(__dirname, '../uploads'),
    path.join(__dirname, '../uploads/videos'),
    path.join(__dirname, '../uploads/videos/thumbnails'),
  ];

  uploadDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });

  app.use('/uploads', express.static(path.join(__dirname, '../uploads')));
} else {
  // In serverless, we serve uploads only if you mount a cloud storage proxy. For now respond with 404.
  app.get('/uploads/*', (req, res) => {
    res.status(404).json({ error: 'Uploads not available in serverless environment. Use cloud storage.' });
  });
}

// Webhook route should remain as-is (some providers require external endpoint)
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
app.use(passport.initialize()); // Initialize Passport

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
    res.status(200).json({
      id: req.user.userId,
      role: req.user.role,
    });
  } catch (error) {
    console.error('Get current user error:', error);
    res.status(500).json({ error: 'Failed to get user data' });
  }
});

app.use('/api/debug', require('./routes/debugRoutes'));

app.get('/', (req, res) => {
  res.send('Backend is running');
});

// Error handlers
app.use((error, req, res, next) => {
  console.error('Server error:', error);
  if (res.headersSent) return next(error);
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message,
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested route ${req.originalUrl} does not exist`,
  });
});

// Graceful shutdown for local server
async function shutdown() {
  console.log('Shutting down server, disconnecting Prisma...');
  try {
    await prisma.$disconnect();
    console.log('Prisma disconnected');
  } catch (err) {
    console.error('Error disconnecting Prisma', err);
  }
  process.exit(0);
}
process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// If running serverless (Vercel), export the handler; otherwise start a long-lived server locally.
if (isServerless && serverless) {
  console.log('Running in serverless mode — exporting handler for platform.');
  module.exports = serverless(app);
} else {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Frontend URL: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
    console.log(`⚡ API URL: http://localhost:${PORT}/api`);
    console.log(`Uploads directory: ${path.join(__dirname, '../uploads')}`);
  });
}
