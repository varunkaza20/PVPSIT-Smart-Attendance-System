import fs from 'fs';
import path from 'path';
import XLSX from 'xlsx';
import { jsPDF } from 'jspdf';
import 'jspdf-autotable'; // patches the jsPDF prototype
import { CustomError } from '../middlewares/errorMiddleware';

interface jsPDFWithAutoTable extends jsPDF {
  autoTable: (options: any) => void;
  lastAutoTable?: { finalY: number };
}

export interface ExportChart {
  title: string;
  /** PNG data URL captured from the chart on screen */
  image: string;
}

export interface ExportTable {
  title: string;
  columns: string[];
  rows: (string | number)[][];
}

export interface ExportPayload {
  reportType: string;
  title: string;
  filters: { label: string; value: string }[];
  /** One or more tables, in the order they should appear. Empty tables are dropped. */
  tables: ExportTable[];
  charts: ExportChart[];
}

const MAX_ROWS = 5000;
const MAX_COLUMNS = 30;
const MAX_TABLES = 4;
const MAX_CHARTS = 4;
const MAX_IMAGE_CHARS = 6 * 1024 * 1024; // base64 characters per chart
const PNG_DATA_URL = /^data:image\/png;base64,[A-Za-z0-9+/]+=*$/;
const COLLEGE_NAME = 'PRASAD V. POTLURI SIDDHARTHA INSTITUTE OF TECHNOLOGY';

const badRequest = (message: string): CustomError => {
  const err: CustomError = new Error(message);
  err.statusCode = 400;
  return err;
};

const cleanText = (v: unknown, max: number): string => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').slice(0, max);

/** Reads width/height out of a PNG data URL header (IHDR chunk). */
const pngSize = (dataUrl: string): { w: number; h: number } | null => {
  try {
    const head = Buffer.from(dataUrl.slice(dataUrl.indexOf(',') + 1, dataUrl.indexOf(',') + 1 + 64), 'base64');
    if (head.length < 24 || head.toString('ascii', 1, 4) !== 'PNG') return null;
    return { w: head.readUInt32BE(16), h: head.readUInt32BE(20) };
  } catch {
    return null;
  }
};

let cachedLogo: { dataUrl: string; w: number; h: number } | null | undefined;
const loadLogo = () => {
  if (cachedLogo !== undefined) return cachedLogo;
  const candidates = [
    path.join(__dirname, '../../../frontend/public/pvpsit_logo.png'),
    path.join(process.cwd(), '../frontend/public/pvpsit_logo.png'),
    path.join(process.cwd(), 'frontend/public/pvpsit_logo.png')
  ];
  cachedLogo = null;
  for (const p of candidates) {
    try {
      const dataUrl = `data:image/png;base64,${fs.readFileSync(p).toString('base64')}`;
      const size = pngSize(dataUrl);
      if (size) { cachedLogo = { dataUrl, ...size }; break; }
    } catch { /* try next */ }
  }
  return cachedLogo;
};

