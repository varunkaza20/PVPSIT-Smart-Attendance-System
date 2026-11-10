import React, { useEffect, useRef, useState } from 'react';
import { Period, SessionRow, StudentTotals, SubjectSummaryRow } from '../../types/reports';
import { reportService } from '../../services/reportService';
import { useReportData } from '../../hooks/useReportData';
import { useFilterOptions } from '../../hooks/useFilterOptions';
import { PERIOD_LABEL, SEMESTER_OPTIONS, YEAR_OPTIONS, currentMonth, displayDate, todayISO } from '../../utils/reportDates';
import { FilterField, PeriodControls, SelectInput } from './ReportControls';
import { EmptyBlock, ErrorBlock, FilterBar, LoadingBlock, PercentBadge, SectionTitle, SummaryCards, TableToggle } from './ReportParts';
import { ChartCard, PercentBarsChart, PercentTrendChart } from './ReportCharts';
import { Column, DataTable, toExportTable } from './DataTable';
import { ExportButtons } from './ExportButtons';

const SESSION_COLUMNS: Column<SessionRow>[] = [
  { header: 'Date', value: r => displayDate(r.date) },
  { header: 'Time', value: r => r.time },
  { header: 'Subject', value: r => r.subjectName },
  { header: 'Section', value: r => r.section },
  { header: 'Faculty', value: r => r.faculty },
  { header: 'Present', value: r => r.present, align: 'right' },
  { header: 'Absent', value: r => r.absent, align: 'right' },
  { header: 'Total', value: r => r.total, align: 'right' },
  { header: 'Attendance %', value: r => r.percentage, render: r => <PercentBadge value={r.percentage} />, align: 'right' }
];

const SUMMARY_COLUMNS: Column<SubjectSummaryRow>[] = [
  { header: 'Subject Code', value: r => r.subjectCode },
  { header: 'Subject', value: r => r.subjectName },
  { header: 'Section', value: r => r.section },
  { header: 'Sessions', value: r => r.sessions, align: 'right' },
  { header: 'Present', value: r => r.present, align: 'right' },
  { header: 'Absent', value: r => r.absent, align: 'right' },
  { header: 'Total', value: r => r.total, align: 'right' },
  { header: 'Attendance %', value: r => r.percentage, render: r => <PercentBadge value={r.percentage} />, align: 'right' }
];

export const STUDENT_TOTAL_COLUMNS: Column<StudentTotals>[] = [
  { header: 'Roll Number', value: r => r.rollNumber },
  { header: 'Student Name', value: r => r.studentName },
  { header: 'Section', value: r => r.section },
  { header: 'Classes', value: r => r.classes, align: 'right' },
  { header: 'Present', value: r => r.present, align: 'right' },
  { header: 'Absent', value: r => r.absent, align: 'right' },
  { header: 'Away (min)', value: r => r.awayMinutes, align: 'right' },
  { header: 'Attendance %', value: r => r.percentage, render: r => <PercentBadge value={r.percentage} />, align: 'right' }
];

type View = 'summary' | 'sessions';

