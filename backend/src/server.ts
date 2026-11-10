import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import dotenv from 'dotenv';
import path from 'path';

// Load environment variables
dotenv.config();

import { connectDB } from './config/db';
import { assertSecurityConfig, corsOrigin } from './config/env';
import { initSocket } from './socket/socket';
import { errorHandler, notFoundHandler } from './middlewares/errorMiddleware';

// Routes
import authRoutes from './routes/auth';
import adminRoutes from './routes/admin';
import attendanceRoutes from './routes/attendance';
import customAttendanceRoutes from './routes/customAttendance';
import reportRoutes from './routes/reports';
import settingsRoutes from './routes/settings';
import facultyRoutes from './routes/faculty';

// Controllers (for explicit export path mapping)
import { ReportController } from './controllers/ReportController';
import { authenticateJWT } from './middlewares/authMiddleware';
import { AttendanceService } from './services/AttendanceService';

const app = express();
const httpServer = createServer(app);
const PORT = process.env.PORT || 5000;

// Fail fast on missing/weak secrets before anything starts
assertSecurityConfig();

// Connect to MongoDB
connectDB();

// Middlewares
app.use(helmet());
app.use(cors({
  origin: corsOrigin(), // set CORS_ORIGINS in .env to restrict; open only in development
  credentials: true
}));
// Export endpoints receive chart images (base64), so they need a larger body limit than the default.
// This parser must come BEFORE the global one; once a body is parsed the global parser skips it.
app.use(['/api/export', '/api/reports/export'], express.json({ limit: '25mb' }));
app.use(express.json());

// Rate Limiter (Prevent brute-force scanning / login attempts)
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Limit each IP to 1000 requests per window
  standardHeaders: true,
  legacyHeaders: false,
  message: {
    success: false,
    message: 'Too many requests from this IP, please try again after 15 minutes.'
  }
});
app.use('/api/', limiter);

// Mount API routes
app.use('/api/auth', authRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/custom-attendance', customAttendanceRoutes);
app.use('/api/reports', reportRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/faculty', facultyRoutes);

// Spec requirement: Map direct /api/export/excel and /api/export/pdf
const reportController = new ReportController();
app.post('/api/export/excel', authenticateJWT, reportController.exportExcel);
app.post('/api/export/pdf', authenticateJWT, reportController.exportPdf);

// Static assets route if serving compiled frontend
app.use(express.static(path.join(__dirname, '../../frontend/dist')));

// Fallback to React app router in production
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) {
    return next();
  }
  res.sendFile(path.join(__dirname, '../../frontend/dist/index.html'));
});

// 404 Route handler
app.use(notFoundHandler);

// Centralized error handling middleware
app.use(errorHandler);

// Initialize WebSockets
initSocket(httpServer);

// Start listening
httpServer.listen(PORT, () => {
  console.log(`===============================================`);
  console.log(`PVPSIT Smart Attendance System Backend Running`);
  console.log(`Port: ${PORT}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`===============================================`);
});

// Start background auto-end checker (runs every 30 seconds)
const attendanceService = new AttendanceService();
setInterval(() => {
  attendanceService.checkAndAutoEndSessions();
}, 30 * 1000);

export { app, httpServer };
