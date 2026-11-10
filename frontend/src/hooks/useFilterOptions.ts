import { useEffect } from 'react';
import { reportService } from '../services/reportService';
import { useReportData } from './useReportData';

/**
 * Subject and section dropdown options for the chosen year/semester.
 * If a selected subject/section stops being valid after the year/semester changes,
 * it is reset to "All" so the report never filters by something that is not in the list.
 */
export function useFilterOptions(
  year: string,
  semester: string,
  subjectId: string,
  setSubjectId: (v: string) => void,
  section: string,
  setSection: (v: string) => void
) {
  const { data } = useReportData(
    signal => reportService.filterOptions(year === '' ? '' : Number(year), semester === '' ? '' : Number(semester), signal),
    [year, semester]
  );

  useEffect(() => {
    if (!data) return;
    if (subjectId && !data.subjects.some(s => s.id === subjectId)) setSubjectId('');
    if (section && !data.sections.includes(section)) setSection('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data]);

  return { subjects: data?.subjects ?? [], sections: data?.sections ?? [] };
}
