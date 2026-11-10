import { Request, Response, NextFunction } from 'express';

export const validateFields = (fields: string[]) => {
  return (req: Request, res: Response, next: NextFunction) => {
    const missing: string[] = [];
    for (const field of fields) {
      if (
        req.body[field] === undefined ||
        req.body[field] === null ||
        (typeof req.body[field] === 'string' && req.body[field].trim() === '')
      ) {
        missing.push(field);
      }
    }
    if (missing.length > 0) {
      return res.status(400).json({
        success: false,
        message: `Validation failed: missing or empty required field(s): ${missing.join(', ')}`
      });
    }
    next();
  };
};