export class ExportService {
  /** Validates and normalises the request body. Never trusts the client. */
  parsePayload(body: any): ExportPayload {
    if (!body || typeof body !== 'object') throw badRequest('Invalid export request.');

    const rawTables: unknown[] = Array.isArray(body.tables) ? body.tables.slice(0, MAX_TABLES) : [];
    const tables: ExportTable[] = [];
    for (const raw of rawTables as any[]) {
      const columns = Array.isArray(raw?.columns) ? raw.columns.map((c: unknown) => cleanText(c, 60)) : [];
      if (columns.length === 0 || columns.length > MAX_COLUMNS) throw badRequest('Invalid export columns.');
      if (!Array.isArray(raw.rows)) throw badRequest('Invalid export rows.');
      if (raw.rows.length === 0) continue; // nothing to show for this table
      if (raw.rows.length > MAX_ROWS) throw badRequest(`Too many rows to export (max ${MAX_ROWS}).`);

      const rows = raw.rows.map((r: unknown) => {
        if (!Array.isArray(r)) throw badRequest('Invalid export rows.');
        return columns.map((_: string, i: number) => {
          const cell = (r as unknown[])[i];
          return typeof cell === 'number' && Number.isFinite(cell) ? cell : cleanText(cell, 300);
        });
      });
      tables.push({ title: cleanText(raw.title, 100), columns, rows });
    }
    if (tables.length === 0) throw badRequest('No report data available to export.');

    const filters = (Array.isArray(body.filters) ? body.filters : []).slice(0, 20).map((f: any) => ({
      label: cleanText(f?.label, 40),
      value: cleanText(f?.value, 120)
    }));

    const charts: ExportChart[] = [];
    for (const c of (Array.isArray(body.charts) ? body.charts : []).slice(0, MAX_CHARTS)) {
      const image = typeof c?.image === 'string' ? c.image : '';
      if (!image) continue;
      if (image.length > MAX_IMAGE_CHARS || !PNG_DATA_URL.test(image) || !pngSize(image)) {
        throw badRequest('Invalid chart image in export request.');
      }
      charts.push({ title: cleanText(c.title, 100), image });
    }

    return {
      reportType: cleanText(body.reportType, 60) || 'report',
      title: cleanText(body.title, 150) || 'Attendance Report',
      filters,
      tables,
      charts
    };
  }

  fileName(payload: ExportPayload, ext: 'xlsx' | 'pdf'): string {
    const safe = payload.reportType.replace(/[^A-Za-z0-9_-]+/g, '_').replace(/^_+|_+$/g, '') || 'report';
    return `${safe}_${new Date().toISOString().slice(0, 10)}.${ext}`;
  }

  async exportExcel(payload: ExportPayload, generatedBy?: string): Promise<Buffer> {
    const wb = XLSX.utils.book_new();
    const usedNames = new Set<string>();
    const sheetName = (title: string, index: number) => {
      let base = (title || `Table ${index + 1}`).replace(/[\\/?*[\]:]/g, ' ').trim().slice(0, 28) || `Table ${index + 1}`;
      let name = base;
      for (let n = 2; usedNames.has(name.toLowerCase()); n++) name = `${base} ${n}`;
      usedNames.add(name.toLowerCase());
      return name;
    };

    payload.tables.forEach((table, index) => {
      const aoa: (string | number)[][] = [];
      if (index === 0) {
        // The first sheet carries the report title and applied filters.
        aoa.push([payload.title]);
        aoa.push([`Generated: ${new Date().toLocaleString()}${generatedBy ? ` by ${generatedBy}` : ''}`]);
        payload.filters.forEach(f => aoa.push([`${f.label}: ${f.value}`]));
        aoa.push([]);
      }
      aoa.push(table.columns);
      table.rows.forEach(r => aoa.push(r));

      const ws = XLSX.utils.aoa_to_sheet(aoa);
      ws['!cols'] = table.columns.map((h, c) => {
        let max = h.length;
        table.rows.forEach(r => { max = Math.max(max, String(r[c] ?? '').length); });
        return { wch: Math.min(max + 3, 50) };
      });
      XLSX.utils.book_append_sheet(wb, ws, sheetName(table.title, index));
    });

    return XLSX.write(wb, { type: 'buffer', bookType: 'xlsx' }) as Buffer;
  }

