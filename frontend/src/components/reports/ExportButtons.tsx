import React, { useState } from 'react';
import toast from 'react-hot-toast';
import { FileSpreadsheet, FileText } from 'lucide-react';
import { ExportRequest } from '../../types/reports';
import { reportService } from '../../services/reportService';
import { captureCharts, readExportError, saveBlob } from '../../utils/chartExport';

/**
 * Export to Excel / PDF. For PDF, every chart inside `chartsRootRef` (marked data-report-chart)
 * is captured as an image in the browser and sent with the table.
 */
export const ExportButtons: React.FC<{
  build: () => Omit<ExportRequest, 'charts'> | null;
  chartsRootRef: React.RefObject<HTMLElement | null>;
}> = ({ build, chartsRootRef }) => {
  const [busy, setBusy] = useState<'excel' | 'pdf' | null>(null);
  const payload = build();
  const hasRows = !!payload && payload.tables.some(t => t.rows.length > 0);
  const disabled = !hasRows || busy !== null;

  const run = async (kind: 'excel' | 'pdf') => {
    const base = build();
    if (!base || !base.tables.some(t => t.rows.length > 0)) {
      toast.error('There is no data to export.');
      return;
    }
    setBusy(kind);
    try {
      const charts = kind === 'pdf' ? await captureCharts(chartsRootRef.current) : undefined;
      const { blob, filename } = await reportService.export(kind, { ...base, charts });
      saveBlob(blob, filename);
      toast.success(kind === 'pdf' ? 'PDF exported.' : 'Excel exported.');
    } catch (err) {
      toast.error(await readExportError(err));
    } finally {
      setBusy(null);
    }
  };

  const btn = 'flex items-center px-4 py-2 border border-slate-200 text-xs font-semibold rounded-lg text-slate-700 bg-white hover:bg-slate-100 disabled:opacity-50';
  return (
    <div className="flex space-x-2">
      <button type="button" onClick={() => run('excel')} disabled={disabled} className={btn}>
        <FileSpreadsheet className="w-4 h-4 mr-1.5 text-pvpsit-success" />
        {busy === 'excel' ? 'Exporting...' : 'Export Excel'}
      </button>
      <button type="button" onClick={() => run('pdf')} disabled={disabled} className={btn}>
        <FileText className="w-4 h-4 mr-1.5 text-pvpsit-danger" />
        {busy === 'pdf' ? 'Exporting...' : 'Export PDF'}
      </button>
    </div>
  );
};
