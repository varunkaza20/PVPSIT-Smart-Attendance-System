import { Schema, model, Document, Types } from 'mongoose';
import { IAttendanceRecord, IScan } from './AttendanceSession';

export interface ICustomAttendanceSession extends Document {
  sessionCode: string;
  sessionTitle: string;
  description?: string;
  facultyId: Types.ObjectId;
  venue: string;
  eventDate: Date;
  totalStudents: number;
  sessionStatus: 'ACTIVE' | 'ENDING' | 'COMPLETED';
  startTime: Date;
  endTime?: Date;
  academicYear?: string;
  year?: number;
  semester?: number;
  section?: string;
  attendance: IAttendanceRecord[];
  createdAt: Date;
  updatedAt: Date;
}

const ScanSchema = new Schema<IScan>({
  action: { type: String, enum: ['IN', 'OUT'], required: true },
  timestamp: { type: Date, required: true, default: Date.now }
}, { _id: false });

const CustomAttendanceRecordSchema = new Schema<IAttendanceRecord>({
  studentId: { type: Schema.Types.ObjectId, ref: 'Student' }, // can be optional if student is entered purely manually or not yet mapped in database, but standard is referencing if exists
  rollNumber: { type: String, required: true },
  studentName: { type: String, required: true },
  status: { type: String, enum: ['PRESENT', 'ABSENT', 'AWAY'], default: 'ABSENT' },
  scans: [ScanSchema],
  totalAwayMinutes: { type: Number, default: 0 },
  finalDecision: { type: String, enum: ['PRESENT', 'ABSENT'] }
}, { _id: false });

const CustomAttendanceSessionSchema = new Schema<ICustomAttendanceSession>(
  {
    sessionCode: { type: String, required: true, unique: true, index: true },
    sessionTitle: { type: String, required: true },
    description: { type: String },
    facultyId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    venue: { type: String, required: true },
    eventDate: { type: Date, required: true, index: true },
    totalStudents: { type: Number, required: true, default: 0 },
    sessionStatus: {
      type: String,
      enum: ['ACTIVE', 'ENDING', 'COMPLETED'],
      default: 'ACTIVE'
    },
    startTime: { type: Date, required: true },
    endTime: { type: Date },
    academicYear: { type: String },
    year: { type: Number },
    semester: { type: Number },
    section: { type: String },
    attendance: [CustomAttendanceRecordSchema]
  },
  { timestamps: true }
);

export const CustomAttendanceSession = model<ICustomAttendanceSession>(
  'CustomAttendanceSession',
  CustomAttendanceSessionSchema
);