  async exportPdf(payload: ExportPayload, generatedBy?: string): Promise<Buffer> {
    const orientation = payload.tables.some(t => t.columns.length > 6) ? 'l' : 'p';
    const doc = new jsPDF({ orientation, unit: 'mm', format: 'a4' }) as jsPDFWithAutoTable;
    const pageW = doc.internal.pageSize.getWidth();
    const pageH = doc.internal.pageSize.getHeight();
    const margin = 12;
    const contentW = pageW - margin * 2;
    const bottomLimit = pageH - 14;

    // ----- header: logo + college + title -----
    let y = 10;
    const logo = loadLogo();
    let textX = margin;
    if (logo) {
      const logoH = 18;
      const logoW = (logo.w / logo.h) * logoH;
      doc.addImage(logo.dataUrl, 'PNG', margin, y, logoW, logoH, undefined, 'FAST');
      textX = margin + logoW + 4;
    }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(logo ? 13 : 15);
    doc.setTextColor(0, 91, 172);
    doc.text(COLLEGE_NAME, textX, y + 6);
    doc.setFontSize(11);
    doc.setTextColor(15, 23, 42);
    doc.text(payload.title.toUpperCase(), textX, y + 13);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(71, 85, 105);
    doc.text(`Generated: ${new Date().toLocaleString()}${generatedBy ? `  |  By: ${generatedBy}` : ''}`, textX, y + 18);
    y += 24;
    doc.setDrawColor(226, 232, 240);
    doc.line(margin, y, pageW - margin, y);
    y += 5;

    // ----- applied filters -----
    if (payload.filters.length > 0) {
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(15, 23, 42);
      doc.text('Applied filters', margin, y);
      y += 4.5;
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8.5);
      const text = payload.filters.map(f => `${f.label}: ${f.value}`).join('   |   ');
      const lines = doc.splitTextToSize(text, contentW) as string[];
      doc.text(lines, margin, y);
      y += lines.length * 4 + 3;
    }

    // ----- charts: two per row, a lone last chart is centred -----
    if (payload.charts.length > 0) {
      const gap = 6;
      const colW = (contentW - gap) / 2;
      const maxH = 72;
      for (let i = 0; i < payload.charts.length; i += 2) {
        const pair = payload.charts.slice(i, i + 2);
        const slotW = pair.length === 1 ? Math.min(contentW, 150) : colW;
        const sized = pair.map(c => {
          const s = pngSize(c.image)!;
          let w = slotW;
          let h = (s.h / s.w) * w;
          if (h > maxH) { h = maxH; w = (s.w / s.h) * h; }
          return { c, w, h };
        });
        const rowH = Math.max(...sized.map(s => s.h)) + 6;
        if (y + rowH > bottomLimit) { doc.addPage(); y = 14; }

        sized.forEach((s, idx) => {
          const slotX = pair.length === 1 ? margin + (contentW - slotW) / 2 : margin + idx * (colW + gap);
          doc.setFont('helvetica', 'bold');
          doc.setFontSize(8.5);
          doc.setTextColor(0, 91, 172);
          doc.text(s.c.title, slotX, y + 2);
          doc.addImage(s.c.image, 'PNG', slotX + (slotW - s.w) / 2, y + 4, s.w, s.h, undefined, 'FAST');
        });
        y += rowH + 4;
      }
    }

    // ----- tables (each with its own heading) -----
    for (const table of payload.tables) {
      if (y > bottomLimit - 30) { doc.addPage(); y = 14; }
      if (table.title) {
        doc.setFont('helvetica', 'bold');
        doc.setFontSize(10);
        doc.setTextColor(0, 91, 172);
        doc.text(table.title, margin, y + 2);
        y += 5;
      }
      doc.autoTable({
        startY: y,
        head: [table.columns],
        body: table.rows,
        theme: 'grid',
        headStyles: { fillColor: [0, 91, 172], textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 8.5 },
        bodyStyles: { fontSize: 8, textColor: [15, 23, 42] },
        alternateRowStyles: { fillColor: [248, 250, 252] },
        margin: { left: margin, right: margin, bottom: 16 }
      });
      y = (doc.lastAutoTable?.finalY ?? y) + 8;
    }

    // ----- page numbers -----
    const total = doc.getNumberOfPages();
    for (let p = 1; p <= total; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(100, 116, 139);
      doc.text(`Page ${p} of ${total}`, pageW / 2, pageH - 7, { align: 'center' });
    }

    return Buffer.from(doc.output('arraybuffer'));
  }
}
