import { Router } from 'express';
import multer from 'multer';
import { AdminController } from '../controllers/AdminController';
import { BlockListController } from '../controllers/BlockListController';
import { authenticateJWT, authorizeAdmin } from '../middlewares/authMiddleware';
import { validateFields } from '../middlewares/validationMiddleware';

const router = Router();
const controller = new AdminController();
const blockList = new BlockListController();
const upload = multer({ storage: multer.memoryStorage() });

// Protect all routes under this admin router
router.use(authenticateJWT);
router.use(authorizeAdmin);

// Faculty Management
router.get('/faculty', controller.getFaculty);
router.post('/faculty', validateFields(['employeeId', 'firstName', 'lastName', 'email', 'password', 'department', 'designation']), controller.createFaculty);
router.put('/faculty/:id', controller.updateFaculty);
router.delete('/faculty/:id', controller.deleteFaculty);

// Student Management
router.get('/students', controller.getStudents);
router.put('/students/:id', controller.updateStudent);
router.delete('/students/:id', controller.deleteStudent);
router.post('/students/import', upload.single('file'), controller.importStudents);
router.post('/students/import-raw', validateFields(['studentRecords']), controller.importRawStudents);

// Block list (roll numbers that are not allowed to scan)
router.get('/blocklist', blockList.list);
router.post('/blocklist', validateFields(['rollNumbers']), blockList.add);
router.post('/blocklist/import', upload.single('file'), blockList.importExcel);
router.delete('/blocklist', blockList.removeAll);
router.delete('/blocklist/:id', blockList.remove);

// Subject Management
router.get('/subjects', controller.getSubjects);
router.post('/subjects', validateFields(['subjectCode', 'subjectName', 'shortName', 'year', 'semester', 'department', 'credits']), controller.createSubject);
router.put('/subjects/:id', controller.updateSubject);
router.delete('/subjects/:id', controller.deleteSubject);

// Laboratory Management
router.get('/laboratories', controller.getLaboratories);
router.post('/laboratories', validateFields(['laboratoryCode', 'laboratoryName', 'building', 'floor', 'capacity']), controller.createLaboratory);
router.put('/laboratories/:id', controller.updateLaboratory);
router.delete('/laboratories/:id', controller.deleteLaboratory);

// Timetable Management
router.get('/timetable', controller.getTimetable);
router.post('/timetable', validateFields(['academicYear', 'year', 'semester', 'section', 'facultyId', 'subjectId', 'dayOfWeek', 'startTime', 'endTime', 'duration']), controller.createTimetable);
router.put('/timetable/:id', controller.updateTimetable);
router.delete('/timetable/:id', controller.deleteTimetable);

export default router;
