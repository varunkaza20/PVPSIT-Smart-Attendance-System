import React, { useState } from 'react';
import { ReportTab } from '../types/reports';
import { SubjectsReport } from '../components/reports/SubjectsReport';
import { CustomReport } from '../components/reports/CustomReport';
import { DefaultersReport } from '../components/reports/DefaultersReport';

const TABS: { id: ReportTab; label: string }[] = [
  { id: 'subjects', label: 'Subjects' },
  { id: 'custom', label: 'Custom' },
  { id: 'defaulters', label: 'Defaulters' }
];

export const Reports: React.FC = () => {
  const [activeTab, setActiveTab] = useState<ReportTab>('subjects');

  return (
    <div className="space-y-6">
      <div className="border-b border-pvpsit-border pb-4">
        <h1 className="text-2xl font-bold text-pvpsit-blue">Analytics Reports</h1>
        <p className="text-xs text-slate-500 mt-1">Attendance reports for regular classes and custom sessions.</p>
      </div>

      <div className="flex border-b border-pvpsit-border bg-white rounded-t-xl overflow-hidden p-1.5 space-x-1" role="tablist">
        {TABS.map(tab => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`px-5 py-2.5 text-sm font-semibold rounded-lg transition-colors ${
              activeTab === tab.id ? 'bg-pvpsit-blue text-white' : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === 'subjects' && <SubjectsReport />}
      {activeTab === 'custom' && <CustomReport />}
      {activeTab === 'defaulters' && <DefaultersReport />}
    </div>
  );
};
