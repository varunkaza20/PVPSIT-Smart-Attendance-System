import { Router } from 'express';
import { ReportController } from '../controllers/ReportController';
import { authenticateJWT } from '../middlewares/authMiddleware';

const router = Router();
const controller = new ReportController();

router.use(authenticateJWT);

// GET /api/reports/filters?year=&semester=   -> subject + section dropdown options
router.get('/filters', controller.getFilterOptions);

// GET /api/reports/subjects?period=day|week|month&date=|month=&year=&semester=&subjectId=&section=
router.get('/subjects', controller.getSubjectsReport);

// GET /api/reports/custom?period=day|week|month&date=|month=&sessionId=
router.get('/custom', controller.getCustomReport);

// GET /api/reports/defaulters?year=&semester=&section=&subjectId=&threshold=
router.get('/defaulters', controller.getDefaultersReport);

// Export endpoints are mounted at /api/export/excel and /api/export/pdf in server.ts

export default router;
