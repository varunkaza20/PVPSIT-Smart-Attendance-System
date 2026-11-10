import React from 'react';
import { Period } from '../../types/reports';
import { PERIOD_LABEL } from '../../utils/reportDates';

const FIELD_CLASS = 'w-full px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none focus:ring-2 focus:ring-pvpsit-blue/30';

export const FilterField: React.FC<{ label: string; hint?: string; children: React.ReactNode }> = ({ label, hint, children }) => (
  <div>
    <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">{label}</label>
    {children}
    {hint && <p className="text-[10px] text-slate-400 mt-1">{hint}</p>}
  </div>
);

interface Option { value: string; label: string }

export const SelectInput: React.FC<{
  value: string;
  onChange: (value: string) => void;
  options: Option[];
  allLabel?: string;
  ariaLabel: string;
}> = ({ value, onChange, options, allLabel, ariaLabel }) => (
  <select aria-label={ariaLabel} className={FIELD_CLASS} value={value} onChange={e => onChange(e.target.value)}>
    {allLabel !== undefined && <option value="">{allLabel}</option>}
    {options.map(o => (
      <option key={o.value} value={o.value}>{o.label}</option>
    ))}
  </select>
);

export const TextInput: React.FC<React.InputHTMLAttributes<HTMLInputElement> & { ariaLabel: string }> = ({ ariaLabel, ...rest }) => (
  <input aria-label={ariaLabel} className={FIELD_CLASS} {...rest} />
);

/** Day / Weekly / Monthly switch plus the matching date or month picker. */
export const PeriodControls: React.FC<{
  period: Period;
  onPeriod: (p: Period) => void;
  date: string;
  onDate: (d: string) => void;
  month: string;
  onMonth: (m: string) => void;
  rangeLabel?: string;
}> = ({ period, onPeriod, date, onDate, month, onMonth, rangeLabel }) => (
  <>
    <FilterField label="Period">
      <div className="flex rounded-lg border border-pvpsit-border overflow-hidden bg-slate-50" role="group" aria-label="Report period">
        {(['day', 'week', 'month'] as Period[]).map(p => (
          <button
            key={p}
            type="button"
            onClick={() => onPeriod(p)}
            aria-pressed={period === p}
            className={`flex-1 px-2 py-2 text-xs font-semibold transition-colors ${
              period === p ? 'bg-pvpsit-blue text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {PERIOD_LABEL[p]}
          </button>
        ))}
      </div>
    </FilterField>

    {period === 'month' ? (
      <FilterField label="Month">
        <TextInput ariaLabel="Month" type="month" value={month} onChange={e => onMonth(e.target.value)} />
      </FilterField>
    ) : (
      <FilterField
        label={period === 'week' ? 'Any date in the week' : 'Date'}
        hint={period === 'week' && rangeLabel ? `Week: ${rangeLabel}` : undefined}
      >
        <TextInput ariaLabel="Date" type="date" value={date} onChange={e => onDate(e.target.value)} />
      </FilterField>
    )}
  </>
);
