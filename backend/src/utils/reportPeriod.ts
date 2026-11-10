import { CustomError } from '../middlewares/errorMiddleware';

export type ReportPeriod = 'day' | 'week' | 'month';

export interface DateRange {
  start: Date;
  end: Date;
  /** Human readable, e.g. "2026-11-09 to 2026-11-15" */
  label: string;
}

export const REPORT_PERIODS: ReportPeriod[] = ['day', 'week', 'month'];

const badRequest = (message: string): CustomError => {
  const err: CustomError = new Error(message);
  err.statusCode = 400;
  return err;
};

/** Formats a Date as YYYY-MM-DD using server-local time. */
export const formatLocalDate = (d: Date): string =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** Parses "YYYY-MM-DD" as a LOCAL date (never UTC) so day boundaries match the college timezone. */
export const parseLocalDate = (value: string): Date | null => {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value || '');
  if (!m) return null;
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const date = new Date(y, mo - 1, d);
  // Reject overflow such as 2026-02-31
  if (date.getFullYear() !== y || date.getMonth() !== mo - 1 || date.getDate() !== d) return null;
  return date;
};

const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 0, 0, 0, 0);
const endOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate(), 23, 59, 59, 999);

/**
 * Resolves the date range for a report.
 *  - day:   `date` (YYYY-MM-DD)
 *  - week:  calendar week, Monday to Sunday, containing `date`
 *  - month: `month` (YYYY-MM)
 */
export const resolveRange = (
  period: ReportPeriod,
  input: { date?: string; month?: string }
): DateRange => {
  if (period === 'month') {
    const m = /^(\d{4})-(\d{2})$/.exec(input.month || '');
    if (!m || Number(m[2]) < 1 || Number(m[2]) > 12) {
      throw badRequest('A valid month (YYYY-MM) is required.');
    }
    const y = Number(m[1]);
    const mo = Number(m[2]);
    const start = new Date(y, mo - 1, 1, 0, 0, 0, 0);
    const end = new Date(y, mo, 0, 23, 59, 59, 999); // day 0 of next month = last day of this month
    return { start, end, label: `${y}-${String(mo).padStart(2, '0')}` };
  }

  const base = parseLocalDate(input.date || '');
  if (!base) throw badRequest('A valid date (YYYY-MM-DD) is required.');

  if (period === 'day') {
    return { start: startOfDay(base), end: endOfDay(base), label: formatLocalDate(base) };
  }

  // week: Monday..Sunday. getDay(): Sun=0, Mon=1 ... Sat=6  ->  days since Monday = (day + 6) % 7
  const sinceMonday = (base.getDay() + 6) % 7;
  const monday = new Date(base.getFullYear(), base.getMonth(), base.getDate() - sinceMonday);
  const sunday = new Date(monday.getFullYear(), monday.getMonth(), monday.getDate() + 6);
  return {
    start: startOfDay(monday),
    end: endOfDay(sunday),
    label: `${formatLocalDate(monday)} to ${formatLocalDate(sunday)}`
  };
};
