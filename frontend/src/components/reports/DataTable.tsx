import React from 'react';

export interface Column<T> {
  header: string;
  /** Plain value used for the table cell and for Excel/PDF export */
  value: (row: T) => string | number;
  /** Optional richer on-screen rendering (badges etc.) */
  render?: (row: T) => React.ReactNode;
  align?: 'left' | 'right';
}

export function DataTable<T>({ columns, rows, rowKey, caption }: {
  columns: Column<T>[];
  rows: T[];
  rowKey: (row: T, index: number) => string;
  caption: string;
}) {
  return (
    <div className="bg-pvpsit-card rounded-xl border border-pvpsit-border overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left border-collapse text-xs" aria-label={caption}>
          <thead className="bg-slate-50 border-b border-pvpsit-border text-slate-600 font-semibold">
            <tr>
              {columns.map(c => (
                <th key={c.header} scope="col" className={`px-4 py-3 whitespace-nowrap ${c.align === 'right' ? 'text-right' : ''}`}>
                  {c.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 text-slate-700">
            {rows.map((row, i) => (
              <tr key={rowKey(row, i)} className="hover:bg-slate-50">
                {columns.map(c => (
                  <td key={c.header} className={`px-4 py-2.5 ${c.align === 'right' ? 'text-right' : ''}`}>
                    {c.render ? c.render(row) : c.value(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="px-4 py-2 text-[11px] text-slate-400 border-t border-pvpsit-border">{rows.length} row(s)</div>
    </div>
  );
}

/** Builds the columns/rows pair the export API expects from the same column definitions. */
export function toExportTable<T>(title: string, columns: Column<T>[], rows: T[]) {
  return {
    title,
    columns: columns.map(c => c.header),
    rows: rows.map(r => columns.map(c => c.value(r)))
  };
}
