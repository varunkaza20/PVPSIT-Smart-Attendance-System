import { Response, NextFunction } from 'express';
import { AuthService } from '../services/AuthService';
import { AuthenticatedRequest } from '../types';

export class AuthController {
  private authService = new AuthService();

  login = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const { employeeId, password } = req.body;
      const result = await this.authService.login(employeeId, password);
      return res.status(200).json({
        success: true,
        message: 'Login successful.',
        ...result
      });
    } catch (error) {
      next(error);
    }
  };

  logout = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      // In JWT authentication, client handles logout by destroying token, but we return success response
      return res.status(200).json({
        success: true,
        message: 'Logout successful.'
      });
    } catch (error) {
      next(error);
    }
  };

  getMe = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
    try {
      const userId = req.user?.userId;
      if (!userId) {
        return res.status(401).json({
          success: false,
          message: 'Unauthorized.'
        });
      }
      const profile = await this.authService.getProfile(userId);
      return res.status(200).json({
        success: true,
        data: profile
      });
    } catch (error) {
      next(error);
    }
  };
}
