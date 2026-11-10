import { Settings, ISettings } from '../models/Settings';

export class SettingsRepository {
  async getSettings(): Promise<ISettings> {
    let settings = await Settings.findOne({});
    if (!settings) {
      settings = new Settings({
        collegeName: 'Prasad V. Potluri Siddhartha Institute of Technology',
        collegeShortName: 'PVPSIT',
        attendanceThreshold: 75,
        timezone: 'Asia/Kolkata',
        sessionTimeout: 50,
        enableScannerSound: false
      });
      await settings.save();
    }
    return settings;
  }

  async updateSettings(settingsData: Partial<ISettings>): Promise<ISettings> {
    const settings = await this.getSettings();
    Object.assign(settings, settingsData);
    return settings.save();
  }
}
