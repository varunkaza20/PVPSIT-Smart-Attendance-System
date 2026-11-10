import { Schema, model, Document } from 'mongoose';

export interface ILaboratory extends Document {
  laboratoryCode: string;
  laboratoryName: string;
  building: string;
  floor: string;
  capacity: number;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const LaboratorySchema = new Schema<ILaboratory>(
  {
    laboratoryCode: { type: String, required: true, unique: true, index: true },
    laboratoryName: { type: String, required: true },
    building: { type: String, required: true },
    floor: { type: String, required: true },
    capacity: { type: Number, required: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true }
);

export const Laboratory = model<ILaboratory>('Laboratory', LaboratorySchema);
