import { Response, NextFunction } from 'express';
import { CustomAttendanceService } from '../services/CustomAttendanceService';
import { AuthenticatedRequest } from '../types';
import { CustomError } from '../middlewares/errorMiddleware';

export class CustomAttendanceController {
  private customService = new CustomAttendanceService();

  startSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const facultyId = req.user?.userId;
      if (!facultyId) {
        const err: CustomError = new Error('Unauthorized.');
        err.statusCode = 401;
        throw err;
      }

      const { sessionTitle, venue, description, eventDate, studentRoster, academicYear, year, semester, section } = req.body;
      const session = await this.customService.startSession(
        facultyId,
        sessionTitle,
        venue,
        description,
        eventDate,
        studentRoster,
        academicYear,
        year ? Number(year) : undefined,
        semester ? Number(semester) : undefined,
        section
      );

      return res.status(201).json({
        success: true,
        message: 'Custom attendance session started successfully.',
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

      const session = await this.customService.getActiveSession(facultyId);
      return res.status(200).json({
        success: true,
        data: session
      });
    } catch (error) {
      next(error);
    }
  };

  processScan = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { sessionId, rollNumber } = req.body;
      const result = await this.customService.processScan(sessionId, rollNumber);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  endSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { sessionId } = req.body;
      const result = await this.customService.endSession(sessionId);
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
      const { sessionId, reviewDecisions } = req.body;
      const session = await this.customService.finalizeSession(sessionId, reviewDecisions || []);
      return res.status(200).json({
        success: true,
        message: 'Custom attendance session finalized successfully.',
        data: session
      });
    } catch (error) {
      next(error);
    }
  };

  getSessions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const user = { userId: req.user?.userId || '', role: req.user?.role || '' };
      const sessions = await this.customService.getSessions(req.query, user);
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
      const { id } = req.params;
      const session = await this.customService.getSessionDetails(id);
      if (!session) {
        const err: CustomError = new Error('Custom session not found.');
        err.statusCode = 404;
        throw err;
      }
      return res.status(200).json({
        success: true,
        data: session
      });
    } catch (error) {
      next(error);
    }
  };

  deleteSession = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id } = req.params;
      const userId = req.user?.userId || '';
      const userRole = req.user?.role || '';
      const result = await this.customService.deleteSession(id, userId, userRole);
      return res.status(200).json(result);
    } catch (error) {
      next(error);
    }
  };

  updateStudentStatus = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { id, rollNumber } = req.params;
      const { newStatus, reason } = req.body;
      const editedBy = req.user?.userId || '';
      const session = await this.customService.updateStudentStatus(id, rollNumber, newStatus, reason, editedBy);
      return res.status(200).json({
        success: true,
        message: 'Attendance record updated successfully.',
        data: session
      });
    } catch (error) {
      next(error);
    }
  };
}
