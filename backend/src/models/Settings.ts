import { Schema, model, Document } from 'mongoose';

export interface ISettings extends Document {
  collegeName: string;
  collegeShortName: string;
  attendanceThreshold: number; // e.g. 75
  timezone: string; // e.g. "Asia/Kolkata"
  sessionTimeout: number; // in minutes, e.g. 50
  enableScannerSound: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SettingsSchema = new Schema<ISettings>(
  {
    collegeName: { type: String, required: true, default: 'Prasad V. Potluri Siddhartha Institute of Technology' },
    collegeShortName: { type: String, required: true, default: 'PVPSIT' },
    attendanceThreshold: { type: Number, required: true, default: 75 },
    timezone: { type: String, required: true, default: 'Asia/Kolkata' },
    sessionTimeout: { type: Number, required: true, default: 50 },
    enableScannerSound: { type: Boolean, required: true, default: false }
  },
  { timestamps: true }
);

export const Settings = model<ISettings>('Settings', SettingsSchema);
