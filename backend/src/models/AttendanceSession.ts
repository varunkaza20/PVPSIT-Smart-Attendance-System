import { Schema, model, Document, Types } from 'mongoose';

export interface IScan {
  action: 'IN' | 'OUT';
  timestamp: Date;
}

export interface IAttendanceRecord {
  studentId: Types.ObjectId;
  rollNumber: string;
  studentName: string;
  status: 'PRESENT' | 'ABSENT' | 'AWAY';
  scans: IScan[];
  totalAwayMinutes: number;
  finalDecision?: 'PRESENT' | 'ABSENT';
  /** Set when a scan by this student was refused (defaulter / block list): faculty decides at session end */
  blockedReason?: 'DEFAULTER' | 'BLOCKLIST';
}

export interface IAttendanceSession extends Document {
  sessionCode: string;
  sessionType: 'REGULAR';
  facultyId: Types.ObjectId;
  subjectId: Types.ObjectId;
  laboratoryId?: Types.ObjectId;
  timetableId?: Types.ObjectId;
  academicYear: string;
  year: number;
  semester: number;
  section: string;
  sessionDate: Date;
  totalStudents: number;
  startTime: Date;
  endTime?: Date;
  sessionStatus: 'ACTIVE' | 'ENDING' | 'COMPLETED';
  attendance: IAttendanceRecord[];
  
  editedBy?: Types.ObjectId;
  editedAt?: Date;
  editHistory: {
    studentId: Types.ObjectId;
    previousStatus: 'PRESENT' | 'ABSENT';
    newStatus: 'PRESENT' | 'ABSENT';
    reason: string;
    editedBy: Types.ObjectId;
    editedAt: Date;
  }[];
  
  createdAt: Date;
  updatedAt: Date;
}

const ScanSchema = new Schema<IScan>({
  action: { type: String, enum: ['IN', 'OUT'], required: true },
  timestamp: { type: Date, required: true, default: Date.now }
}, { _id: false });

const AttendanceRecordSchema = new Schema<IAttendanceRecord>({
  studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
  rollNumber: { type: String, required: true },
  studentName: { type: String, required: true },
  status: { type: String, enum: ['PRESENT', 'ABSENT', 'AWAY'], default: 'ABSENT' },
  scans: [ScanSchema],
  totalAwayMinutes: { type: Number, default: 0 },
  finalDecision: { type: String, enum: ['PRESENT', 'ABSENT'] },
  blockedReason: { type: String, enum: ['DEFAULTER', 'BLOCKLIST'] }
}, { _id: false });

const AttendanceSessionSchema = new Schema<IAttendanceSession>(
  {
    sessionCode: { type: String, required: true, unique: true, index: true },
    sessionType: { type: String, enum: ['REGULAR'], default: 'REGULAR' },
    facultyId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true, index: true },
    laboratoryId: { type: Schema.Types.ObjectId, ref: 'Laboratory' },
    timetableId: { type: Schema.Types.ObjectId, ref: 'Timetable' },
    academicYear: { 
      type: String, 
      required: true,
      default: function(this: any) {
        const date = this.startTime || new Date();
        const year = date.getFullYear();
        const month = date.getMonth();
        return month >= 5 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
      }
    },
    year: { type: Number, required: true },
    semester: { type: Number, required: true },
    section: { type: String, required: true, index: true },
    sessionDate: { 
      type: Date, 
      required: true,
      default: function(this: any) {
        const date = new Date(this.startTime || new Date());
        const localDateStr = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
        return new Date(localDateStr);
      }
    },
    totalStudents: { type: Number, required: true },
    startTime: { type: Date, required: true, index: true },
    endTime: { type: Date },
    sessionStatus: {
      type: String,
      enum: ['ACTIVE', 'ENDING', 'COMPLETED'],
      default: 'ACTIVE',
      index: true
    },
    attendance: [AttendanceRecordSchema],
    editedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    editedAt: { type: Date },
    editHistory: [
      {
        studentId: { type: Schema.Types.ObjectId, ref: 'Student', required: true },
        previousStatus: { type: String, enum: ['PRESENT', 'ABSENT'], required: true },
        newStatus: { type: String, enum: ['PRESENT', 'ABSENT'], required: true },
        reason: { type: String, required: true },
        editedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
        editedAt: { type: Date, required: true, default: Date.now }
      }
    ]
  },
  { timestamps: true }
);

// Compound Index for fast retrieves
AttendanceSessionSchema.index({
  academicYear: 1,
  year: 1,
  semester: 1,
  section: 1,
  sessionDate: 1,
  startTime: 1,
  facultyId: 1
});

export const AttendanceSession = model<IAttendanceSession>('AttendanceSession', AttendanceSessionSchema);
