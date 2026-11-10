import React from 'react';
import {
  Bar, BarChart, CartesianGrid, Cell, LabelList, Line, LineChart, Pie, PieChart,
  ResponsiveContainer, Tooltip, XAxis, YAxis
} from 'recharts';
import { ChartPoint } from '../../types/reports';

const BLUE = '#005BAC';
const GREEN = '#16A34A';
const RED = '#DC2626';
const AMBER = '#F59E0B';
const TICK = { fontSize: 11, fill: '#475569' };
const pctLabel = (v: unknown) => `${v}%`;

/**
 * Card around a chart. The inner div is tagged `data-report-chart` so the PDF export
 * can find the chart and capture it. Animations are off so a capture is never half-drawn.
 * Each chart below wraps itself in <ResponsiveContainer>: Recharts injects the measured
 * width/height into ITS DIRECT CHILD, so it must be the chart element itself.
 */
export const ChartCard: React.FC<{
  title: string;
  height?: number;
  hasData: boolean;
  children: React.ReactElement;
}> = ({ title, height = 260, hasData, children }) => (
  <div className="bg-pvpsit-card rounded-xl border border-pvpsit-border p-5">
    <h3 className="text-sm font-bold text-pvpsit-blue mb-3">{title}</h3>
    {hasData ? (
      <div data-report-chart="true" data-title={title} style={{ height }}>
        {children}
      </div>
    ) : (
      <div className="text-xs text-slate-400 py-10 text-center">No data for this chart.</div>
    )}
  </div>
);

/** Percentage over time (line) or per session (bars). */
export const PercentTrendChart: React.FC<{ data: ChartPoint[]; kind: 'bar' | 'line' }> = ({ data, kind }) => {
  const crowded = data.length > 6;
  // NOTE: Recharts does not look inside React Fragments (with React 19), so the axes are a
  // keyed array of elements rather than <>...</>. A fragment here silently drops the axes.
  const axes = [
    <CartesianGrid key="grid" strokeDasharray="3 3" stroke="#E2E8F0" />,
    <XAxis key="x" dataKey="label" tick={TICK} interval={0} angle={crowded ? -30 : 0} textAnchor={crowded ? 'end' : 'middle'} height={crowded ? 60 : 30} />,
    <YAxis key="y" domain={[0, 100]} tick={TICK} unit="%" width={44} />,
    <Tooltip key="tip" formatter={(v: number) => `${v}%`} />
  ];
  return (
    <ResponsiveContainer width="100%" height="100%">
    {kind === 'line' ? (
    <LineChart data={data} margin={{ top: 18, right: 16, left: 0, bottom: 0 }}>
      {axes}
      <Line type="monotone" dataKey="percentage" name="Attendance %" stroke={BLUE} strokeWidth={2} dot={{ r: 3 }} isAnimationActive={false}>
        <LabelList dataKey="percentage" position="top" formatter={pctLabel} style={{ fontSize: 10, fill: '#334155' }} />
      </Line>
    </LineChart>
  ) : (
    <BarChart data={data} margin={{ top: 18, right: 16, left: 0, bottom: 0 }}>
      {axes}
      <Bar dataKey="percentage" name="Attendance %" fill={BLUE} isAnimationActive={false}>
        <LabelList dataKey="percentage" position="top" formatter={pctLabel} style={{ fontSize: 10, fill: '#334155' }} />
      </Bar>
    </BarChart>
    )}
    </ResponsiveContainer>
  );
};

/** Horizontal bars of attendance % (by subject / section / lowest students). */
export const PercentBarsChart: React.FC<{ data: { label: string; percentage: number }[] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
  <BarChart data={data} layout="vertical" margin={{ top: 4, right: 40, left: 8, bottom: 0 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" horizontal={false} />
    <XAxis type="number" domain={[0, 100]} tick={TICK} unit="%" />
    <YAxis type="category" dataKey="label" tick={TICK} width={96} interval={0} />
    <Tooltip formatter={(v: number) => `${v}%`} />
    <Bar dataKey="percentage" name="Attendance %" isAnimationActive={false}>
      {data.map((d, i) => (
        <Cell key={i} fill={d.percentage >= 75 ? GREEN : d.percentage >= 60 ? AMBER : RED} />
      ))}
      <LabelList dataKey="percentage" position="right" formatter={pctLabel} style={{ fontSize: 10, fill: '#334155' }} />
    </Bar>
  </BarChart>
  </ResponsiveContainer>
);

/** Present vs absent split. Labels are drawn on the slices so they survive PDF capture. */
export const PresentAbsentDonut: React.FC<{ present: number; absent: number }> = ({ present, absent }) => {
  const data = [
    { name: 'Present', value: present },
    { name: 'Absent', value: absent }
  ];
  return (
    <ResponsiveContainer width="100%" height="100%">
    <PieChart>
      <Pie
        data={data}
        dataKey="value"
        nameKey="name"
        cx="50%"
        cy="50%"
        innerRadius={55}
        outerRadius={85}
        paddingAngle={3}
        isAnimationActive={false}
        label={(e: { name?: string; value?: number }) => `${e.name}: ${e.value}`}
      >
        <Cell fill={GREEN} />
        <Cell fill={RED} />
      </Pie>
      <Tooltip />
    </PieChart>
    </ResponsiveContainer>
  );
};

/** Count of students per attendance band. */
export const DistributionChart: React.FC<{ data: { label: string; count: number }[] }> = ({ data }) => (
  <ResponsiveContainer width="100%" height="100%">
  <BarChart data={data} margin={{ top: 18, right: 16, left: 0, bottom: 0 }}>
    <CartesianGrid strokeDasharray="3 3" stroke="#E2E8F0" />
    <XAxis dataKey="label" tick={TICK} interval={0} />
    <YAxis allowDecimals={false} tick={TICK} width={36} />
    <Tooltip />
    <Bar dataKey="count" name="Students" isAnimationActive={false}>
      {data.map((_, i) => (
        <Cell key={i} fill={i <= 2 ? RED : GREEN} />
      ))}
      <LabelList dataKey="count" position="top" style={{ fontSize: 10, fill: '#334155' }} />
    </Bar>
  </BarChart>
  </ResponsiveContainer>
);
