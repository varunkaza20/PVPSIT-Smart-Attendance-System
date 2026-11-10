import { Response, NextFunction } from 'express';
import { SettingsService } from '../services/SettingsService';
import { AuthenticatedRequest } from '../types';

export class SettingsController {
  private settingsService = new SettingsService();

  getSettings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const settings = await this.settingsService.getSettings();
      return res.status(200).json({
        success: true,
        data: settings
      });
    } catch (error) {
      next(error);
    }
  };

  updateSettings = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const settings = await this.settingsService.updateSettings(req.body);
      return res.status(200).json({
        success: true,
        message: 'Application settings updated successfully.',
        data: settings
      });
    } catch (error) {
      next(error);
    }
  };
}