export const SubjectsReport: React.FC = () => {
  const [period, setPeriod] = useState<Period>('day');
  const [date, setDate] = useState(todayISO());
  const [month, setMonth] = useState(currentMonth());
  const [year, setYear] = useState('');
  const [semester, setSemester] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [section, setSection] = useState('');
  const [view, setView] = useState<View>('sessions');
  const chartsRef = useRef<HTMLDivElement>(null);

  // A single day is best read session by session; weeks and months as a per-subject summary.
  useEffect(() => setView(period === 'day' ? 'sessions' : 'summary'), [period]);

  const { subjects, sections } = useFilterOptions(year, semester, subjectId, setSubjectId, section, setSection);

  const ready = period === 'month' ? !!month : !!date;
  const { data, loading, error } = useReportData(
    signal => reportService.subjects(
      {
        period, date, month,
        year: year === '' ? '' : Number(year),
        semester: semester === '' ? '' : Number(semester),
        subjectId, section
      },
      signal
    ),
    [period, date, month, year, semester, subjectId, section],
    ready
  );

  const subjectName = subjects.find(s => s.id === subjectId)?.name;
  const yearLabel = YEAR_OPTIONS.find(o => String(o.value) === year)?.label;
  const semLabel = SEMESTER_OPTIONS.find(o => String(o.value) === semester)?.label;

  const buildExport = () => {
    if (!data) return null;
    const second = view === 'sessions'
      ? toExportTable('All sessions', SESSION_COLUMNS, data.sessions)
      : toExportTable('Attendance by subject', SUMMARY_COLUMNS, data.subjectSummary);
    return {
      reportType: `subjects_${period}`,
      title: `Subjects Attendance - ${PERIOD_LABEL[period]}`,
      filters: [
        { label: 'Period', value: `${PERIOD_LABEL[period]} (${data.rangeLabel})` },
        { label: 'Year', value: yearLabel || 'All years' },
        { label: 'Semester', value: semLabel || 'All semesters' },
        { label: 'Subject', value: subjectName || 'All subjects' },
        { label: 'Section', value: section || 'All sections' },
      ],
      tables: [toExportTable('Students', STUDENT_TOTAL_COLUMNS, data.students), second]
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs text-slate-500">
          Completed regular classes. Pick any combination of year, semester, subject and section.
        </p>
        <ExportButtons build={buildExport} chartsRootRef={chartsRef} />
      </div>

      <FilterBar>
        <PeriodControls
          period={period} onPeriod={setPeriod}
          date={date} onDate={setDate}
          month={month} onMonth={setMonth}
          rangeLabel={data?.rangeLabel}
        />
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
      </FilterBar>

      {!ready ? (
        <EmptyBlock title="Choose a date" hint="Pick a date or month to see the report." />
      ) : loading && !data ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message={error} />
      ) : !data || data.sessions.length === 0 ? (
        <EmptyBlock title="No attendance records found" hint="Try changing the period or filters." />
      ) : (
        <div className={loading ? 'opacity-60 transition-opacity' : ''}>
          <div className="space-y-6">
            <SummaryCards items={[
              { label: 'Sessions', value: data.summary.sessions },
              { label: 'Present (student-classes)', value: data.summary.present, tone: 'success' },
              { label: 'Absent (student-classes)', value: data.summary.absent, tone: 'danger' },
              { label: 'Average attendance', value: `${data.summary.averagePercentage}%`, tone: 'blue' }
            ]} />

            <div ref={chartsRef} className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ChartCard
                title={period === 'day' ? 'Attendance % by session' : 'Attendance % by day'}
                hasData={data.trend.length > 0}
              >
                <PercentTrendChart data={data.trend} kind={period === 'day' ? 'bar' : 'line'} />
              </ChartCard>
              <ChartCard
                title={data.breakdown.by === 'subject' ? 'Attendance % by subject' : 'Attendance % by section'}
                height={Math.max(220, data.breakdown.items.length * 30 + 40)}
                hasData={data.breakdown.items.length > 0}
              >
                <PercentBarsChart data={data.breakdown.items} />
              </ChartCard>
            </div>

            <div className="space-y-3">
              <SectionTitle hint="Totals for every student across the sessions in this report.">Students</SectionTitle>
              <DataTable caption="Students" columns={STUDENT_TOTAL_COLUMNS} rows={data.students} rowKey={r => r.rollNumber} />
            </div>

            <div className="space-y-3">
              <TableToggle value={view} onChange={v => setView(v as View)} options={[
                { value: 'summary', label: 'By subject' },
                { value: 'sessions', label: 'All sessions' }
              ]} />
              {view === 'sessions' ? (
                <DataTable caption="Sessions" columns={SESSION_COLUMNS} rows={data.sessions} rowKey={r => r.id} />
              ) : (
                <DataTable caption="Attendance by subject" columns={SUMMARY_COLUMNS} rows={data.subjectSummary}
                  rowKey={(r, i) => `${r.subjectCode}-${r.section}-${i}`} />
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
