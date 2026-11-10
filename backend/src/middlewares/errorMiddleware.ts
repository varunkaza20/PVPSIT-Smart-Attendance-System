import { Request, Response, NextFunction } from 'express';

export interface CustomError extends Error {
  statusCode?: number;
  code?: number;
  errors?: any[];
  keyValue?: any;
}

export const errorHandler = (
  err: CustomError,
  req: Request,
  res: Response,
  next: NextFunction
) => {
  // Always log error details inside the server console, but do not expose raw error stacks in production responses
  console.error('API Error [', req.method, req.path, ']:', err);

  let statusCode = err.statusCode || 500;
  let message = err.message || 'An unexpected server error occurred.';
  let errors: string[] = [];

  // Mongoose validation error
  if (err.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation Error';
    const validationErrors = (err as any).errors;
    errors = Object.keys(validationErrors).map((key) => validationErrors[key].message);
  }
  // MongoDB duplicate key error
  else if (err.code === 11000 && err.keyValue) {
    statusCode = 409;
    const duplicatedField = Object.keys(err.keyValue)[0];
    message = `Duplicate Key Error: ${duplicatedField} already exists.`;
    errors = [`A record with the ${duplicatedField} '${err.keyValue[duplicatedField]}' already exists.`];
  }
  // JWT verification errors
  else if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid authentication token.';
  } else if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Authentication token has expired.';
  }

  res.status(statusCode).json({
    success: false,
    message,
    errors: errors.length > 0 ? errors : undefined
  });
};

export const notFoundHandler = (req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: `Resource not found: ${req.method} ${req.originalUrl}`
  });
};
