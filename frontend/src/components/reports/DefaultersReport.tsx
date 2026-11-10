import React, { useEffect, useRef, useState } from 'react';
import { DefaulterRow } from '../../types/reports';
import { reportService } from '../../services/reportService';
import { useReportData } from '../../hooks/useReportData';
import { useFilterOptions } from '../../hooks/useFilterOptions';
import { SEMESTER_OPTIONS, YEAR_OPTIONS } from '../../utils/reportDates';
import { FilterField, SelectInput, TextInput } from './ReportControls';
import { EmptyBlock, ErrorBlock, FilterBar, LoadingBlock, PercentBadge, StatusBadge, SummaryCards, TableToggle } from './ReportParts';
import { ChartCard, DistributionChart, PercentBarsChart } from './ReportCharts';
import { Column, DataTable, toExportTable } from './DataTable';
import { ExportButtons } from './ExportButtons';

const COLUMNS: Column<DefaulterRow>[] = [
  { header: 'Roll Number', value: r => r.rollNumber },
  { header: 'Student Name', value: r => r.studentName },
  { header: 'Section', value: r => r.section },
  { header: 'Present', value: r => r.presentCount, align: 'right' },
  { header: 'Total Classes', value: r => r.totalClasses, align: 'right' },
  { header: 'Attendance %', value: r => r.attendancePercentage, render: r => <PercentBadge value={r.attendancePercentage} />, align: 'right' },
  { header: 'Status', value: r => (r.status === 'DEFAULTER' ? 'Defaulter' : 'Normal'), render: r => <StatusBadge status={r.status} /> }
];

/** Delays a fast-changing value (typing) so the report is not reloaded on every keystroke. */
const useDebounced = (value: string, ms: number) => {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(t);
  }, [value, ms]);
  return debounced;
};

export const DefaultersReport: React.FC = () => {
  const [year, setYear] = useState('');
  const [semester, setSemester] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [section, setSection] = useState('');
  const [thresholdInput, setThresholdInput] = useState('');
  const [view, setView] = useState<'defaulters' | 'all'>('defaulters');
  const chartsRef = useRef<HTMLDivElement>(null);

  const threshold = useDebounced(thresholdInput, 400);
  const thresholdValid = threshold === '' || (Number(threshold) >= 0 && Number(threshold) <= 100);
  const { subjects, sections } = useFilterOptions(year, semester, subjectId, setSubjectId, section, setSection);

  const { data, loading, error } = useReportData(
    signal => reportService.defaulters(
      { year: year === '' ? '' : Number(year), semester: semester === '' ? '' : Number(semester), section, subjectId, threshold },
      signal
    ),
    [year, semester, subjectId, section, threshold],
    thresholdValid
  );

  const rows = data ? (view === 'defaulters' ? data.students.filter(s => s.status === 'DEFAULTER') : data.students) : [];
  const yearLabel = YEAR_OPTIONS.find(o => String(o.value) === year)?.label;
  const semLabel = SEMESTER_OPTIONS.find(o => String(o.value) === semester)?.label;

  const buildExport = () => {
    if (!data) return null;
    return {
      reportType: 'defaulters',
      title: view === 'defaulters' ? 'Defaulters Report' : 'Attendance Report - All Students',
      filters: [
        { label: 'Year', value: yearLabel || 'All years' },
        { label: 'Semester', value: semLabel || 'All semesters' },
        { label: 'Subject', value: subjects.find(s => s.id === subjectId)?.name || 'All subjects' },
        { label: 'Section', value: section || 'All sections' },
        { label: 'Threshold', value: `${data.summary.threshold}%` },
        { label: 'Showing', value: view === 'defaulters' ? 'Defaulters only' : 'All students' }
      ],
      tables: [toExportTable(view === 'defaulters' ? 'Defaulters' : 'All students', COLUMNS, rows)]
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs text-slate-500">
          Students whose attendance in regular classes is below the threshold, counted from all completed sessions so far.
        </p>
        <ExportButtons build={buildExport} chartsRootRef={chartsRef} />
      </div>

      <FilterBar>
        <FilterField label="Year">
          <SelectInput ariaLabel="Year" value={year} onChange={setYear} allLabel="All years"
            options={YEAR_OPTIONS.map(o => ({ value: String(o.value), label: o.label }))} />
        </FilterField>
        <FilterField label="Semester">
          <SelectInput ariaLabel="Semester" value={semester} onChange={setSemester} allLabel="All semesters"
            options={SEMESTER_OPTIONS.map(o => ({ value: String(o.value), label: o.label }))} />
        </FilterField>
        <FilterField label="Subject">
          <SelectInput ariaLabel="Subject" value={subjectId} onChange={setSubjectId} allLabel="All subjects"
            options={subjects.map(s => ({ value: s.id, label: s.name }))} />
        </FilterField>
        <FilterField label="Section">
          <SelectInput ariaLabel="Section" value={section} onChange={setSection} allLabel="All sections"
            options={sections.map(s => ({ value: s, label: s }))} />
        </FilterField>
        <FilterField label="Threshold %" hint={thresholdValid ? undefined : 'Enter a number from 0 to 100'}>
          <TextInput ariaLabel="Attendance threshold percent" type="number" min={0} max={100}
            placeholder={data ? `Default ${data.summary.threshold}` : 'Default'}
            value={thresholdInput} onChange={e => setThresholdInput(e.target.value)} />
        </FilterField>
      </FilterBar>

      {loading && !data ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message={error} />
      ) : !data || data.students.length === 0 ? (
        <EmptyBlock title="No attendance records found" hint="Try changing the filters." />
      ) : (
        <div className={`space-y-6 ${loading ? 'opacity-60 transition-opacity' : ''}`}>
          <SummaryCards items={[
            { label: 'Students', value: data.summary.totalStudents },
            { label: `Defaulters (below ${data.summary.threshold}%)`, value: data.summary.defaulters, tone: 'danger' },
            { label: 'Average attendance', value: `${data.summary.averagePercentage}%`, tone: 'blue' },
            { label: 'Lowest attendance', value: `${data.summary.lowestPercentage}%`, tone: 'warning' }
          ]} />

          <div ref={chartsRef} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <ChartCard title="Students by attendance band" hasData={data.distribution.some(b => b.count > 0)}>
              <DistributionChart data={data.distribution} />
            </ChartCard>
            <ChartCard title="Lowest attendance (top 10 defaulters)" height={Math.max(220, data.lowest.length * 30 + 40)}
              hasData={data.lowest.length > 0}>
              <PercentBarsChart data={data.lowest} />
            </ChartCard>
          </div>

          <div className="space-y-3">
            <TableToggle value={view} onChange={v => setView(v as 'defaulters' | 'all')} options={[
              { value: 'defaulters', label: 'Defaulters only' },
              { value: 'all', label: 'All students' }
            ]} />
            {rows.length === 0 ? (
              <EmptyBlock title="No defaulters" hint="Every student is at or above the threshold." />
            ) : (
              <DataTable caption="Students" columns={COLUMNS} rows={rows} rowKey={r => r.rollNumber} />
            )}
          </div>
        </div>
      )}
    </div>
  );
};
