import { Response, NextFunction } from 'express';
import { AttendanceService } from '../services/AttendanceService';
import { AuthenticatedRequest } from '../types';
import { CustomError } from '../middlewares/errorMiddleware';

export class AttendanceController {
  private attendanceService = new AttendanceService();

  startSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const facultyId = req.user?.userId;
      if (!facultyId) {
        const err: CustomError = new Error('Unauthorized.');
        err.statusCode = 401;
        throw err;
      }

      const { year, semester, section, timetableId } = req.body;
      const session = await this.attendanceService.startSession(
        facultyId,
        Number(year),
        Number(semester),
        section,
        timetableId
      );

      return res.status(201).json({
        success: true,
        message: 'Attendance session started successfully.',
        data: session
      });
    } catch (error) {
      next(error);
    }
  };

  getActiveSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const facultyId = req.user?.userId;
      if (!facultyId) {
        const err: CustomError = new Error('Unauthorized.');
        err.statusCode = 401;
        throw err;
      }

      const session = await this.attendanceService.getActiveSession(facultyId);
      return res.status(200).json({
        success: true,
        data: session // will be null if no active session
      });
    } catch (error) {
      next(error);
    }
  };

  processScan = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { sessionId, rollNumber } = req.body;
      const result = await this.attendanceService.processScan(sessionId, rollNumber);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  endSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.body;
      const result = await this.attendanceService.endSession(sessionId);
      return res.status(200).json({
        success: true,
        ...result
      });
    } catch (error) {
      next(error);
    }
  };

  finalizeSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { sessionId, reviewDecisions } = req.body; // array of { rollNumber, finalDecision }
      const session = await this.attendanceService.finalizeSession(sessionId, reviewDecisions || []);
      return res.status(200).json({
        success: true,
        message: 'Attendance session completed and locked successfully.',
        data: session
      });
    } catch (error) {
      next(error);
    }
  };

  getSessions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      if (!user) {
        const err: CustomError = new Error('Unauthorized.');
        err.statusCode = 401;
        throw err;
      }
      
      const sessions = await this.attendanceService.getSessions(req.query, user);
      return res.status(200).json({
        success: true,
        data: sessions
      });
    } catch (error) {
      next(error);
    }
  };

  getSessionDetails = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      const { sessionId } = req.params;
      if (!user) {
        const err: CustomError = new Error('Unauthorized.');
        err.statusCode = 401;
        throw err;
      }

      const session = await this.attendanceService.getSessionDetails(sessionId, user);
      return res.status(200).json({
        success: true,
        data: session
      });
    } catch (error) {
      next(error);
    }
  };

  updateStudentAttendance = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      const { sessionId, studentId } = req.params;
      const { newStatus, reason } = req.body;

      if (!user) {
        const err: CustomError = new Error('Unauthorized.');
        err.statusCode = 401;
        throw err;
      }

      if (!newStatus || !reason) {
        const err: CustomError = new Error('New status and edit reason are required.');
        err.statusCode = 400;
        throw err;
      }

      const updated = await this.attendanceService.updateStudentAttendance(
        sessionId,
        studentId,
        newStatus,
        reason,
        user.userId,
        user.role
      );

      return res.status(200).json({
        success: true,
        message: 'Student attendance updated successfully.',
        data: updated
      });
    } catch (error) {
      next(error);
    }
  };

  deleteSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = req.user;
      const { sessionId } = req.params;

      if (!user) {
        const err: CustomError = new Error('Unauthorized.');
        err.statusCode = 401;
        throw err;
      }

      const result = await this.attendanceService.deleteSession(sessionId, user.userId, user.role);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };
}
