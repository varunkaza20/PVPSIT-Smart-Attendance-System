import { Schema, model, Document } from 'mongoose';

export interface ISubject extends Document {
  subjectCode: string;
  subjectName: string;
  shortName: string;
  year: number;
  semester: number;
  department: string;
  isLaboratory: boolean;
  credits: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const SubjectSchema = new Schema<ISubject>(
  {
    subjectCode: { type: String, required: true, unique: true, index: true },
    subjectName: { type: String, required: true },
    shortName: { type: String, required: true },
    year: { type: Number, required: true },
    semester: { type: Number, required: true },
    department: { type: String, required: true },
    isLaboratory: { type: Boolean, default: false },
    credits: { type: Number, required: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Subject = model<ISubject>('Subject', SubjectSchema);
