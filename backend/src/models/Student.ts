import { Schema, model, Document } from 'mongoose';

export interface IStudent extends Document {
  rollNumber: string;
  firstName: string;
  lastName: string;
  fullName: string;
  section: string;
  year: number; // 2 | 3 | 4
  semester: number; // 1 | 2
  department: string;
  regulation: string;
  admissionYear: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const StudentSchema = new Schema<IStudent>(
  {
    rollNumber: { type: String, required: true, unique: true, index: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    fullName: { type: String },
    section: { type: String, required: true, index: true },
    year: { type: Number, required: true, enum: [2, 3, 4], index: true },
    semester: { type: Number, required: true, enum: [1, 2], index: true },
    department: { type: String, required: true },
    regulation: { type: String, required: true },
    admissionYear: { type: Number, required: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

// Auto-derive fullName on save
StudentSchema.pre<IStudent>('save', function (next) {
  this.fullName = `${this.firstName} ${this.lastName}`.trim();
  next();
});

export const Student = model<IStudent>('Student', StudentSchema);
