import { Router } from 'express';
import { AttendanceController } from '../controllers/AttendanceController';
import { authenticateJWT, authorizeFaculty } from '../middlewares/authMiddleware';
import { validateFields } from '../middlewares/validationMiddleware';

const router = Router();
const controller = new AttendanceController();

router.use(authenticateJWT);

// Start regular session (Faculty only)
router.post('/start', authorizeFaculty, validateFields(['year', 'semester', 'section', 'timetableId']), controller.startSession);

// Get active session
router.get('/active', controller.getActiveSession);

// Scan student roll number
router.post('/scan', validateFields(['sessionId', 'rollNumber']), controller.processScan);

// End regular session (Faculty only)
router.post('/end', authorizeFaculty, validateFields(['sessionId']), controller.endSession);

// Finalize regular session (Faculty only)
router.post('/finalize', authorizeFaculty, validateFields(['sessionId']), controller.finalizeSession);

// Get sessions matching filters
router.get('/sessions', controller.getSessions);

// Get session details
router.get('/sessions/:sessionId', controller.getSessionDetails);

// Edit student attendance status
router.patch('/sessions/:sessionId/student/:studentId', controller.updateStudentAttendance);

// Delete session
router.delete('/sessions/:sessionId', controller.deleteSession);

export default router;
