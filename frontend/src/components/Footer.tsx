import React from 'react';

const DEVELOPERS = [
  { name: 'Varun Kaza', roll: '23501A0569', years: '2023-2027' },
  { name: 'Koka Bharadwaj', roll: '23501A0577', years: '2023-2027' }
];

const GUIDES = ['Dr. B. Vishnu Vardhan', 'Mr. D. Lokesh Sai Kumar'];

const Label: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <p className="whitespace-nowrap border-r border-pvpsit-border pr-5 text-xs font-bold uppercase tracking-wide text-slate-500">
    {children}
  </p>
);

/** Credits bar pinned to the bottom of the screen (outside the scrolling area). */
export const Footer: React.FC = () => (
  <footer className="shrink-0 border-t border-pvpsit-border bg-pvpsit-card px-6 py-2.5 print:hidden">
    <div className="mx-auto flex max-w-5xl flex-wrap items-center justify-center gap-x-10 gap-y-2">
      {/* Developers */}
      <div className="flex items-center gap-5">
        <Label>Developed By</Label>
        <div className="flex flex-wrap items-start gap-x-10 gap-y-2">
          {DEVELOPERS.map(d => (
            <div key={d.roll} className="leading-tight">
              <p className="text-sm font-bold text-pvpsit-blue">{d.name}</p>
              <p className="text-xs text-slate-500">{d.roll}</p>
              <p className="text-xs text-slate-500">{d.years}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Guides */}
      <div className="flex items-center gap-5 border-l border-pvpsit-border pl-10 max-lg:border-l-0 max-lg:pl-0">
        <Label>Under the Guidance of</Label>
        <div className="flex flex-wrap items-center gap-x-10 gap-y-1">
          {GUIDES.map(g => (
            <p key={g} className="text-sm font-bold text-pvpsit-blue">{g}</p>
          ))}
        </div>
      </div>
    </div>
  </footer>
);
