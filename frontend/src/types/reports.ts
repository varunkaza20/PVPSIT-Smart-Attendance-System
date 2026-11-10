export type Period = 'day' | 'week' | 'month';
export type ReportTab = 'subjects' | 'custom' | 'defaulters';

export interface Summary {
  sessions: number;
  totalStudents: number;
  present: number;
  absent: number;
  averagePercentage: number;
}

export interface ChartPoint {
  label: string;
  percentage: number;
  present: number;
  absent: number;
  sessions: number;
}

export interface SessionRow {
  id: string;
  sessionCode: string;
  date: string;
  time: string;
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

export interface SubjectSummaryRow {
  subjectCode: string;
  subjectName: string;
  section: string;
  sessions: number;
  present: number;
  absent: number;
  total: number;
  percentage: number;
}

/** Per-student totals across the sessions that match the filters. */
export interface StudentTotals {
  rollNumber: string;
  studentName: string;
  section: string;
  classes: number;
  present: number;
  absent: number;
  awayMinutes: number;
  percentage: number;
}

export interface SubjectsReportData {
  period: Period;
  rangeLabel: string;
  summary: Summary;
  trend: ChartPoint[];
  breakdown: { by: 'subject' | 'section'; items: ChartPoint[] };
  subjectSummary: SubjectSummaryRow[];
  sessions: SessionRow[];
  students: StudentTotals[];
}

export interface CustomSessionRow {
  id: string;
  sessionCode: string;
  title: string;
  venue: string;
  date: string;
  faculty: string;
  total: number;
  present: number;
  absent: number;
  percentage: number;
}

export interface CustomStudentRow {
  rollNumber: string;
  studentName: string;
  status: 'PRESENT' | 'ABSENT' | 'AWAY';
  awayMinutes: number;
}

export interface CustomReportData {
  period: Period;
  rangeLabel: string;
  summary: Summary;
  sessionOptions: { id: string; title: string; date: string }[];
  sessions: CustomSessionRow[];
  /** Status per student - only filled when ONE session is chosen */
  students: CustomStudentRow[];
  /** Totals per student across the period - filled when no single session is chosen */
  studentSummary: StudentTotals[];
}

export interface DefaulterRow {
  rollNumber: string;
  studentName: string;
  section: string;
  totalClasses: number;
  presentCount: number;
  attendancePercentage: number;
  status: 'DEFAULTER' | 'NORMAL';
}

export interface DefaultersReportData {
  summary: {
    totalStudents: number;
    defaulters: number;
    averagePercentage: number;
    lowestPercentage: number;
    threshold: number;
  };
  distribution: { label: string; count: number }[];
  lowest: { label: string; percentage: number; name: string }[];
  students: DefaulterRow[];
}

export interface FilterOptions {
  subjects: { id: string; code: string; name: string; shortName: string; isLaboratory: boolean }[];
  sections: string[];
}

export interface ExportTable {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

/** Body sent to /api/export/(pdf|excel). Tables appear in the file in the order given. */
export interface ExportRequest {
  reportType: string;
  title: string;
  filters: { label: string; value: string }[];
  tables: ExportTable[];
  charts?: { title: string; image: string }[];
}
