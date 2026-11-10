import { SettingsRepository } from '../repositories/SettingsRepository';
import { ISettings } from '../models/Settings';

export class SettingsService {
  private settingsRepo = new SettingsRepository();

  async getSettings(): Promise<ISettings> {
    return this.settingsRepo.getSettings();
  }

  async updateSettings(settingsData: Partial<ISettings>): Promise<ISettings> {
    return this.settingsRepo.updateSettings(settingsData);
  }
}
