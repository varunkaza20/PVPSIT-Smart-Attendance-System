import { Schema, model, Document } from 'mongoose';

export interface IUser extends Document {
  employeeId: string;
  firstName: string;
  lastName: string;
  fullName: string;
  email: string;
  phone?: string;
  password?: string;
  role: 'ADMIN' | 'FACULTY';
  department: string;
  designation: string;
  isActive: boolean;
  lastLogin?: Date;
  createdAt: Date;
  updatedAt: Date;
}

const UserSchema = new Schema<IUser>(
  {
    employeeId: { type: String, required: true, unique: true, index: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    fullName: { type: String },
    email: { type: String, required: true, unique: true, index: true },
    phone: { type: String },
    password: { type: String, required: true },
    role: { type: String, enum: ['ADMIN', 'FACULTY'], required: true },
    department: { type: String, required: true },
    designation: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date }
  },
  { timestamps: true }
);

// Auto-derive fullName on save
UserSchema.pre<IUser>('save', function (next) {
  this.fullName = `${this.firstName} ${this.lastName}`.trim();
  next();
});

export const User = model<IUser>('User', UserSchema);
