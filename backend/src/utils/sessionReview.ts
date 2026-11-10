import { Model } from 'mongoose';

export type BlockedReason = 'DEFAULTER' | 'BLOCKLIST';
export type ReviewReason = 'AWAY' | BlockedReason;

export interface ReviewStudent {
  rollNumber: string;
  studentName: string;
  totalAwayMinutes: number;
  reason: ReviewReason;
}

/**
 * Students the faculty must decide on (Present / Absent) when ending a session:
 *  - AWAY: scanned out and never came back
 *  - DEFAULTER / BLOCKLIST: tried to scan but were refused, so nothing was recorded for them
 *    (a student who was already PRESENT when blocked mid-session is left alone)
 */
export const buildReviewList = (
  attendance: { rollNumber: string; studentName: string; status: string; totalAwayMinutes?: number; blockedReason?: string }[]
): ReviewStudent[] => {
  const out: ReviewStudent[] = [];
  attendance.forEach((r) => {
    if (r.status === 'AWAY') {
      out.push({ rollNumber: r.rollNumber, studentName: r.studentName, totalAwayMinutes: r.totalAwayMinutes || 0, reason: 'AWAY' });
    } else if (r.blockedReason && r.status === 'ABSENT') {
      out.push({ rollNumber: r.rollNumber, studentName: r.studentName, totalAwayMinutes: 0, reason: r.blockedReason as BlockedReason });
    }
  });
  return out;
};

/** Remembers (atomically) that this roster student's scan was refused. No-op if they're not on the roster. */
export const markBlockedAttempt = async (
  model: Model<any>,
  sessionId: string,
  rollNumber: string,
  reason: BlockedReason
): Promise<void> => {
  const roll = String(rollNumber).trim().toUpperCase();
  await model.updateOne(
    { _id: sessionId, sessionStatus: 'ACTIVE', 'attendance.rollNumber': roll },
    { $set: { 'attendance.$.blockedReason': reason } }
  );
};
