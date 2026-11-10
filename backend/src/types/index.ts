export enum UserRole {
  ADMIN = 'ADMIN',
  FACULTY = 'FACULTY'
}

export enum AttendanceStatus {
  PRESENT = 'PRESENT',
  ABSENT = 'ABSENT',
  AWAY = 'AWAY'
}

export enum SessionStatus {
  ACTIVE = 'ACTIVE',
  ENDING = 'ENDING',
  COMPLETED = 'COMPLETED'
}

export interface IJwtPayload {
  userId: string;
  employeeId: string;
  role: UserRole;
  fullName: string;
}

import { Request } from 'express';
export interface AuthenticatedRequest extends Request {
  user?: IJwtPayload;
}

