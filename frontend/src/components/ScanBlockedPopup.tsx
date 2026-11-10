import React, { useEffect } from 'react';
import { Ban } from 'lucide-react';

export interface BlockedScanInfo {
  message: string;
  rollNumber?: string;
  studentName?: string;
  /** Extra line, e.g. the defaulter's current attendance */
  detail?: string;
}

/**
 * Pop-up shown when a scan is refused (block list / defaulter).
 * It stays until the faculty dismisses it with the button (or Escape). It does NOT close on its own,
 * on a backdrop click, or on a scanner's Enter key (the button never takes focus automatically).
 */
export const ScanBlockedPopup: React.FC<{ info: BlockedScanInfo | null; onClose: () => void }> = ({ info, onClose }) => {
  useEffect(() => {
    if (!info) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [info, onClose]);

  if (!info) return null;
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4" role="alertdialog" aria-modal="true" aria-live="assertive">
      <div className="w-full max-w-md rounded-2xl border-2 border-pvpsit-danger bg-white p-8 text-center shadow-2xl">
        <Ban className="mx-auto h-14 w-14 text-pvpsit-danger" />
        <h2 className="mt-4 text-xl font-extrabold text-pvpsit-danger">{info.message}</h2>
        {(info.studentName || info.rollNumber) && (
          <p className="mt-3 text-sm font-semibold text-slate-600">
            {[info.studentName, info.rollNumber].filter(Boolean).join(' - ')}
          </p>
        )}
        {info.detail && <p className="mt-1 text-sm font-bold text-slate-700">{info.detail}</p>}
        <button
          type="button"
          onClick={onClose}
          className="mt-6 rounded-lg bg-pvpsit-danger px-8 py-2.5 text-sm font-bold text-white shadow-sm hover:bg-red-700"
        >
          Dismiss
        </button>
      </div>
    </div>
  );
};
