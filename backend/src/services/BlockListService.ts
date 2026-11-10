import { BlockedStudent } from '../models/BlockedStudent';
import { Student } from '../models/Student';
import { CustomError } from '../middlewares/errorMiddleware';
import { ioEmitter } from '../socket/socket';

export const BLOCKLIST_MESSAGE = 'Student in Block List. Contact Faculty';
const ROLL_PATTERN = /^[A-Z0-9][A-Z0-9_-]{3,24}$/;
const MAX_PER_REQUEST = 5000;

export const normalizeRoll = (value: unknown): string => String(value ?? '').trim().toUpperCase();

export class BlockListService {
  async list() {
    const rows = await BlockedStudent.find().sort({ createdAt: -1 }).lean();
    const students = await Student.find({ rollNumber: { $in: rows.map(r => r.rollNumber) } })
      .select('rollNumber fullName section year').lean();
    const byRoll = new Map(students.map(s => [s.rollNumber.toUpperCase(), s]));
    return rows.map(r => {
      const s = byRoll.get(r.rollNumber);
      return {
        id: String(r._id),
        rollNumber: r.rollNumber,
        studentName: s?.fullName || '',
        section: s?.section || '',
        year: s?.year || null,
        reason: r.reason || '',
        createdAt: r.createdAt
      };
    });
  }

  /** Adds roll numbers; duplicates and invalid entries are reported, never fatal. */
  async addMany(rawRolls: unknown[], reason: string | undefined, userId?: string) {
    if (!Array.isArray(rawRolls) || rawRolls.length === 0) {
      const err: CustomError = new Error('Provide at least one roll number.');
      err.statusCode = 400;
      throw err;
    }
    if (rawRolls.length > MAX_PER_REQUEST) {
      const err: CustomError = new Error(`Too many roll numbers in one request (max ${MAX_PER_REQUEST}).`);
      err.statusCode = 400;
      throw err;
    }

    const unique = Array.from(new Set(rawRolls.map(normalizeRoll).filter(Boolean)));
    const invalid = unique.filter(r => !ROLL_PATTERN.test(r));
    const valid = unique.filter(r => ROLL_PATTERN.test(r));

    const existing = new Set((await BlockedStudent.find({ rollNumber: { $in: valid } }).select('rollNumber').lean()).map(r => r.rollNumber));
    const toAdd = valid.filter(r => !existing.has(r));

    if (toAdd.length) {
      await BlockedStudent.insertMany(
        toAdd.map(rollNumber => ({ rollNumber, reason: reason?.trim() || undefined, addedBy: userId })),
        { ordered: false }
      );
    }
    return { added: toAdd.length, alreadyBlocked: existing.size, invalid };
  }

  async remove(id: string) {
    const removed = await BlockedStudent.findByIdAndDelete(id);
    if (!removed) {
      const err: CustomError = new Error('Block list entry not found.');
      err.statusCode = 404;
      throw err;
    }
    return removed;
  }

  async removeAll() {
    const res = await BlockedStudent.deleteMany({});
    return res.deletedCount || 0;
  }

  async isBlocked(rollNumber: string): Promise<boolean> {
    return !!(await BlockedStudent.exists({ rollNumber: normalizeRoll(rollNumber) }));
  }

  /**
   * Call at the top of every scan. Throws a 403 'BLOCKLIST' error (and logs it in the live
   * movement log) when the roll number is on the block list. Nothing is recorded for the student.
   */
  async assertNotBlocked(sessionId: string, rollNumber: string): Promise<void> {
    const roll = normalizeRoll(rollNumber);
    if (!(await this.isBlocked(roll))) return;

    const student = await Student.findOne({ rollNumber: roll }).select('fullName').lean();
    const studentName = student?.fullName || '';
    ioEmitter.emitMovementUpdated(sessionId, {
      timestamp: new Date(),
      rollNumber: roll,
      studentName: studentName || 'Blocked Student',
      logMessage: 'BLOCKED - Student in Block List'
    });
    const err: CustomError = new Error(BLOCKLIST_MESSAGE);
    err.statusCode = 403;
    err.reason = 'BLOCKLIST';
    err.details = { rollNumber: roll, studentName };
    throw err;
  }
}
