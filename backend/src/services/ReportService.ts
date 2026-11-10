import mongoose, { PipelineStage } from 'mongoose';
import { AttendanceSession } from '../models/AttendanceSession';
import { CustomAttendanceSession } from '../models/CustomAttendanceSession';
import { Subject } from '../models/Subject';
import { Student } from '../models/Student';
import { SettingsRepository } from '../repositories/SettingsRepository';
import { CustomError } from '../middlewares/errorMiddleware';
import { REPORT_PERIODS, ReportPeriod, formatLocalDate, resolveRange } from '../utils/reportPeriod';
import {
  SessionRow,
  buildBreakdown,
  buildDistribution,
  buildSubjectSummary,
  buildTrend,
  percent,
  summarize
} from '../utils/reportAggregation';

const badRequest = (message: string): CustomError => {
  const err: CustomError = new Error(message);
  err.statusCode = 400;
  return err;
};

/** A student counts as present only by the FINAL decision (falls back to status for old data). */
const PRESENT_COUNT = {
  $size: {
    $filter: {
      input: { $ifNull: ['$attendance', []] },
      as: 'a',
      cond: { $eq: [{ $ifNull: ['$$a.finalDecision', '$$a.status'] }, 'PRESENT'] }
    }
  }
};
const TOTAL_COUNT = { $size: { $ifNull: ['$attendance', []] } };

/** Per-student totals for a set of sessions. `matchStage` selects the sessions. */
const studentTotalsPipeline = (matchStage: any, dateField: 'startTime' | 'eventDate'): PipelineStage[] => [
  { $match: matchStage },
  { $sort: { [dateField]: 1 } }, // so $last below means "most recent"
  { $unwind: '$attendance' },
  {
    $group: {
      _id: '$attendance.rollNumber',
      studentName: { $last: '$attendance.studentName' },
      section: { $last: '$section' },
      classes: { $sum: 1 },
      present: {
        $sum: { $cond: [{ $eq: [{ $ifNull: ['$attendance.finalDecision', '$attendance.status'] }, 'PRESENT'] }, 1, 0] }
      },
      awayMinutes: { $sum: { $ifNull: ['$attendance.totalAwayMinutes', 0] } }
    }
  },
  { $sort: { _id: 1 } }
];

const shapeStudent = (d: any) => ({
  rollNumber: String(d._id),
  studentName: String(d.studentName || ''),
  section: String(d.section || ''),
  classes: d.classes as number,
  present: d.present as number,
  absent: (d.classes as number) - (d.present as number),
  awayMinutes: Math.round(d.awayMinutes || 0),
  percentage: percent(d.present, d.classes)
});

const pad = (n: number) => String(n).padStart(2, '0');
const formatTime = (d: Date) => `${pad(d.getHours())}:${pad(d.getMinutes())}`;

export interface PeriodFilters {
  period?: string;
  date?: string;
  month?: string;
}

export class ReportService {
  private settingsRepo = new SettingsRepository();

  // ---------- input helpers ----------
  private parsePeriod(value?: string): ReportPeriod {
    const p = (value || 'day').toLowerCase() as ReportPeriod;
    if (!REPORT_PERIODS.includes(p)) throw badRequest('Period must be one of: day, week, month.');
    return p;
  }

