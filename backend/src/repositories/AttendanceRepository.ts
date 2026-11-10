import { AttendanceSession, IAttendanceSession } from '../models/AttendanceSession';

export class AttendanceRepository {
  async findById(id: string): Promise<IAttendanceSession | null> {
    return AttendanceSession.findById(id)
      .populate('facultyId', 'employeeId firstName lastName fullName department')
      .populate('subjectId')
      .populate('laboratoryId')
      .populate('timetableId');
  }

  async findActiveByFaculty(facultyId: string): Promise<IAttendanceSession | null> {
    return AttendanceSession.findOne({
      facultyId,
      sessionStatus: { $in: ['ACTIVE', 'ENDING'] }
    })
      .populate('facultyId', 'employeeId firstName lastName fullName department')
      .populate('subjectId')
      .populate('laboratoryId')
      .populate('timetableId');
  }

  async findLatestSessionCode(yearPrefix: string): Promise<string | null> {
    // Look for codes matching REG-YYYY-******
    const regex = new RegExp(`^REG-${yearPrefix}-\\d{6}$`);
    const latestSession = await AttendanceSession.findOne({ sessionCode: regex })
      .sort({ sessionCode: -1 })
      .select('sessionCode')
      .lean();
    return latestSession ? latestSession.sessionCode : null;
  }

  async create(sessionData: Partial<IAttendanceSession>): Promise<IAttendanceSession> {
    const session = new AttendanceSession(sessionData);
    return session.save();
  }

  async save(session: IAttendanceSession): Promise<IAttendanceSession> {
    return session.save();
  }

  async findAll(query: any = {}): Promise<IAttendanceSession[]> {
    return AttendanceSession.find(query)
      .populate('facultyId', 'employeeId firstName lastName fullName department')
      .populate('subjectId')
      .populate('laboratoryId')
      .sort({ startTime: -1 });
  }
}
