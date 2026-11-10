import React, { useRef, useState } from 'react';
import { CustomSessionRow, CustomStudentRow, Period } from '../../types/reports';
import { reportService } from '../../services/reportService';
import { useReportData } from '../../hooks/useReportData';
import { PERIOD_LABEL, currentMonth, displayDate, todayISO } from '../../utils/reportDates';
import { FilterField, PeriodControls, SelectInput } from './ReportControls';
import { EmptyBlock, ErrorBlock, FilterBar, LoadingBlock, PercentBadge, SectionTitle, StatusBadge, SummaryCards } from './ReportParts';
import { ChartCard, PercentTrendChart, PresentAbsentDonut } from './ReportCharts';
import { Column, DataTable, toExportTable } from './DataTable';
import { ExportButtons } from './ExportButtons';
import { STUDENT_TOTAL_COLUMNS } from './SubjectsReport';

const SESSION_COLUMNS: Column<CustomSessionRow>[] = [
  { header: 'Date', value: r => displayDate(r.date) },
  { header: 'Session', value: r => r.title },
  { header: 'Venue', value: r => r.venue },
  { header: 'Faculty', value: r => r.faculty },
  { header: 'Present', value: r => r.present, align: 'right' },
  { header: 'Absent', value: r => r.absent, align: 'right' },
  { header: 'Total', value: r => r.total, align: 'right' },
  { header: 'Attendance %', value: r => r.percentage, render: r => <PercentBadge value={r.percentage} />, align: 'right' }
];

const STUDENT_COLUMNS: Column<CustomStudentRow>[] = [
  { header: 'Roll Number', value: r => r.rollNumber },
  { header: 'Student Name', value: r => r.studentName },
  { header: 'Status', value: r => r.status.charAt(0) + r.status.slice(1).toLowerCase(), render: r => <StatusBadge status={r.status} /> },
  { header: 'Away (min)', value: r => r.awayMinutes, align: 'right' }
];

export const CustomReport: React.FC = () => {
  const [period, setPeriod] = useState<Period>('day');
  const [date, setDate] = useState(todayISO());
  const [month, setMonth] = useState(currentMonth());
  const [sessionId, setSessionId] = useState('');
  const chartsRef = useRef<HTMLDivElement>(null);

  // Changing the period or date makes the previously chosen session meaningless.
  const changePeriod = (p: Period) => { setPeriod(p); setSessionId(''); };
  const changeDate = (d: string) => { setDate(d); setSessionId(''); };
  const changeMonth = (m: string) => { setMonth(m); setSessionId(''); };

  const ready = period === 'month' ? !!month : !!date;
  const { data, loading, error } = useReportData(
    signal => reportService.custom({ period, date, month, sessionId }, signal),
    [period, date, month, sessionId],
    ready
  );

  const single = !!sessionId && !!data && data.sessions.length === 1;
  const selectedTitle = data?.sessionOptions.find(o => o.id === sessionId)?.title;

  const buildExport = () => {
    if (!data) return null;
    const students = single
      ? toExportTable('Students in this session', STUDENT_COLUMNS, data.students)
      : toExportTable('Students (totals across these sessions)', STUDENT_TOTAL_COLUMNS, data.studentSummary);
    return {
      reportType: single ? 'custom_session' : `custom_${period}`,
      title: single ? `Custom Session - ${data.sessions[0].title}` : `Custom Sessions - ${PERIOD_LABEL[period]}`,
      filters: [
        { label: 'Period', value: `${PERIOD_LABEL[period]} (${data.rangeLabel})` },
        { label: 'Session', value: selectedTitle || 'All sessions' }
      ],
      tables: [students, toExportTable('Sessions', SESSION_COLUMNS, data.sessions)]
    };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <p className="text-xs text-slate-500">
          Workshops, trainings, SDPs and other custom sessions. These are kept separate from regular classes.
        </p>
        <ExportButtons build={buildExport} chartsRootRef={chartsRef} />
      </div>

      <FilterBar>
        <PeriodControls
          period={period} onPeriod={changePeriod}
          date={date} onDate={changeDate}
          month={month} onMonth={changeMonth}
          rangeLabel={data?.rangeLabel}
        />
        <FilterField label="Session">
          <SelectInput ariaLabel="Session" value={sessionId} onChange={setSessionId} allLabel="All sessions"
            options={(data?.sessionOptions ?? []).map(o => ({ value: o.id, label: `${displayDate(o.date)} - ${o.title}` }))} />
        </FilterField>
      </FilterBar>

      {!ready ? (
        <EmptyBlock title="Choose a date" hint="Pick a date or month to see the report." />
      ) : loading && !data ? (
        <LoadingBlock />
      ) : error ? (
        <ErrorBlock message={error} />
      ) : !data || data.sessions.length === 0 ? (
        <EmptyBlock title="No custom sessions found" hint="Try changing the period, or pick a different date." />
      ) : (
        <div className={`space-y-6 ${loading ? 'opacity-60 transition-opacity' : ''}`}>
          <SummaryCards items={[
            { label: 'Sessions', value: data.summary.sessions },
            { label: 'Present', value: data.summary.present, tone: 'success' },
            { label: 'Absent', value: data.summary.absent, tone: 'danger' },
            { label: 'Average attendance', value: `${data.summary.averagePercentage}%`, tone: 'blue' }
          ]} />

          <div ref={chartsRef} className="grid grid-cols-1 gap-4">
            {single ? (
              <ChartCard title="Present vs absent" hasData={data.summary.totalStudents > 0}>
                <PresentAbsentDonut present={data.summary.present} absent={data.summary.absent} />
              </ChartCard>
            ) : (
              <ChartCard title="Attendance % by session" hasData={data.sessions.length > 0}>
                <PercentTrendChart
                  kind="bar"
                  data={data.sessions.map(s => ({
                    label: s.title.length > 18 ? `${s.title.slice(0, 17)}...` : s.title,
                    percentage: s.percentage, present: s.present, absent: s.absent, sessions: 1
                  }))}
                />
              </ChartCard>
            )}
          </div>

          <div className="space-y-3">
            {single ? (
              <>
                <SectionTitle hint="Final status of every student in this session.">Students in this session</SectionTitle>
                <DataTable caption="Students" columns={STUDENT_COLUMNS} rows={data.students} rowKey={(r, i) => `${r.rollNumber}-${i}`} />
              </>
            ) : (
              <>
                <SectionTitle hint="Totals for every student across the custom sessions in this period.">Students</SectionTitle>
                <DataTable caption="Students" columns={STUDENT_TOTAL_COLUMNS} rows={data.studentSummary} rowKey={r => r.rollNumber} />
              </>
            )}
          </div>

          <div className="space-y-3">
            <SectionTitle>Sessions</SectionTitle>
            <DataTable caption="Custom sessions" columns={SESSION_COLUMNS} rows={data.sessions} rowKey={r => r.id} />
          </div>
        </div>
      )}
    </div>
  );
};