  private optionalInt(value: unknown, name: string, allowed?: number[]): number | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const n = Number(value);
    if (!Number.isInteger(n) || (allowed && !allowed.includes(n))) throw badRequest(`Invalid ${name}.`);
    return n;
  }

  private optionalObjectId(value: unknown, name: string): mongoose.Types.ObjectId | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    if (!mongoose.Types.ObjectId.isValid(String(value))) throw badRequest(`Invalid ${name}.`);
    return new mongoose.Types.ObjectId(String(value));
  }

  private optionalSection(value: unknown): string | undefined {
    if (value === undefined || value === null || value === '') return undefined;
    const s = String(value).trim().toUpperCase();
    if (!/^[A-Z0-9 _-]{1,20}$/.test(s)) throw badRequest('Invalid section.');
    return s;
  }

  // ---------- filter dropdown data ----------
  /** Subjects and sections that exist for the chosen year/semester. Open to every logged-in user. */
  async getFilterOptions(query: { year?: unknown; semester?: unknown }) {
    const year = this.optionalInt(query.year, 'year', [2, 3, 4]);
    const semester = this.optionalInt(query.semester, 'semester', [1, 2]);

    const subjectFilter: any = { isActive: true };
    const studentFilter: any = { isActive: true };
    if (year) { subjectFilter.year = year; studentFilter.year = year; }
    if (semester) { subjectFilter.semester = semester; studentFilter.semester = semester; }

    const [subjects, studentSections] = await Promise.all([
      Subject.find(subjectFilter)
        .select('subjectCode subjectName shortName isLaboratory year semester')
        .sort({ subjectName: 1 })
        .lean(),
      Student.distinct('section', studentFilter)
    ]);

    let sections: string[] = (studentSections as string[]).filter(Boolean);
    if (sections.length === 0) {
      const sessionFilter: any = {};
      if (year) sessionFilter.year = year;
      if (semester) sessionFilter.semester = semester;
      sections = ((await AttendanceSession.distinct('section', sessionFilter)) as string[]).filter(Boolean);
    }
    sections.sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));

    return {
      subjects: subjects.map((s: any) => ({
        id: String(s._id),
        code: s.subjectCode,
        name: s.subjectName,
        shortName: s.shortName,
        isLaboratory: !!s.isLaboratory
      })),
      sections
    };
  }

  // ---------- SUBJECTS (regular classes) ----------
  async getSubjectsReport(f: PeriodFilters & {
    year?: unknown; semester?: unknown; section?: unknown; subjectId?: unknown;
  }) {
    const period = this.parsePeriod(f.period);
    const range = resolveRange(period, { date: f.date, month: f.month });
    const year = this.optionalInt(f.year, 'year', [2, 3, 4]);
    const semester = this.optionalInt(f.semester, 'semester', [1, 2]);
    const section = this.optionalSection(f.section);
    const subjectId = this.optionalObjectId(f.subjectId, 'subject');

    const match: any = { sessionStatus: 'COMPLETED', startTime: { $gte: range.start, $lte: range.end } };
    if (year) match.year = year;
    if (semester) match.semester = semester;
    if (section) match.section = section;
    if (subjectId) match.subjectId = subjectId;

    const docs = await AttendanceSession.aggregate([
      { $match: match },
      {
        $project: {
          sessionCode: 1, startTime: 1, subjectId: 1, facultyId: 1, section: 1, year: 1, semester: 1,
          total: TOTAL_COUNT, present: PRESENT_COUNT
        }
      },
      { $lookup: { from: 'subjects', localField: 'subjectId', foreignField: '_id', as: 'subject' } },
      { $unwind: { path: '$subject', preserveNullAndEmptyArrays: true } },
      { $lookup: { from: 'users', localField: 'facultyId', foreignField: '_id', as: 'faculty' } },
      { $unwind: { path: '$faculty', preserveNullAndEmptyArrays: true } },
      { $sort: { startTime: 1 } }
    ]);

    const rows: SessionRow[] = docs.map((d: any) => {
      const start = new Date(d.startTime);
      return {
        id: String(d._id),
        sessionCode: d.sessionCode,
        date: formatLocalDate(start),
        time: formatTime(start),
        subjectId: String(d.subjectId),
        subjectCode: d.subject?.subjectCode || '',
        subjectName: d.subject?.subjectName || 'Unknown subject',
        subjectShort: d.subject?.shortName || d.subject?.subjectName || 'Unknown',
        section: d.section,
        year: d.year,
        semester: d.semester,
        faculty: d.faculty?.fullName || 'Unknown',
        total: d.total,
        present: d.present,
        absent: d.total - d.present,
        percentage: percent(d.present, d.total)
      };
    });

    const studentDocs = rows.length > 0 ? await AttendanceSession.aggregate(studentTotalsPipeline(match, 'startTime')) : [];

    return {
      period,
      rangeLabel: range.label,
      summary: summarize(rows),
      trend: buildTrend(period, rows),
      breakdown: buildBreakdown(rows, !!subjectId),
      subjectSummary: buildSubjectSummary(rows),
      sessions: rows,
      students: studentDocs.map(shapeStudent)
    };
  }

  // ---------- CUSTOM sessions ----------
  async getCustomReport(f: PeriodFilters & { sessionId?: unknown }) {
    const period = this.parsePeriod(f.period);
    const range = resolveRange(period, { date: f.date, month: f.month });
    const sessionId = this.optionalObjectId(f.sessionId, 'session');

    const docs = await CustomAttendanceSession.aggregate([
      { $match: { sessionStatus: 'COMPLETED', eventDate: { $gte: range.start, $lte: range.end } } },
      {
        $project: {
          sessionCode: 1, sessionTitle: 1, venue: 1, eventDate: 1, facultyId: 1,
          total: TOTAL_COUNT, present: PRESENT_COUNT
        }
      },
      { $lookup: { from: 'users', localField: 'facultyId', foreignField: '_id', as: 'faculty' } },
      { $unwind: { path: '$faculty', preserveNullAndEmptyArrays: true } },
      { $sort: { eventDate: 1, sessionTitle: 1 } }
    ]);

    const all = docs.map((d: any) => ({
      id: String(d._id),
      sessionCode: d.sessionCode,
      title: d.sessionTitle,
      venue: d.venue,
      date: formatLocalDate(new Date(d.eventDate)),
      faculty: d.faculty?.fullName || 'Unknown',
      total: d.total,
      present: d.present,
      absent: d.total - d.present,
      percentage: percent(d.present, d.total)
    }));

    // Options always list every session of the period, so the picker never shrinks after choosing one.
    const sessionOptions = all.map(s => ({ id: s.id, title: s.title, date: s.date }));
    const sessions = sessionId ? all.filter(s => s.id === String(sessionId)) : all;

    let students: any[] = [];
    if (sessionId && sessions.length === 1) {
      const full: any = await CustomAttendanceSession.findById(sessionId).select('attendance').lean();
      students = (full?.attendance || []).map((a: any) => ({
        rollNumber: a.rollNumber,
        studentName: a.studentName,
        status: a.finalDecision || a.status,
        awayMinutes: a.totalAwayMinutes || 0
      })).sort((x: any, y: any) => String(x.rollNumber).localeCompare(String(y.rollNumber)));
    }

    // With no single session chosen, give per-student totals across the period's custom sessions.
    let studentSummary: ReturnType<typeof shapeStudent>[] = [];
    if (!(sessionId && sessions.length === 1) && sessions.length > 0) {
      const summaryDocs = await CustomAttendanceSession.aggregate(studentTotalsPipeline(
        { sessionStatus: 'COMPLETED', eventDate: { $gte: range.start, $lte: range.end } },
        'eventDate'
      ));
      studentSummary = summaryDocs.map(shapeStudent);
    }

    return {
      period,
      rangeLabel: range.label,
      summary: summarize(sessions),
      sessionOptions,
      sessions,
      students,
      studentSummary
    };
  }

  // ---------- DEFAULTERS (regular classes only) ----------
  async getDefaultersReport(f: {
    year?: unknown; semester?: unknown; section?: unknown; subjectId?: unknown; threshold?: unknown;
  }) {
    const year = this.optionalInt(f.year, 'year', [2, 3, 4]);
    const semester = this.optionalInt(f.semester, 'semester', [1, 2]);
    const section = this.optionalSection(f.section);
    const subjectId = this.optionalObjectId(f.subjectId, 'subject');

    const settings = await this.settingsRepo.getSettings();
    let threshold = settings.attendanceThreshold;
    if (f.threshold !== undefined && f.threshold !== null && f.threshold !== '') {
      const t = Number(f.threshold);
      if (!Number.isFinite(t) || t < 0 || t > 100) throw badRequest('Threshold must be between 0 and 100.');
      threshold = t;
    }

    const match: any = { sessionStatus: 'COMPLETED' };
    if (year) match.year = year;
    if (semester) match.semester = semester;
    if (section) match.section = section;
    if (subjectId) match.subjectId = subjectId;

    const agg = await AttendanceSession.aggregate([
      { $match: match },
      { $unwind: '$attendance' },
      {
        $group: {
          _id: '$attendance.rollNumber',
          studentName: { $last: '$attendance.studentName' },
          section: { $last: '$section' },
          totalClasses: { $sum: 1 },
          presentCount: {
            $sum: { $cond: [{ $eq: [{ $ifNull: ['$attendance.finalDecision', '$attendance.status'] }, 'PRESENT'] }, 1, 0] }
          }
        }
      }
    ]);

    const students = agg
      .map((s: any) => {
        const attendancePercentage = percent(s.presentCount, s.totalClasses);
        return {
          rollNumber: s._id as string,
          studentName: s.studentName as string,
          section: (s.section as string) || 'N/A',
          totalClasses: s.totalClasses as number,
          presentCount: s.presentCount as number,
          attendancePercentage,
          status: attendancePercentage < threshold ? 'DEFAULTER' : 'NORMAL'
        };
      })
      .sort((a, b) => a.attendancePercentage - b.attendancePercentage || a.rollNumber.localeCompare(b.rollNumber));

    const defaulters = students.filter(s => s.status === 'DEFAULTER');
    const percentages = students.map(s => s.attendancePercentage);

    return {
      summary: {
        totalStudents: students.length,
        defaulters: defaulters.length,
        averagePercentage: students.length
          ? Math.round((percentages.reduce((a, b) => a + b, 0) / students.length) * 10) / 10
          : 0,
        lowestPercentage: students.length ? students[0].attendancePercentage : 0,
        threshold
      },
      distribution: buildDistribution(percentages),
      lowest: defaulters.slice(0, 10).map(s => ({
        label: s.rollNumber, percentage: s.attendancePercentage, name: s.studentName
      })),
      students
    };
  }
}
