import React from 'react';
import { AlertTriangle, Info } from 'lucide-react';

export interface SummaryItem {
  label: string;
  value: string | number;
  tone?: 'blue' | 'success' | 'danger' | 'warning';
}

const TONE: Record<NonNullable<SummaryItem['tone']>, string> = {
  blue: 'text-pvpsit-blue',
  success: 'text-pvpsit-success',
  danger: 'text-pvpsit-danger',
  warning: 'text-pvpsit-warning'
};

export const SummaryCards: React.FC<{ items: SummaryItem[] }> = ({ items }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    {items.map(item => (
      <div key={item.label} className="bg-pvpsit-card rounded-xl border border-pvpsit-border p-4">
        <div className={`text-2xl font-bold ${TONE[item.tone || 'blue']}`}>{item.value}</div>
        <div className="text-xs text-slate-500 font-medium mt-1">{item.label}</div>
      </div>
    ))}
  </div>
);

export const LoadingBlock: React.FC = () => (
  <div className="bg-pvpsit-card rounded-xl border border-pvpsit-border p-10 flex items-center justify-center" role="status">
    <div className="w-8 h-8 border-4 border-pvpsit-blue border-t-transparent rounded-full animate-spin mr-3" />
    <span className="text-sm font-semibold text-slate-500">Loading report...</span>
  </div>
);

export const ErrorBlock: React.FC<{ message: string }> = ({ message }) => (
  <div className="bg-red-50 border border-red-200 rounded-xl p-5 flex items-start" role="alert">
    <AlertTriangle className="w-5 h-5 text-pvpsit-danger mr-3 mt-0.5 shrink-0" />
    <div>
      <div className="text-sm font-semibold text-red-800">Could not load this report</div>
      <div className="text-xs text-red-700 mt-1">{message}</div>
    </div>
  </div>
);

export const EmptyBlock: React.FC<{ title: string; hint: string }> = ({ title, hint }) => (
  <div className="bg-pvpsit-card rounded-xl border border-pvpsit-border p-10 text-center">
    <Info className="w-8 h-8 text-slate-300 mx-auto mb-3" />
    <div className="text-sm font-semibold text-slate-600">{title}</div>
    <div className="text-xs text-slate-400 mt-1">{hint}</div>
  </div>
);

export const SectionTitle: React.FC<{ children: React.ReactNode; hint?: string }> = ({ children, hint }) => (
  <div>
    <h3 className="text-sm font-bold text-pvpsit-blue">{children}</h3>
    {hint && <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>}
  </div>
);

export const FilterBar: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div className="bg-pvpsit-card rounded-xl border border-pvpsit-border p-5">
    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 items-end">{children}</div>
  </div>
);

/** Percentage pill: green at 75+, amber at 60+, red below. */
export const PercentBadge: React.FC<{ value: number }> = ({ value }) => {
  const tone = value >= 75 ? 'bg-green-100 text-green-700' : value >= 60 ? 'bg-amber-100 text-amber-700' : 'bg-red-100 text-red-700';
  return <span className={`inline-block px-2 py-0.5 rounded-full font-semibold ${tone}`}>{value}%</span>;
};

export const StatusBadge: React.FC<{ status: string }> = ({ status }) => {
  const tone =
    status === 'PRESENT' || status === 'NORMAL' ? 'bg-green-100 text-green-700'
    : status === 'AWAY' ? 'bg-blue-100 text-blue-700'
    : 'bg-red-100 text-red-700';
  const text = status === 'NORMAL' ? 'Normal' : status === 'DEFAULTER' ? 'Defaulter' : status.charAt(0) + status.slice(1).toLowerCase();
  return <span className={`inline-block px-2 py-0.5 rounded-full font-semibold ${tone}`}>{text}</span>;
};

/** Two-option switch used above tables (e.g. "By subject" / "All sessions"). */
export const TableToggle: React.FC<{
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}> = ({ value, onChange, options }) => (
  <div className="inline-flex rounded-lg border border-pvpsit-border overflow-hidden bg-slate-50" role="group">
    {options.map(o => (
      <button
        key={o.value}
        type="button"
        onClick={() => onChange(o.value)}
        aria-pressed={value === o.value}
        className={`px-3 py-1.5 text-xs font-semibold ${value === o.value ? 'bg-pvpsit-blue text-white' : 'text-slate-600 hover:bg-slate-100'}`}
      >
        {o.label}
      </button>
    ))}
  </div>
);
