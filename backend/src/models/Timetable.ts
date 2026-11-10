import { Schema, model, Document, Types } from 'mongoose';

export interface ITimetable extends Document {
  academicYear: string;
  year: number; // 2 | 3 | 4
  semester: number; // 1 | 2
  section: string;
  facultyId: Types.ObjectId;
  subjectId: Types.ObjectId;
  laboratoryId?: Types.ObjectId;
  dayOfWeek: number; // 1 (Mon) - 6 (Sat)
  startTime: string; // "HH:MM" 24h or 12h representation
  endTime: string; // "HH:MM"
  duration: number; // in minutes
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const TimetableSchema = new Schema<ITimetable>(
  {
    academicYear: { type: String, required: true },
    year: { type: Number, required: true, enum: [2, 3, 4] },
    semester: { type: Number, required: true, enum: [1, 2] },
    section: { type: String, required: true },
    facultyId: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subjectId: { type: Schema.Types.ObjectId, ref: 'Subject', required: true },
    laboratoryId: { type: Schema.Types.ObjectId, ref: 'Laboratory' },
    dayOfWeek: { type: Number, required: true, enum: [1, 2, 3, 4, 5, 6], index: true },
    startTime: { type: String, required: true },
    endTime: { type: String, required: true },
    duration: { type: Number, required: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// Composite index or individual indexes as described in specification
TimetableSchema.index({ facultyId: 1, dayOfWeek: 1, section: 1 });

export const Timetable = model<ITimetable>('Timetable', TimetableSchema);
