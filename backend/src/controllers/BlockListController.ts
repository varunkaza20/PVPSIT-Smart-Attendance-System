import { Response, NextFunction } from 'express';
import XLSX from 'xlsx';
import { AuthenticatedRequest } from '../types';
import { BlockListService } from '../services/BlockListService';
import { CustomError } from '../middlewares/errorMiddleware';

const ROLL_HEADERS = ['roll_number', 'roll number', 'rollnumber', 'rollno', 'roll no', 'roll'];

export class BlockListController {
  private service = new BlockListService();

  list = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      return res.status(200).json({ success: true, data: await this.service.list() });
    } catch (e) { next(e); }
  };

  add = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { rollNumbers, reason } = req.body;
      const result = await this.service.addMany(rollNumbers, reason, req.user?.userId);
      return res.status(200).json({ success: true, ...result });
    } catch (e) { next(e); }
  };

  /** Excel upload: reads the roll number column (by header, else the first column). */
  importExcel = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      if (!req.file) {
        const err: CustomError = new Error('Please upload an Excel file.');
        err.statusCode = 400;
        throw err;
      }
      const wb = XLSX.read(req.file.buffer, { type: 'buffer' });
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const grid = XLSX.utils.sheet_to_json<any[]>(sheet, { header: 1, defval: '' });
      if (!grid.length) {
        const err: CustomError = new Error('The spreadsheet is empty.');
        err.statusCode = 400;
        throw err;
      }
      const header = (grid[0] || []).map(h => String(h).trim().toLowerCase());
      let col = header.findIndex(h => ROLL_HEADERS.includes(h));
      let start = 1;
      if (col === -1) { col = 0; start = 0; } // no header row: use column A
      const rolls = grid.slice(start).map(r => r[col]).filter(v => String(v ?? '').trim() !== '');
      const result = await this.service.addMany(rolls, req.body?.reason, req.user?.userId);
      return res.status(200).json({ success: true, ...result });
    } catch (e) { next(e); }
  };

  remove = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      await this.service.remove(req.params.id);
      return res.status(200).json({ success: true });
    } catch (e) { next(e); }
  };

  removeAll = async (_req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      return res.status(200).json({ success: true, removed: await this.service.removeAll() });
    } catch (e) { next(e); }
  };
}
