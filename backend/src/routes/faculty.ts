import { Router, Response, NextFunction } from 'express';
import { authenticateJWT, authorizeFaculty } from '../middlewares/authMiddleware';
import { TimetableRepository } from '../repositories/TimetableRepository';
import { AuthenticatedRequest } from '../types';

const router = Router();
const timetableRepo = new TimetableRepository();

router.use(authenticateJWT);
router.use(authorizeFaculty);

// GET /api/faculty/timetable/today
router.get('/timetable/today', async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  try {
    const facultyId = req.user?.userId;
    if (!facultyId) {
      return res.status(401).json({ success: false, message: 'Unauthorized' });
    }

    // Get current day of week: Sunday = 0, Monday = 1, ..., Saturday = 6
    // If it's Sunday, we can fallback to 1 (Monday) for easier testing, but standard is checking actual day
    let dayOfWeek = new Date().getDay();
    if (dayOfWeek === 0) {
      dayOfWeek = 1; // fallback to Monday for Sunday development testing
    }

    const schedule = await timetableRepo.findByDay(dayOfWeek);
    return res.status(200).json({
      success: true,
      data: schedule
    });
  } catch (error) {
    next(error);
  }
});

export default router;
