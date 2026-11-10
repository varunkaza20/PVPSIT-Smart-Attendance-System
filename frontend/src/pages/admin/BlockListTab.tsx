import React, { useCallback, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { Ban, Trash, Upload, Plus } from 'lucide-react';
import { ConfirmModal } from '../../components/ConfirmModal';

interface IBlocked {
  id: string;
  rollNumber: string;
  studentName: string;
  section: string;
  year: number | null;
  reason: string;
  createdAt: string;
}

interface AddResult { added: number; alreadyBlocked: number; invalid: string[] }

/** Splits pasted text on new lines, commas, semicolons, tabs and spaces. */
const parseRolls = (text: string): string[] =>
  Array.from(new Set(text.split(/[\s,;]+/).map(s => s.trim().toUpperCase()).filter(Boolean)));

export const BlockListTab: React.FC = () => {
  const [items, setItems] = useState<IBlocked[]>([]);
  const [loading, setLoading] = useState(false);
  const [text, setText] = useState('');
  const [reason, setReason] = useState('');
  const [busy, setBusy] = useState(false);
  const [query, setQuery] = useState('');
  const [toRemove, setToRemove] = useState<IBlocked | null>(null);
  const [confirmClear, setConfirmClear] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/admin/blocklist');
      setItems(res.data.data || []);
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load the block list.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const report = (r: AddResult) => {
    const parts = [`${r.added} added`];
    if (r.alreadyBlocked) parts.push(`${r.alreadyBlocked} already blocked`);
    if (r.invalid.length) parts.push(`${r.invalid.length} invalid (${r.invalid.slice(0, 3).join(', ')}${r.invalid.length > 3 ? '...' : ''})`);
    (r.added ? toast.success : toast.error)(parts.join(' • '), { duration: 6000 });
  };

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    const rollNumbers = parseRolls(text);
    if (!rollNumbers.length) { toast.error('Enter at least one roll number.'); return; }
    setBusy(true);
    try {
      const res = await axios.post('/api/admin/blocklist', { rollNumbers, reason });
      report(res.data);
      if (res.data.invalid.length === 0) { setText(''); setReason(''); }
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add to the block list.');
    } finally { setBusy(false); }
  };

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const form = new FormData();
    form.append('file', file);
    if (reason.trim()) form.append('reason', reason.trim());
    setBusy(true);
    try {
      const res = await axios.post('/api/admin/blocklist/import', form, { headers: { 'Content-Type': 'multipart/form-data' } });
      report(res.data);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to import the Excel file.');
    } finally { setBusy(false); }
  };

  const handleRemove = async () => {
    if (!toRemove) return;
    try {
      await axios.delete(`/api/admin/blocklist/${toRemove.id}`);
      toast.success(`${toRemove.rollNumber} removed from the block list.`);
      setToRemove(null);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to remove.');
    }
  };

  const handleClear = async () => {
    try {
      const res = await axios.delete('/api/admin/blocklist');
      toast.success(`Block list cleared (${res.data.removed} removed).`);
      setConfirmClear(false);
      load();
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to clear the block list.');
    }
  };

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? items.filter(i => i.rollNumber.toLowerCase().includes(q) || i.studentName.toLowerCase().includes(q)) : items;
  }, [items, query]);

  return (
    <div className="grid grid-cols-3 gap-6">
      {/* Left: add */}
      <form onSubmit={handleAdd} className="col-span-1 bg-pvpsit-card rounded-xl border border-pvpsit-border p-5 space-y-4 self-start">
        <div className="flex items-center space-x-2 text-pvpsit-danger">
          <Ban className="w-5 h-5" />
          <h3 className="font-bold text-sm">Add to Block List</h3>
        </div>
        <p className="text-xs text-slate-500 leading-relaxed">
          Blocked roll numbers cannot scan in Regular or Custom attendance. They see "Student in Block List. Contact Faculty".
        </p>

        <div>
          <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Roll numbers (one per line, or separated by commas)</label>
          <textarea
            rows={7}
            className="w-full px-3 py-2 text-xs font-mono border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none focus:border-pvpsit-blue"
            placeholder={'23501A0501\n23501A0502'}
            value={text}
            onChange={e => setText(e.target.value)}
          />
          <p className="text-[11px] text-slate-400 mt-1">{parseRolls(text).length} roll number(s) entered</p>
        </div>

        <div>
          <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Reason (optional)</label>
          <input
            type="text"
            maxLength={200}
            className="w-full px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none"
            placeholder="e.g. Fee dues, disciplinary"
            value={reason}
            onChange={e => setReason(e.target.value)}
          />
        </div>

        <button type="submit" disabled={busy} className="w-full flex items-center justify-center px-4 py-2 text-xs font-bold bg-pvpsit-danger hover:bg-red-700 disabled:opacity-60 text-white rounded-lg">
          <Plus className="w-4 h-4 mr-1.5" /> Block these roll numbers
        </button>

        <div className="border-t border-slate-100 pt-4">
          <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Or import from Excel</label>
          <input
            type="file"
            accept=".xlsx,.xls"
            disabled={busy}
            onChange={handleFile}
            className="w-full px-3 py-1.5 text-xs border border-pvpsit-border rounded-lg bg-white cursor-pointer file:mr-3 file:py-0.5 file:px-2 file:rounded file:border-0 file:text-[11px] file:font-semibold file:bg-blue-50 file:text-pvpsit-blue hover:file:bg-blue-100"
          />
          <p className="text-[11px] text-slate-400 mt-1 flex items-start">
            <Upload className="w-3 h-3 mr-1 mt-0.5 shrink-0" />
            Uses the "Roll Number" column (or column A if there is no header). The reason above applies to all imported rows.
          </p>
        </div>
      </form>

      {/* Right: list */}
      <div className="col-span-2 bg-pvpsit-card rounded-xl border border-pvpsit-border overflow-hidden">
        <div className="p-4 border-b border-pvpsit-border bg-slate-50 flex items-center justify-between gap-3">
          <h3 className="font-bold text-pvpsit-blue text-sm">Blocked students ({items.length})</h3>
          <div className="flex items-center gap-2">
            <input
              type="text"
              placeholder="Search roll number or name"
              className="px-3 py-1.5 text-xs border border-pvpsit-border rounded-lg bg-white focus:outline-none w-56"
              value={query}
              onChange={e => setQuery(e.target.value)}
            />
            {items.length > 0 && (
              <button onClick={() => setConfirmClear(true)} className="px-3 py-1.5 text-xs font-bold text-pvpsit-danger border border-red-200 rounded-lg hover:bg-red-50">
                Clear all
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <div className="p-10 text-center text-xs text-slate-400">Loading...</div>
        ) : shown.length === 0 ? (
          <div className="p-10 text-center text-xs text-slate-400">{items.length === 0 ? 'No students are blocked.' : 'No matches.'}</div>
        ) : (
          <table className="w-full text-left border-collapse text-xs">
            <thead className="bg-slate-50 border-b border-pvpsit-border text-slate-600 font-semibold">
              <tr>
                <th className="px-4 py-3">Roll Number</th>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Section</th>
                <th className="px-4 py-3">Reason</th>
                <th className="px-4 py-3">Added</th>
                <th className="px-4 py-3 text-right">Remove</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {shown.map(i => (
                <tr key={i.id} className="hover:bg-slate-50">
                  <td className="px-4 py-2.5 font-semibold text-pvpsit-dark">{i.rollNumber}</td>
                  <td className="px-4 py-2.5">{i.studentName || <span className="text-slate-400">Not in roster</span>}</td>
                  <td className="px-4 py-2.5">{i.section || '-'}</td>
                  <td className="px-4 py-2.5">{i.reason || '-'}</td>
                  <td className="px-4 py-2.5 whitespace-nowrap">{new Date(i.createdAt).toLocaleDateString()}</td>
                  <td className="px-4 py-2.5 text-right">
                    <button onClick={() => setToRemove(i)} className="p-1.5 text-slate-400 hover:text-pvpsit-danger" title="Remove from block list" aria-label={`Remove ${i.rollNumber}`}>
                      <Trash className="w-4 h-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      <ConfirmModal
        isOpen={!!toRemove}
        title="Remove from Block List"
        message={`Allow ${toRemove?.rollNumber || ''} to scan again?`}
        onConfirm={handleRemove}
        onCancel={() => setToRemove(null)}
      />
      <ConfirmModal
        isOpen={confirmClear}
        title="Clear the Block List"
        message="This removes every blocked roll number. They will all be able to scan again."
        onConfirm={handleClear}
        onCancel={() => setConfirmClear(false)}
      />
    </div>
  );
};
