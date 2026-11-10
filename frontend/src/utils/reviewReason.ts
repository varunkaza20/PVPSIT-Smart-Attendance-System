/** Why a student shows up in the end-of-session review dialog. */
export type ReviewReason = 'AWAY' | 'DEFAULTER' | 'BLOCKLIST';

export const REASON_LABEL: Record<ReviewReason, string> = {
  AWAY: 'Still away',
  DEFAULTER: 'Defaulter - scan refused',
  BLOCKLIST: 'Block list - scan refused'
};

/** Away students default to Present (they were in class). Refused students default to Absent: nothing was scanned for them. */
export const defaultDecision = (reason?: string): 'PRESENT' | 'ABSENT' =>
  reason === 'DEFAULTER' || reason === 'BLOCKLIST' ? 'ABSENT' : 'PRESENT';

export const reviewDetail = (s: { reason?: string; totalAwayMinutes?: number }): string =>
  s.reason === 'DEFAULTER' || s.reason === 'BLOCKLIST' ? (REASON_LABEL[s.reason as ReviewReason]) : `${REASON_LABEL.AWAY} (${s.totalAwayMinutes ?? 0} mins)`;
