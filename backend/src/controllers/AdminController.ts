import { MIN_PASSWORD_LENGTH } from '../config/env';
import { Response, NextFunction } from 'express';
import bcrypt from 'bcrypt';
import XLSX from 'xlsx';
import { UserRepository } from '../repositories/UserRepository';
import { StudentRepository } from '../repositories/StudentRepository';
import { SubjectRepository } from '../repositories/SubjectRepository';
import { LaboratoryRepository } from '../repositories/LaboratoryRepository';
import { TimetableRepository } from '../repositories/TimetableRepository';
import { AuthenticatedRequest } from '../types';
import { CustomError } from '../middlewares/errorMiddleware';
import { ioEmitter } from '../socket/socket';

export class AdminController {
  private userRepo = new UserRepository();
  private studentRepo = new StudentRepository();
  private subjectRepo = new SubjectRepository();
  private labRepo = new LaboratoryRepository();
  private timetableRepo = new TimetableRepository();

  // --- FACULTY MANAGEMENT ---
  getFaculty = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const users = await this.userRepo.findAll();
      const filtered = users.filter(u => (u.role === 'FACULTY' || u.role === 'ADMIN') && u.isActive);
      return res.status(200).json({ success: true, data: filtered });
    } catch (error) {
      next(error);
    }
  };

  createFaculty = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { employeeId, firstName, lastName, email, phone, password, department, designation, role } = req.body;

      const existingUser = await this.userRepo.findByEmployeeId(employeeId);
      if (existingUser) {
        const err: CustomError = new Error('User with this Employee ID already exists.');
        err.statusCode = 400;
        throw err;
      }

      if (typeof password !== 'string' || password.length < MIN_PASSWORD_LENGTH) {
        const err: CustomError = new Error(`Password is required and must be at least ${MIN_PASSWORD_LENGTH} characters.`);
        err.statusCode = 400;
        throw err;
      }
      const hashedPassword = await bcrypt.hash(password, 10);
      const user = await this.userRepo.create({
        employeeId,
        firstName,
        lastName,
        email,
        phone,
        password: hashedPassword,
        role: role || 'FACULTY',
        department,
        designation,
        isActive: true
      });

      return res.status(201).json({
        success: true,
        message: `${role === 'ADMIN' ? 'Administrator' : 'Faculty'} created successfully.`,
        data: user
      });
    } catch (error) {
      next(error);
    }
  };

  updateFaculty = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const data = { ...req.body };
      
      // If updating password, hash it
      if (data.password) {
        data.password = await bcrypt.hash(data.password, 10);
      } else {
        delete data.password;
      }

      const updated = await this.userRepo.update(id, data);
      if (!updated) {
        const err: CustomError = new Error('Faculty not found.');
        err.statusCode = 404;
        throw err;
      }

      return res.status(200).json({
        success: true,
        message: 'Faculty updated successfully.',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  };

  deleteFaculty = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      
      if (id === req.user?.userId) {
        const err: CustomError = new Error('You cannot deactivate your own administrator account.');
        err.statusCode = 400;
        throw err;
      }

      const deleted = await this.userRepo.softDelete(id);
      if (!deleted) {
        const err: CustomError = new Error('User not found.');
        err.statusCode = 404;
        throw err;
      }
      return res.status(200).json({
        success: true,
        message: 'User deactivated successfully.'
      });
    } catch (error) {
      next(error);
    }
  };

  // --- STUDENT MANAGEMENT ---
  getStudents = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { year, section } = req.query;
      const filter: any = { isActive: true };
      if (year) filter.year = Number(year);
      if (section) filter.section = String(section).toUpperCase();

      const students = await this.studentRepo.findAll(filter);
      return res.status(200).json({ success: true, data: students });
    } catch (error) {
      next(error);
    }
  };

  updateStudent = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updated = await this.studentRepo.update(id, req.body);
      if (!updated) {
        const err: CustomError = new Error('Student not found.');
        err.statusCode = 404;
        throw err;
      }
      return res.status(200).json({
        success: true,
        message: 'Student updated successfully.',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  };

  deleteStudent = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const deleted = await this.studentRepo.softDelete(id);
      if (!deleted) {
        const err: CustomError = new Error('Student not found.');
        err.statusCode = 404;
        throw err;
      }
      return res.status(200).json({
        success: true,
        message: 'Student deactivated successfully.'
      });
    } catch (error) {
      next(error);
    }
  };

  importStudents = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { year, department, regulation, admissionYear } = req.body;
      
      if (!req.file) {
        const err: CustomError = new Error('Please upload an Excel file.');
        err.statusCode = 400;
        throw err;
      }

      if (!year || !department || !regulation || !admissionYear) {
        const err: CustomError = new Error('Missing selection details (year, department, regulation, admissionYear).');
        err.statusCode = 400;
        throw err;
      }

      const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const rows = XLSX.utils.sheet_to_json<any>(sheet);

      let imported = 0;
      let skipped = 0;
      const skipReasons: string[] = [];
      const studentRecords: any[] = [];

      for (const row of rows) {
        const rollNumber = String(row['Roll_Number'] || row['Roll Number'] || row['rollNumber'] || row['RollNo'] || '').trim().toUpperCase();
        const studentName = String(row['Name'] || row['Student Name'] || row['studentName'] || '').trim();
        const section = String(row['Section'] || row['section'] || 'A').trim().toUpperCase();

        if (!rollNumber || !studentName) {
          skipped++;
          skipReasons.push(`Row missing roll number or name.`);
          continue;
        }

        // Split name into first and last
        const nameParts = studentName.split(' ');
        const firstName = nameParts[0] || 'Student';
        const lastName = nameParts.slice(1).join(' ') || 'Name';

        studentRecords.push({
          rollNumber,
          firstName,
          lastName,
          fullName: studentName,
          section,
          year: Number(year),
          semester: 1, // Default to 1 as semester is removed from students
          department,
          regulation,
          admissionYear: Number(admissionYear),
          isActive: true
        });
      }

      if (studentRecords.length > 0) {
        // Bulk upsert logic
        await this.studentRepo.bulkUpsert(studentRecords);
        imported = studentRecords.length;
      }

      return res.status(200).json({
        success: true,
        message: `Import process finished.`,
        data: {
          totalRecords: rows.length,
          imported,
          skipped,
          reasons: skipReasons.slice(0, 5) // return first 5 skipped reasons
        }
      });
    } catch (error) {
      next(error);
    }
  };

  importRawStudents = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { studentRecords } = req.body;
      if (!Array.isArray(studentRecords) || studentRecords.length === 0) {
        const err: CustomError = new Error('No valid student records provided.');
        err.statusCode = 400;
        throw err;
      }

      await this.studentRepo.bulkUpsert(studentRecords);

      return res.status(200).json({
        success: true,
        message: `Custom list containing ${studentRecords.length} students processed successfully.`
      });
    } catch (error) {
      next(error);
    }
  };

  // --- SUBJECT MANAGEMENT ---
  getSubjects = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const subjects = await this.subjectRepo.findAll({ isActive: true });
      return res.status(200).json({ success: true, data: subjects });
    } catch (error) {
      next(error);
    }
  };

  createSubject = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { subjectCode, subjectName, shortName, year, semester, department, isLaboratory, credits } = req.body;
      
      const existing = await this.subjectRepo.findByCode(subjectCode);
      if (existing) {
        const err: CustomError = new Error('Subject with this Code already exists.');
        err.statusCode = 400;
        throw err;
      }

      const subject = await this.subjectRepo.create({
        subjectCode,
        subjectName,
        shortName,
        year: Number(year),
        semester: Number(semester),
        department,
        isLaboratory: Boolean(isLaboratory),
        credits: Number(credits),
        isActive: true
      });

      return res.status(201).json({ success: true, message: 'Subject created.', data: subject });
    } catch (error) {
      next(error);
    }
  };

  updateSubject = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updated = await this.subjectRepo.update(id, req.body);
      if (!updated) {
        const err: CustomError = new Error('Subject not found.');
        err.statusCode = 404;
        throw err;
      }
      return res.status(200).json({ success: true, message: 'Subject updated.', data: updated });
    } catch (error) {
      next(error);
    }
  };

  deleteSubject = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const deleted = await this.subjectRepo.softDelete(id);
      if (!deleted) {
        const err: CustomError = new Error('Subject not found.');
        err.statusCode = 404;
        throw err;
      }
      return res.status(200).json({ success: true, message: 'Subject deactivated successfully.' });
    } catch (error) {
      next(error);
    }
  };

  // --- LABORATORY MANAGEMENT ---
  getLaboratories = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const labs = await this.labRepo.findAll({ isActive: true });
      return res.status(200).json({ success: true, data: labs });
    } catch (error) {
      next(error);
    }
  };

  createLaboratory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { laboratoryCode, laboratoryName, building, floor, capacity } = req.body;

      const existing = await this.labRepo.findByCode(laboratoryCode);
      if (existing) {
        const err: CustomError = new Error('Laboratory with this Code already exists.');
        err.statusCode = 400;
        throw err;
      }

      const lab = await this.labRepo.create({
        laboratoryCode,
        laboratoryName,
        building,
        floor,
        capacity: Number(capacity),
        isActive: true
      });

      return res.status(201).json({ success: true, message: 'Laboratory created.', data: lab });
    } catch (error) {
      next(error);
    }
  };

  updateLaboratory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updated = await this.labRepo.update(id, req.body);
      if (!updated) {
        const err: CustomError = new Error('Laboratory not found.');
        err.statusCode = 404;
        throw err;
      }
      return res.status(200).json({ success: true, message: 'Laboratory updated.', data: updated });
    } catch (error) {
      next(error);
    }
  };

  deleteLaboratory = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const deleted = await this.labRepo.softDelete(id);
      if (!deleted) {
        const err: CustomError = new Error('Laboratory not found.');
        err.statusCode = 404;
        throw err;
      }
      return res.status(200).json({ success: true, message: 'Laboratory deactivated successfully.' });
    } catch (error) {
      next(error);
    }
  };

  // --- TIMETABLE MANAGEMENT ---
  getTimetable = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const schedule = await this.timetableRepo.findAll({ isActive: true });
      return res.status(200).json({ success: true, data: schedule });
    } catch (error) {
      next(error);
    }
  };

  createTimetable = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const timetable = await this.timetableRepo.create(req.body);
      ioEmitter.emitTimetableUpdated();
      return res.status(201).json({ success: true, message: 'Timetable entry created.', data: timetable });
    } catch (error) {
      next(error);
    }
  };

  updateTimetable = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const updated = await this.timetableRepo.update(id, req.body);
      if (!updated) {
        const err: CustomError = new Error('Timetable entry not found.');
        err.statusCode = 404;
        throw err;
      }
      ioEmitter.emitTimetableUpdated();
      return res.status(200).json({ success: true, message: 'Timetable entry updated.', data: updated });
    } catch (error) {
      next(error);
    }
  };

  deleteTimetable = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const deleted = await this.timetableRepo.delete(id);
      if (!deleted) {
        const err: CustomError = new Error('Timetable entry not found.');
        err.statusCode = 404;
        throw err;
      }
      ioEmitter.emitTimetableUpdated();
      return res.status(200).json({ success: true, message: 'Timetable entry deleted.' });
    } catch (error) {
      next(error);
    }
  };
}
