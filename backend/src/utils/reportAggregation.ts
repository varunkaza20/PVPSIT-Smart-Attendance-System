import { ReportPeriod } from './reportPeriod';

/** One completed attendance session, already reduced to counts. */
export interface SessionRow {
  id: string;
  sessionCode: string;
  date: string; // YYYY-MM-DD
  time: string; // HH:mm
  subjectId: string;
  subjectCode: string;
  subjectName: string;
  subjectShort: string;
  section: string;
  year: number;
  semester: number;
  faculty: string;
  total: number;
  present: number;
  absent: number;
  percentage: number;
}

export interface GroupedRow {
  key: string;
  label: string;
  sessions: number;
  total: number;
  present: number;
  absent: number;
  percentage: number;
}

export interface ReportSummary {
  sessions: number;
  totalStudents: number; // student-slots across sessions
  present: number;
  absent: number;
  averagePercentage: number;
}

/** Percentage rounded to 1 decimal. Returns 0 when there is nothing to divide by. */
export const percent = (part: number, whole: number): number =>
  whole > 0 ? Math.round((part / whole) * 1000) / 10 : 0;

export const summarize = (rows: { total: number; present: number; absent: number }[]): ReportSummary => {
  const total = rows.reduce((s, r) => s + r.total, 0);
  const present = rows.reduce((s, r) => s + r.present, 0);
  return {
    sessions: rows.length,
    totalStudents: total,
    present,
    absent: total - present,
    averagePercentage: percent(present, total)
  };
};

/** Groups rows by a key. Insertion order of first appearance is preserved. */
export const groupRows = <T extends { total: number; present: number; absent: number }>(
  rows: T[],
  keyOf: (r: T) => string,
  labelOf: (r: T) => string
): GroupedRow[] => {
  const map = new Map<string, GroupedRow>();
  for (const r of rows) {
    const key = keyOf(r);
    let g = map.get(key);
    if (!g) {
      g = { key, label: labelOf(r), sessions: 0, total: 0, present: 0, absent: 0, percentage: 0 };
      map.set(key, g);
    }
    g.sessions += 1;
    g.total += r.total;
    g.present += r.present;
    g.absent += r.absent;
  }
  const out = Array.from(map.values());
  out.forEach(g => (g.percentage = percent(g.present, g.total)));
  return out;
};

/** DD-MM from YYYY-MM-DD */
const shortDate = (iso: string) => `${iso.slice(8, 10)}-${iso.slice(5, 7)}`;

/**
 * Trend series for the first chart.
 *  - day: one point per session (time + subject)
 *  - week / month: one point per calendar day that has sessions
 */
export const buildTrend = (period: ReportPeriod, rows: SessionRow[]) => {
  if (period === 'day') {
    return rows.map(r => ({
      label: `${r.time} ${r.subjectShort}${r.section ? ' ' + r.section : ''}`.trim(),
      percentage: r.percentage,
      present: r.present,
      absent: r.absent,
      sessions: 1
    }));
  }
  return groupRows(rows, r => r.date, r => shortDate(r.date))
    .sort((a, b) => a.key.localeCompare(b.key))
    .map(g => ({ label: g.label, percentage: g.percentage, present: g.present, absent: g.absent, sessions: g.sessions }));
};

/** Breakdown for the second chart: by subject, or by section once a subject is chosen. */
export const buildBreakdown = (rows: SessionRow[], subjectSelected: boolean) => {
  const groups = subjectSelected
    ? groupRows(rows, r => r.section, r => r.section)
    : groupRows(rows, r => r.subjectId, r => r.subjectShort || r.subjectName);
  return {
    by: subjectSelected ? 'section' : 'subject',
    items: groups
      .sort((a, b) => b.percentage - a.percentage)
      .map(g => ({ label: g.label, percentage: g.percentage, present: g.present, absent: g.absent, sessions: g.sessions }))
  };
};

/** Table: one row per subject + section. */
export const buildSubjectSummary = (rows: SessionRow[]) =>
  groupRows(rows, r => `${r.subjectId}|${r.section}`, r => r.subjectName)
    .map(g => {
      const sample = rows.find(r => `${r.subjectId}|${r.section}` === g.key)!;
      return {
        subjectCode: sample.subjectCode,
        subjectName: sample.subjectName,
        section: sample.section,
        sessions: g.sessions,
        present: g.present,
        absent: g.absent,
        total: g.total,
        percentage: g.percentage
      };
    })
    .sort((a, b) => a.subjectName.localeCompare(b.subjectName) || a.section.localeCompare(b.section));

export interface DefaulterBucket { label: string; count: number }

/** Attendance-% distribution for the defaulters chart. */
export const buildDistribution = (percentages: number[]): DefaulterBucket[] => {
  const buckets: DefaulterBucket[] = [
    { label: '< 50%', count: 0 },
    { label: '50-64%', count: 0 },
    { label: '65-74%', count: 0 },
    { label: '75-84%', count: 0 },
    { label: '85-100%', count: 0 }
  ];
  for (const p of percentages) {
    if (p < 50) buckets[0].count++;
    else if (p < 65) buckets[1].count++;
    else if (p < 75) buckets[2].count++;
    else if (p < 85) buckets[3].count++;
    else buckets[4].count++;
  }
  return buckets;
};
