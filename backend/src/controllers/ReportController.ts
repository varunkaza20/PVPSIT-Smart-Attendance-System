import { Response, NextFunction } from 'express';
import { ReportService } from '../services/ReportService';
import { ExportService } from '../services/ExportService';
import { AuthenticatedRequest } from '../types';

export class ReportController {
  private reportService = new ReportService();
  private exportService = new ExportService();

  getFilterOptions = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.reportService.getFilterOptions(req.query);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getSubjectsReport = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.reportService.getSubjectsReport(req.query as any);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getCustomReport = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.reportService.getCustomReport(req.query as any);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  getDefaultersReport = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const data = await this.reportService.getDefaultersReport(req.query as any);
      return res.status(200).json({ success: true, data });
    } catch (error) {
      next(error);
    }
  };

  exportExcel = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const payload = this.exportService.parsePayload(req.body);
      const buffer = await this.exportService.exportExcel(payload, req.user?.fullName);
      res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
      res.setHeader('Content-Disposition', `attachment; filename="${this.exportService.fileName(payload, 'xlsx')}"`);
      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  };

  exportPdf = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const payload = this.exportService.parsePayload(req.body);
      const buffer = await this.exportService.exportPdf(payload, req.user?.fullName);
      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader('Content-Disposition', `attachment; filename="${this.exportService.fileName(payload, 'pdf')}"`);
      return res.send(buffer);
    } catch (error) {
      next(error);
    }
  };
}
