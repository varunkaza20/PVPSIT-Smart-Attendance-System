import { Router } from 'express';
import { CustomAttendanceController } from '../controllers/CustomAttendanceController';
import { authenticateJWT, authorizeFaculty } from '../middlewares/authMiddleware';
import { validateFields } from '../middlewares/validationMiddleware';

const router = Router();
const controller = new CustomAttendanceController();

router.use(authenticateJWT);

// Start custom session
router.post('/start', authorizeFaculty, validateFields(['sessionTitle', 'venue', 'eventDate', 'studentRoster']), controller.startSession);

// Get active custom session
router.get('/active', controller.getActiveSession);

// Scan student roll number
router.post('/scan', validateFields(['sessionId', 'rollNumber']), controller.processScan);

// End custom session
router.post('/end', authorizeFaculty, validateFields(['sessionId']), controller.endSession);

// Finalize custom session
router.post('/finalize', authorizeFaculty, validateFields(['sessionId']), controller.finalizeSession);

// List custom sessions
router.get('/sessions', controller.getSessions);

// Get single custom session details
router.get('/sessions/:id', controller.getSessionDetails);

// Adjust student attendance record in custom session
router.patch('/sessions/:id/student/:rollNumber', authorizeFaculty, validateFields(['newStatus', 'reason']), controller.updateStudentStatus);

// Delete custom session
router.delete('/sessions/:id', authorizeFaculty, controller.deleteSession);

export default router;
