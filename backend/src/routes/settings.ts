import { Router } from 'express';
import { SettingsController } from '../controllers/SettingsController';
import { authenticateJWT, authorizeAdmin } from '../middlewares/authMiddleware';

const router = Router();
const controller = new SettingsController();

router.use(authenticateJWT);

// GET /api/settings
router.get('/', controller.getSettings);

// PUT /api/settings (Admin only)
router.put('/', authorizeAdmin, controller.updateSettings);

export default router;
