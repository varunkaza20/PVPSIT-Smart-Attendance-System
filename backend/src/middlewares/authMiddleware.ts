import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { getJwtSecret } from '../config/env';
import { AuthenticatedRequest, IJwtPayload, UserRole } from '../types';

export const authenticateJWT = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({
      success: false,
      message: 'Access Denied. No token provided.'
    });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, getJwtSecret()) as IJwtPayload;
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({
      success: false,
      message: 'Invalid or expired token.'
    });
  }
};

export const authorizeAdmin = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || req.user.role !== UserRole.ADMIN) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden. Access restricted to Administrators only.'
    });
  }
  next();
};

export const authorizeFaculty = (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
  if (!req.user || (req.user.role !== UserRole.FACULTY && req.user.role !== UserRole.ADMIN)) {
    return res.status(403).json({
      success: false,
      message: 'Forbidden. Access restricted to Faculty or Administrators.'
    });
  }
  next();
};
