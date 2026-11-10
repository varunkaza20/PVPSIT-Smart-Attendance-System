import { Schema, model, Document, Types } from 'mongoose';

/** A roll number that is not allowed to scan (regular or custom attendance). */
export interface IBlockedStudent extends Document {
  rollNumber: string; // always stored trimmed + UPPERCASE
  reason?: string;
  addedBy?: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const BlockedStudentSchema = new Schema<IBlockedStudent>(
  {
    rollNumber: { type: String, required: true, unique: true, index: true, uppercase: true, trim: true },
    reason: { type: String, trim: true, maxlength: 200 },
    addedBy: { type: Schema.Types.ObjectId, ref: 'User' }
  },
  { timestamps: true }
);

export const BlockedStudent = model<IBlockedStudent>('BlockedStudent', BlockedStudentSchema);
