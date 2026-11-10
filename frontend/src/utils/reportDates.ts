import { Period } from '../types/reports';

const pad = (n: number) => String(n).padStart(2, '0');

/** Today as YYYY-MM-DD in the browser's local time (not UTC). */
export const todayISO = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};

/** Current month as YYYY-MM in local time. */
export const currentMonth = (): string => {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
};

export const PERIOD_LABEL: Record<Period, string> = { day: 'Day', week: 'Weekly', month: 'Monthly' };

export const YEAR_OPTIONS = [
  { value: 2, label: 'II Year' },
  { value: 3, label: 'III Year' },
  { value: 4, label: 'IV Year' }
];

export const SEMESTER_OPTIONS = [
  { value: 1, label: 'Sem 1' },
  { value: 2, label: 'Sem 2' }
];

/** YYYY-MM-DD -> DD-MM-YYYY for display */
export const displayDate = (iso: string): string =>
  /^\d{4}-\d{2}-\d{2}$/.test(iso) ? `${iso.slice(8, 10)}-${iso.slice(5, 7)}-${iso.slice(0, 4)}` : iso;
