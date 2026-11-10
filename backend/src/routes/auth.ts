import { Router } from 'express';
import { AuthController } from '../controllers/AuthController';
import { authenticateJWT } from '../middlewares/authMiddleware';
import { validateFields } from '../middlewares/validationMiddleware';

const router = Router();
const controller = new AuthController();

// POST /api/auth/login
router.post('/login', validateFields(['employeeId', 'password']), controller.login);

// POST /api/auth/logout (protected)
router.post('/logout', authenticateJWT, controller.logout);

// GET /api/auth/me (protected)
router.get('/me', authenticateJWT, controller.getMe);

export default router;
