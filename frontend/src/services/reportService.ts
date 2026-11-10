import axios from 'axios';
import {
  CustomReportData,
  DefaultersReportData,
  ExportRequest,
  FilterOptions,
  Period,
  SubjectsReportData
} from '../types/reports';

/** Drops empty values so "All" filters are simply not sent. */
const clean = (params: object) =>
  Object.fromEntries(Object.entries(params).filter(([, v]) => v !== '' && v !== undefined && v !== null));

const unwrap = <T>(res: { data: { data: T } }): T => res.data.data;

export interface PeriodParams {
  period: Period;
  date?: string;
  month?: string;
}

export const reportService = {
  filterOptions: (year: number | '', semester: number | '', signal?: AbortSignal) =>
    axios.get('/api/reports/filters', { params: clean({ year, semester }), signal }).then(r => unwrap<FilterOptions>(r)),

  subjects: (
    p: PeriodParams & { year: number | ''; semester: number | ''; subjectId: string; section: string },
    signal?: AbortSignal
  ) => axios.get('/api/reports/subjects', { params: clean(p), signal }).then(r => unwrap<SubjectsReportData>(r)),

  custom: (p: PeriodParams & { sessionId: string }, signal?: AbortSignal) =>
    axios.get('/api/reports/custom', { params: clean(p), signal }).then(r => unwrap<CustomReportData>(r)),

  defaulters: (
    p: { year: number | ''; semester: number | ''; section: string; subjectId: string; threshold: string },
    signal?: AbortSignal
  ) => axios.get('/api/reports/defaulters', { params: clean(p), signal }).then(r => unwrap<DefaultersReportData>(r)),

  export: async (kind: 'pdf' | 'excel', payload: ExportRequest) => {
    const res = await axios.post(`/api/export/${kind}`, payload, { responseType: 'blob' });
    const disposition: string = res.headers['content-disposition'] || '';
    const match = /filename="?([^";]+)"?/i.exec(disposition);
    const fallback = `${payload.reportType}.${kind === 'pdf' ? 'pdf' : 'xlsx'}`;
    return { blob: res.data as Blob, filename: match ? match[1] : fallback };
  }
};
