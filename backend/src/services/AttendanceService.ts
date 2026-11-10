import { Types } from 'mongoose';
import { AttendanceRepository } from '../repositories/AttendanceRepository';
import { StudentRepository } from '../repositories/StudentRepository';
import { TimetableRepository } from '../repositories/TimetableRepository';
import { AttendanceSession, IAttendanceSession, IAttendanceRecord, IScan } from '../models/AttendanceSession';
import { CustomError } from '../middlewares/errorMiddleware';
import { ioEmitter } from '../socket/socket';

const getAcademicYear = (date: Date = new Date()): string => {
  const year = date.getFullYear();
  const month = date.getMonth(); // 0-indexed (5 = June)
  const startYear = month >= 5 ? year : year - 1;
  const endYearShort = String(startYear + 1).slice(2);
  return `${startYear}-${endYearShort}`;
};

export class AttendanceService {
  private attendanceRepo = new AttendanceRepository();
  private studentRepo = new StudentRepository();
  private timetableRepo = new TimetableRepository();

  private async generateSessionCode(): Promise<string> {
    const currentYear = new Date().getFullYear().toString();
    const latestCode = await this.attendanceRepo.findLatestSessionCode(currentYear);
    
    let nextNum = 1;
    if (latestCode) {
      const parts = latestCode.split('-');
      const lastNum = parseInt(parts[parts.length - 1], 10);
      if (!isNaN(lastNum)) {
        nextNum = lastNum + 1;
      }
    }
    
    const paddedNum = nextNum.toString().padStart(6, '0');
    return `REG-${currentYear}-${paddedNum}`;
  }

  async startSession(
    facultyId: string,
    year: number,
    semester: number,
    section: string,
    timetableId: string
  ): Promise<IAttendanceSession> {
    // Check if faculty already has an active session
    const activeSession = await this.attendanceRepo.findActiveByFaculty(facultyId);
    if (activeSession) {
      const err: CustomError = new Error('You already have an active attendance session.');
      err.statusCode = 400;
      throw err;
    }

    // Verify timetable entry
    const timetable = await this.timetableRepo.findById(timetableId);
    if (!timetable) {
      const err: CustomError = new Error('Invalid timetable slot.');
      err.statusCode = 400;
      throw err;
    }

    // Load active students for this year, semester, section
    const students = await this.studentRepo.findBySection(year, semester, section);
    if (students.length === 0) {
      const err: CustomError = new Error(`No active students found in Year ${year}, Sem ${semester}, Sec ${section}.`);
      err.statusCode = 404;
      throw err;
    }

    // Initialize attendance records: all ABSENT
    const attendanceRecords: IAttendanceRecord[] = students.map((student) => ({
      studentId: student._id as any,
      rollNumber: student.rollNumber,
      studentName: student.fullName,
      status: 'ABSENT',
      scans: [],
      totalAwayMinutes: 0
    }));

    const sessionCode = await this.generateSessionCode();
    const now = new Date();
    const localDateStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    const sessionDate = new Date(localDateStr);

    const session = await this.attendanceRepo.create({
      sessionCode,
      sessionType: 'REGULAR',
      facultyId: facultyId as any,
      subjectId: timetable.subjectId as any,
      laboratoryId: timetable.laboratoryId ? (timetable.laboratoryId as any) : undefined,
      timetableId: timetable._id as any,
      academicYear: getAcademicYear(),
      year,
      semester,
      section,
      sessionDate,
      totalStudents: students.length,
      startTime: new Date(),
      sessionStatus: 'ACTIVE',
      attendance: attendanceRecords
    });

    // Populate references before returning
    const populated = await this.attendanceRepo.findById(session._id.toString());
    
    // Broadcast via socket (optional room setup is triggered on connect, but we notify room)
    if (populated) {
      ioEmitter.emitSessionStarted(populated._id.toString(), populated);
      return populated;
    }

    return session;
  }

  async getActiveSession(facultyId: string): Promise<IAttendanceSession | null> {
    return this.attendanceRepo.findActiveByFaculty(facultyId);
  }

