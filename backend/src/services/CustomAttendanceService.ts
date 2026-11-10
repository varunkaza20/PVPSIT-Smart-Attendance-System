import { Types } from 'mongoose';
import { CustomAttendanceRepository } from '../repositories/CustomAttendanceRepository';
import { ICustomAttendanceSession } from '../models/CustomAttendanceSession';
import { IAttendanceRecord } from '../models/AttendanceSession';
import { Student } from '../models/Student';
import { CustomError } from '../middlewares/errorMiddleware';
import { ioEmitter } from '../socket/socket';

export class CustomAttendanceService {
  private customRepo = new CustomAttendanceRepository();

  private async generateSessionCode(): Promise<string> {
    const currentYear = new Date().getFullYear().toString();
    const latestCode = await this.customRepo.findLatestSessionCode(currentYear);
    
    let nextNum = 1;
    if (latestCode) {
      const parts = latestCode.split('-');
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1;
      }
    }
    
    const paddedNum = nextNum.toString().padStart(6, '0');
    return `CUS-${currentYear}-${paddedNum}`;
  }

  async startSession(
    facultyId: string,
    sessionTitle: string,
    venue: string,
    description: string,
    eventDate: Date,
    studentRoster: { rollNumber: string; studentName: string }[],
    academicYear?: string,
    year?: number,
    semester?: number,
    section?: string
  ): Promise<ICustomAttendanceSession> {
    // Check if faculty already has an active custom session
    const activeSession = await this.customRepo.findActiveByFaculty(facultyId);
    if (activeSession) {
      const err: CustomError = new Error('You already have an active custom attendance session.');
      err.statusCode = 400;
      throw err;
    }

    if (!studentRoster || studentRoster.length === 0) {
      const err: CustomError = new Error('A student roster is required to start a custom session.');
      err.statusCode = 400;
      throw err;
    }

    const rollNumbers = studentRoster.map((s) => s.rollNumber.toUpperCase());
    const dbStudents = await Student.find({ rollNumber: { $in: rollNumbers } });

    const attendanceRecords: IAttendanceRecord[] = studentRoster.map((student) => {
      const dbStudent = dbStudents.find(
        (s) => s.rollNumber.toUpperCase() === student.rollNumber.toUpperCase()
      );
      return {
        studentId: dbStudent ? dbStudent._id as any : undefined,
        rollNumber: student.rollNumber.toUpperCase(),
        studentName: student.studentName,
        status: 'ABSENT',
        scans: [],
        totalAwayMinutes: 0
      };
    });

    const sessionCode = await this.generateSessionCode();

    const session = await this.customRepo.create({
      sessionCode,
      sessionTitle,
      description,
      facultyId: facultyId as any,
      venue,
      eventDate: new Date(eventDate),
      totalStudents: studentRoster.length,
      startTime: new Date(),
      sessionStatus: 'ACTIVE',
      academicYear,
      year,
      semester,
      section,
      attendance: attendanceRecords
    });

    const populated = await this.customRepo.findById(session._id.toString());
    if (populated) {
      ioEmitter.emitSessionStarted(populated._id.toString(), populated);
      return populated;
    }

    return session;
  }

  async getActiveSession(facultyId: string): Promise<ICustomAttendanceSession | null> {
    return this.customRepo.findActiveByFaculty(facultyId);
  }

  async processScan(sessionId: string, rollNumber: string): Promise<any> {
    const session = await this.customRepo.findById(sessionId);
    if (!session) {
      const err: CustomError = new Error('Custom attendance session not found.');
      err.statusCode = 404;
      throw err;
    }

    if (session.sessionStatus !== 'ACTIVE') {
      const err: CustomError = new Error(`Cannot scan: session is already ${session.sessionStatus.toLowerCase()}.`);
      err.statusCode = 400;
      throw err;
    }

    const studentRecord = session.attendance.find(
      (r) => r.rollNumber.toUpperCase() === rollNumber.toUpperCase()
    );

    if (!studentRecord) {
      // For custom attendance, we do not throw error if student is not found,
      // or we can reject. The rules say "Student not in session -> Reject scan".
      // Wait, let's reject scan but log it in the movements log
      const timestamp = new Date();
      ioEmitter.emitMovementUpdated(sessionId, {
        timestamp,
        rollNumber,
        studentName: 'Unknown Student',
        logMessage: `Unknown Barcode scanned: ${rollNumber}`
      });

      const err: CustomError = new Error('Student not found in this custom session roster.');
      err.statusCode = 404;
      throw err;
    }

    const timestamp = new Date();

    // 5-second cooldown check to prevent accidental double-scanning
    const lastScan = studentRecord.scans[studentRecord.scans.length - 1];
    if (lastScan) {
      const timeDiffMs = timestamp.getTime() - new Date(lastScan.timestamp).getTime();
      if (timeDiffMs < 5 * 1000) {
        const remainingSecs = Math.ceil((5 * 1000 - timeDiffMs) / 1000);
        const err: CustomError = new Error(`Double-scan prevented. Cooldown active. Try again in ${remainingSecs}s.`);
        err.statusCode = 429;
        throw err;
      }
    }

    let oldStatus = studentRecord.status;
    let newStatus: 'PRESENT' | 'AWAY' = 'PRESENT';
    let logMessage = '';

    if (oldStatus === 'ABSENT') {
      newStatus = 'PRESENT';
      studentRecord.status = 'PRESENT';
      studentRecord.scans.push({ action: 'IN', timestamp });
      logMessage = 'Entered session';
    } else if (oldStatus === 'PRESENT') {
      newStatus = 'AWAY';
      studentRecord.status = 'AWAY';
      studentRecord.scans.push({ action: 'OUT', timestamp });
      logMessage = 'Left session';
    } else if (oldStatus === 'AWAY') {
      newStatus = 'PRESENT';
      studentRecord.status = 'PRESENT';
      studentRecord.scans.push({ action: 'IN', timestamp });

      const scansCount = studentRecord.scans.length;
      if (scansCount >= 2) {
        const outScan = studentRecord.scans[scansCount - 2];
        const diffMs = timestamp.getTime() - outScan.timestamp.getTime();
        const diffMins = Math.round(diffMs / (1000 * 60));
        studentRecord.totalAwayMinutes += diffMins;
        logMessage = `Returned (Away duration: ${diffMins} min)`;
      } else {
        logMessage = 'Returned';
      }
    }

    await session.save();

    const stats = this.calculateStats(session);

    ioEmitter.emitStudentScanned(sessionId, {
      studentId: '',
      rollNumber: studentRecord.rollNumber,
      studentName: studentRecord.studentName,
      status: studentRecord.status,
      scans: studentRecord.scans,
      totalAwayMinutes: studentRecord.totalAwayMinutes,
      lastScanTime: timestamp
    });

    ioEmitter.emitStatsUpdated(sessionId, stats);

    ioEmitter.emitMovementUpdated(sessionId, {
      timestamp,
      rollNumber: studentRecord.rollNumber,
      studentName: studentRecord.studentName,
      logMessage
    });

    return {
      success: true,
      student: studentRecord,
      stats
    };
  }

  async endSession(sessionId: string): Promise<any> {
    const session = await this.customRepo.findById(sessionId);
    if (!session) {
      const err: CustomError = new Error('Custom attendance session not found.');
      err.statusCode = 404;
      throw err;
    }

    if (session.sessionStatus === 'COMPLETED') {
      const err: CustomError = new Error('Custom session is already completed.');
      err.statusCode = 400;
      throw err;
    }

    const awayStudents = session.attendance.filter((r) => r.status === 'AWAY');

    if (awayStudents.length > 0) {
      session.sessionStatus = 'ENDING';
      await session.save();

      ioEmitter.emitSessionEnding(sessionId);

      return {
        needsReview: true,
        awayStudents: awayStudents.map((s) => ({
          rollNumber: s.rollNumber,
          studentName: s.studentName,
          totalAwayMinutes: s.totalAwayMinutes
        }))
      };
    }

    return this.finalizeSession(sessionId, []);
  }

  async finalizeSession(
    sessionId: string,
    reviewDecisions: { rollNumber: string; finalDecision: 'PRESENT' | 'ABSENT' }[]
  ): Promise<ICustomAttendanceSession> {
    const session = await this.customRepo.findById(sessionId);
    if (!session) {
      const err: CustomError = new Error('Custom attendance session not found.');
      err.statusCode = 404;
      throw err;
    }

    if (session.sessionStatus === 'COMPLETED') {
      const err: CustomError = new Error('Custom session is already completed.');
      err.statusCode = 400;
      throw err;
    }

    session.attendance.forEach((record) => {
      const decision = reviewDecisions.find(
        (d) => d.rollNumber.toUpperCase() === record.rollNumber.toUpperCase()
      );

      if (decision) {
        record.finalDecision = decision.finalDecision;
        record.status = decision.finalDecision;
      } else {
        if (record.status === 'PRESENT') {
          record.finalDecision = 'PRESENT';
        } else if (record.status === 'ABSENT') {
          record.finalDecision = 'ABSENT';
        } else if (record.status === 'AWAY') {
          record.finalDecision = 'ABSENT';
          record.status = 'ABSENT';
        }
      }
    });

    session.sessionStatus = 'COMPLETED';
    session.endTime = new Date();

    await session.save();

    ioEmitter.emitSessionCompleted(sessionId, session);

    return session;
  }

  private calculateStats(session: ICustomAttendanceSession) {
    let present = 0;
    let absent = 0;
    let away = 0;

    session.attendance.forEach((r) => {
      if (r.status === 'PRESENT') present++;
      else if (r.status === 'ABSENT') absent++;
      else if (r.status === 'AWAY') away++;
    });

    return {
      total: session.totalStudents,
      present,
      absent,
      away
    };
  }

  async getSessions(query: any, user: { userId: string; role: string }): Promise<any[]> {
    const filter: any = {};
    
    if (user.role !== 'ADMIN') {
      filter.facultyId = new Types.ObjectId(user.userId);
    } else if (query.faculty) {
      filter.facultyId = new Types.ObjectId(query.faculty);
    }

    if (query.date) {
      const startOfDay = new Date(query.date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(query.date);
      endOfDay.setHours(23, 59, 59, 999);
      filter.eventDate = { $gte: startOfDay, $lte: endOfDay };
    }

    if (query.academicYear) {
      filter.academicYear = query.academicYear;
    }
    if (query.year) {
      filter.year = Number(query.year);
    }
    if (query.semester) {
      filter.semester = Number(query.semester);
    }
    if (query.section) {
      filter.section = query.section.toUpperCase();
    }

    return this.customRepo.findSummaryAll(filter, query);
  }

  async getSessionDetails(sessionId: string): Promise<any | null> {
    const session = await this.customRepo.findById(sessionId);
    if (!session) return null;

    const rollNumbers = session.attendance.map((r) => r.rollNumber.toUpperCase());
    const dbStudents = await Student.find({ rollNumber: { $in: rollNumbers } });

    const attendanceWithSection = session.attendance.map((record) => {
      const dbStudent = dbStudents.find(
        (s) => s.rollNumber.toUpperCase() === record.rollNumber.toUpperCase()
      );
      const rawRecord = typeof (record as any).toObject === 'function' 
        ? (record as any).toObject() 
        : record;
      return {
        ...rawRecord,
        section: dbStudent ? dbStudent.section : 'N/A'
      };
    });

    return {
      ...session.toObject(),
      attendance: attendanceWithSection
    };
  }

  async deleteSession(sessionId: string, userId: string, userRole: string): Promise<any> {
    const session = await this.customRepo.findById(sessionId);
    if (!session) {
      const err: CustomError = new Error('Custom attendance session not found.');
      err.statusCode = 404;
      throw err;
    }

    if (userRole !== 'ADMIN' && session.facultyId._id.toString() !== userId) {
      const err: CustomError = new Error('Forbidden. Access restricted to session owner.');
      err.statusCode = 403;
      throw err;
    }

    const { CustomAttendanceSession: Model } = require('../models/CustomAttendanceSession');
    await Model.findByIdAndDelete(sessionId);
    return { success: true, message: 'Custom attendance session permanently deleted.' };
  }

  async updateStudentStatus(
    sessionId: string,
    rollNumber: string,
    newStatus: 'PRESENT' | 'ABSENT',
    reason: string,
    editedBy: string
  ): Promise<ICustomAttendanceSession> {
    const session = await this.customRepo.findById(sessionId);
    if (!session) {
      const err: CustomError = new Error('Custom attendance session not found.');
      err.statusCode = 404;
      throw err;
    }

    const record = session.attendance.find(
      (r) => r.rollNumber.toUpperCase() === rollNumber.toUpperCase()
    );
    if (!record) {
      const err: CustomError = new Error('Student not found in this custom session.');
      err.statusCode = 404;
      throw err;
    }

    record.status = newStatus;
    record.finalDecision = newStatus;

    await session.save();
    return session;
  }
}
