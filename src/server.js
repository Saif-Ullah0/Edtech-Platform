// src/server.js
require('dotenv').config();
const express = require('express');
const serverless = require('serverless-http');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const path = require('path');
const fs = require('fs');

const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

// Import routes & middlewares (same as before)
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

const startOrderCleanupJob = require('./cron/orderCleanupJob');

const passport = require('./passportConfig');

const app = express();

/*
  IMPORTANT:
  - On Vercel (serverless) we MUST NOT call app.listen().
  - Vercel sets process.env.VERCEL to '1' (or truthy). We'll use this to detect serverless.
*/
const IS_VERCEL = Boolean(process.env.VERCEL);
const IS_LOCAL = !IS_VERCEL;

// --- Create uploads directories only when running locally or when you intentionally want to (not serverless).
// Serverless environments have ephemeral filesystem — uploads won't persist. Use cloud storage in production.
if (IS_LOCAL) {
  const uploadDirs = [
    path.join(__dirname, '..', 'uploads'), // backend/uploads
    path.join(__dirname, '..', 'uploads', 'videos'),
    path.join(__dirname, '..', 'uploads', 'videos', 'thumbnails'),
  ];

  uploadDirs.forEach((dir) => {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      console.log(`Created directory: ${dir}`);
    }
  });
}

// Serve static uploads only in local or if you know what you are doing
if (IS_LOCAL) {
  app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));
} else {
  // In production on Vercel, serving uploads from local disk doesn't make sense.
  // If you want to expose a placeholder route, keep it simple or proxy to cloud storage.
  app.get('/uploads/*', (req, res) => {
    res.status(410).json({ error: 'Uploads are not available on serverless; use cloud storage' });
  });
}

// Attach webhook (webhooks are sometimes required to be publicly reachable)
app.use('/webhook', webhookRoutes);

// CORS
app.use(
  cors({
    origin: process.env.CORS_ORIGIN || 'http://localhost:3000',
    credentials: true,
  })
);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));
app.use(cookieParser());
app.use(passport.initialize());

// Routes (same as before)
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
    message: process.env.NODE_ENV === 'production' ? 'Something went wrong' : error.message,
  });
});

app.use('*', (req, res) => {
  res.status(404).json({
    error: 'Route not found',
    message: `The requested route ${req.originalUrl} does not exist`,
  });
});

// --- Cron / background jobs: only start them in local/long-running environments.
// In serverless (Vercel) they should NOT run here.
// If you want scheduled jobs in production, use a separate worker or external cron.
if (IS_LOCAL) {
  try {
    startOrderCleanupJob(); // only start locally
    console.log('Order cleanup job started (local only).');
  } catch (e) {
    console.error('Failed to start order cleanup job locally:', e);
  }
} else {
  console.log('Skipping cron jobs on serverless environment.');
}

// --- Lifecycle: ensure Prisma disconnects on shutdown (local)
async function shutdown() {
  try {
    console.log('Shutting down: disconnecting Prisma client...');
    await prisma.$disconnect();
    console.log('Prisma disconnected.');
  } catch (e) {
    console.error('Error during Prisma disconnect:', e);
  } finally {
    // If running locally, exit the process. In serverless we typically don't call process.exit
    if (IS_LOCAL) process.exit(0);
  }
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

// --- Start server locally; on Vercel export the handler.
if (IS_LOCAL) {
  const PORT = process.env.PORT || 5000;
  app.listen(PORT, () => {
    console.log(`🚀 Server running on port ${PORT}`);
    console.log(`📱 Frontend URL: ${process.env.CORS_ORIGIN || 'http://localhost:3000'}`);
    console.log(`⚡ API URL: http://localhost:${PORT}/api`);
    console.log(`Uploads directory: ${path.join(__dirname, '..', 'uploads')}`);
  });
} else {
  // Export serverless handler for Vercel
  console.log('Running in serverless (VERCEL) mode — exporting handler.');
  module.exports = serverless(app);
}