  async processScan(sessionId: string, rollNumber: string): Promise<any> {
    const session = await this.attendanceRepo.findById(sessionId);
    if (!session) {
      const err: CustomError = new Error('Attendance session not found.');
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
      // Create unknown scanner movement log event, but do not throw 500. Return message
      const timestamp = new Date();
      ioEmitter.emitMovementUpdated(sessionId, {
        timestamp,
        rollNumber,
        studentName: 'Unknown Student',
        logMessage: `Unknown Barcode scanned: ${rollNumber}`
      });
      const err: CustomError = new Error('Student not found in this session roster.');
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
      // Transition: ABSENT -> PRESENT (first scan = IN)
      newStatus = 'PRESENT';
      studentRecord.status = 'PRESENT';
      studentRecord.scans.push({ action: 'IN', timestamp });
      logMessage = 'Entered class';
    } else if (oldStatus === 'PRESENT') {
      // Transition: PRESENT -> AWAY (OUT scan)
      newStatus = 'AWAY';
      studentRecord.status = 'AWAY';
      studentRecord.scans.push({ action: 'OUT', timestamp });
      logMessage = 'Left class';
    } else if (oldStatus === 'AWAY') {
      // Transition: AWAY -> PRESENT (IN scan)
      newStatus = 'PRESENT';
      studentRecord.status = 'PRESENT';
      studentRecord.scans.push({ action: 'IN', timestamp });

      // Calculate away duration
      const scansCount = studentRecord.scans.length;
      if (scansCount >= 2) {
        const outScan = studentRecord.scans[scansCount - 2]; // The OUT scan right before this IN
        const diffMs = timestamp.getTime() - outScan.timestamp.getTime();
        const diffMins = Math.round(diffMs / (1000 * 60));
        studentRecord.totalAwayMinutes += diffMins;
        logMessage = `Returned (Away duration: ${diffMins} min)`;
      } else {
        logMessage = 'Returned';
      }
    }

    await session.save();

    // Compute updated stats
    const stats = this.calculateStats(session);

    // Broadcast Socket.IO updates to room
    ioEmitter.emitStudentScanned(sessionId, {
      studentId: studentRecord.studentId.toString(),
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
    const session = await this.attendanceRepo.findById(sessionId);
    if (!session) {
      const err: CustomError = new Error('Attendance session not found.');
      err.statusCode = 404;
      throw err;
    }

    if (session.sessionStatus === 'COMPLETED') {
      const err: CustomError = new Error('Session is already completed and locked.');
      err.statusCode = 400;
      throw err;
    }

    // Check if there are any AWAY students
    const awayStudents = session.attendance.filter((r) => r.status === 'AWAY');

    if (awayStudents.length > 0) {
      session.sessionStatus = 'ENDING';
      await session.save();

      // Emit sessionEnding state to clients
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

    // No away students - close immediately
    return this.finalizeSession(sessionId, []);
  }

  async finalizeSession(
    sessionId: string,
    reviewDecisions: { rollNumber: string; finalDecision: 'PRESENT' | 'ABSENT' }[]
  ): Promise<IAttendanceSession> {
    const session = await this.attendanceRepo.findById(sessionId);
    if (!session) {
      const err: CustomError = new Error('Attendance session not found.');
      err.statusCode = 404;
      throw err;
    }

    if (session.sessionStatus === 'COMPLETED') {
      const err: CustomError = new Error('Session is already completed.');
      err.statusCode = 400;
      throw err;
    }

    // Process review decisions and finalize all decisions
    session.attendance.forEach((record) => {
      const decision = reviewDecisions.find(
        (d) => d.rollNumber.toUpperCase() === record.rollNumber.toUpperCase()
      );

      if (decision) {
        record.finalDecision = decision.finalDecision;
        record.status = decision.finalDecision; // Force state sync
      } else {
        // Fallback standard final decisions
        if (record.status === 'PRESENT') {
          record.finalDecision = 'PRESENT';
        } else if (record.status === 'ABSENT') {
          record.finalDecision = 'ABSENT';
        } else if (record.status === 'AWAY') {
          // Default Away to ABSENT if no explicit choice made in review
          record.finalDecision = 'ABSENT';
          record.status = 'ABSENT';
        }
      }
    });

    session.sessionStatus = 'COMPLETED';
    session.endTime = new Date();

    await session.save();

    // Broadcast sessionCompletion
    ioEmitter.emitSessionCompleted(sessionId, session);

    return session;
  }

  private calculateStats(session: IAttendanceSession) {
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

  async getSessions(filters: any, user: { userId: string; role: string }): Promise<any[]> {
    const query: any = {};
    const { academicYear, year, semester, section, date, faculty, subject } = filters;

    if (academicYear) query.academicYear = academicYear;
    if (year) query.year = Number(year);
    if (semester) query.semester = Number(semester);
    if (section) query.section = section;
    if (date) {
      const startOfDay = new Date(date);
      startOfDay.setHours(0, 0, 0, 0);
      const endOfDay = new Date(date);
      endOfDay.setHours(23, 59, 59, 999);
      query.sessionDate = { $gte: startOfDay, $lte: endOfDay };
    }
    if (subject) query.subjectId = new Types.ObjectId(subject);

    // Faculty can only query their own
    if (user.role === 'ADMIN') {
      if (faculty) query.facultyId = new Types.ObjectId(faculty);
    } else {
      query.facultyId = new Types.ObjectId(user.userId);
    }

    const aggregatePipeline: any[] = [];

    // Match stage
    aggregatePipeline.push({ $match: query });

    // Look up faculty info
    aggregatePipeline.push({
      $lookup: {
        from: 'users',
        localField: 'facultyId',
        foreignField: '_id',
        as: 'facultyInfo'
      }
    });
    aggregatePipeline.push({
      $unwind: { path: '$facultyInfo', preserveNullAndEmptyArrays: true }
    });

    // Look up subject info
    aggregatePipeline.push({
      $lookup: {
        from: 'subjects',
        localField: 'subjectId',
        foreignField: '_id',
        as: 'subjectInfo'
      }
    });
    aggregatePipeline.push({
      $unwind: { path: '$subjectInfo', preserveNullAndEmptyArrays: true }
    });

    // Look up laboratory info
    aggregatePipeline.push({
      $lookup: {
        from: 'laboratories',
        localField: 'laboratoryId',
        foreignField: '_id',
        as: 'laboratoryInfo'
      }
    });
    aggregatePipeline.push({
      $unwind: { path: '$laboratoryInfo', preserveNullAndEmptyArrays: true }
    });

    // Project stage to include necessary summary fields and calculate presentCount
    aggregatePipeline.push({
      $project: {
        sessionCode: 1,
        sessionType: 1,
        venue: 1,
        startTime: 1,
        endTime: 1,
        academicYear: 1,
        year: 1,
        semester: 1,
        section: 1,
        sessionDate: 1,
        totalStudents: 1,
        sessionStatus: 1,
        facultyId: {
          _id: '$facultyInfo._id',
          employeeId: '$facultyInfo.employeeId',
          firstName: '$facultyInfo.firstName',
          lastName: '$facultyInfo.lastName',
          fullName: '$facultyInfo.fullName',
          department: '$facultyInfo.department'
        },
        subjectId: '$subjectInfo',
        laboratoryId: '$laboratoryInfo',
        presentCount: {
          $size: {
            $filter: {
              input: { $ifNull: ["$attendance", []] },
              as: "att",
              cond: { $eq: ["$$att.status", "PRESENT"] }
            }
          }
        }
      }
    });

    // Add attendancePercentage virtual field for sorting/returning
    aggregatePipeline.push({
      $addFields: {
        attendancePercentage: {
          $cond: {
            if: { $gt: ["$totalStudents", 0] },
            then: { $multiply: [ { $divide: ["$presentCount", "$totalStudents"] }, 100 ] },
            else: 0
          }
        }
      }
    });

    // Sort: Newest First
    aggregatePipeline.push({ $sort: { sessionDate: -1, startTime: -1 } });

    return AttendanceSession.aggregate(aggregatePipeline);
  }

  async getSessionDetails(sessionId: string, user: { userId: string; role: string }) {
    const session = await AttendanceSession.findById(sessionId)
      .populate('facultyId', 'employeeId firstName lastName fullName department')
      .populate('subjectId')
      .populate('laboratoryId');

    if (!session) {
      const err: CustomError = new Error('Attendance session not found.');
      err.statusCode = 404;
      throw err;
    }

    // Role verification
    if (user.role !== 'ADMIN' && session.facultyId._id.toString() !== user.userId) {
      const err: CustomError = new Error('Forbidden. Access restricted to session owner.');
      err.statusCode = 403;
      throw err;
    }

    return session;
  }

  async updateStudentAttendance(
    sessionId: string,
    studentId: string,
    newStatus: 'PRESENT' | 'ABSENT',
    reason: string,
    userId: string,
    userRole: string
  ) {
    const session = await AttendanceSession.findById(sessionId);
    if (!session) {
      const err: CustomError = new Error('Attendance session not found.');
      err.statusCode = 404;
      throw err;
    }

    if (session.sessionStatus === 'ACTIVE') {
      const err: CustomError = new Error('Cannot edit an active session. End the session first.');
      err.statusCode = 400;
      throw err;
    }

    // Role check
    if (userRole !== 'ADMIN' && session.facultyId.toString() !== userId) {
      const err: CustomError = new Error('Forbidden. Access restricted to session owner.');
      err.statusCode = 403;
      throw err;
    }

    const record = session.attendance.find((r) => r.studentId.toString() === studentId);
    if (!record) {
      const err: CustomError = new Error('Student not found in this session roster.');
      err.statusCode = 404;
      throw err;
    }

    const previousStatus = record.status === 'AWAY' ? 'PRESENT' : record.status;
    
    // If status didn't change, return
    if (previousStatus === newStatus && record.status !== 'AWAY') {
      return session;
    }

    // Update status and finalDecision
    record.status = newStatus;
    record.finalDecision = newStatus;

    // Push to editHistory
    session.editHistory.push({
      studentId: studentId as any,
      previousStatus: previousStatus as any,
      newStatus: newStatus as any,
      reason,
      editedBy: userId as any,
      editedAt: new Date()
    });

    session.editedBy = userId as any;
    session.editedAt = new Date();

    // Recalculate totals and save
    await session.save();
    return session;
  }

  async deleteSession(sessionId: string, userId: string, userRole: string) {
    const session = await AttendanceSession.findById(sessionId);
    if (!session) {
      const err: CustomError = new Error('Attendance session not found.');
      err.statusCode = 404;
      throw err;
    }

    // Role check
    if (userRole !== 'ADMIN' && session.facultyId.toString() !== userId) {
      const err: CustomError = new Error('Forbidden. Access restricted to session owner.');
      err.statusCode = 403;
      throw err;
    }

    // Hard Delete
    await AttendanceSession.findByIdAndDelete(sessionId);
    return { success: true, message: 'Attendance session permanently deleted.' };
  }

  async checkAndAutoEndSessions(): Promise<void> {
    try {
      const activeSessions = await AttendanceSession.find({ sessionStatus: 'ACTIVE', sessionType: 'REGULAR' })
        .populate('timetableId');

      const now = new Date();

      for (const session of activeSessions) {
        const timetable = session.timetableId as any;
        if (!timetable) continue;

        // Condition 1: Elapsed duration exceeded
        const elapsedMinutes = (now.getTime() - session.startTime.getTime()) / (60 * 1000);
        const durationExceeded = elapsedMinutes >= timetable.duration;

        // Condition 2: Clock time exceeds slot endTime
        const [hours, minutes] = timetable.endTime.split(':').map(Number);
        const slotEndTime = new Date(now);
        slotEndTime.setHours(hours, minutes, 0, 0);
        const slotTimeExceeded = now >= slotEndTime;

        if (durationExceeded || slotTimeExceeded) {
          console.log(`[Auto-End] Session ${session.sessionCode} has exceeded stipulated time. Auto-finalizing...`);
          await this.finalizeSession(session._id.toString(), []);
        }
      }
    } catch (err) {
      console.error('Error during auto-ending of sessions:', err);
    }
  }
}
