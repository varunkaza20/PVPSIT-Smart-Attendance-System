import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { UserRepository } from '../repositories/UserRepository';
import { getJwtExpiry, getJwtSecret } from '../config/env';
import { IJwtPayload, UserRole } from '../types';
import { CustomError } from '../middlewares/errorMiddleware';

export class AuthService {
  private userRepo = new UserRepository();

  async login(identifier: string, passwordString: string) {
    let user = await this.userRepo.findByEmployeeId(identifier);
    if (!user) {
      user = await this.userRepo.findByEmail(identifier.toLowerCase());
    }

    if (!user) {
      const err: CustomError = new Error('Invalid Employee ID/Email or Password.');
      err.statusCode = 401;
      throw err;
    }

    const isMatch = await bcrypt.compare(passwordString, user.password || '');
    if (!isMatch) {
      const err: CustomError = new Error('Invalid Employee ID or Password.');
      err.statusCode = 401;
      throw err;
    }

    // Update lastLogin
    user.lastLogin = new Date();
    await user.save();

    const jwtSecret = getJwtSecret();
    const jwtExpiry = getJwtExpiry();

    const payload: IJwtPayload = {
      userId: user._id.toString(),
      employeeId: user.employeeId,
      role: user.role as UserRole,
      fullName: user.fullName
    };

    const token = jwt.sign(payload, jwtSecret, { expiresIn: jwtExpiry } as jwt.SignOptions);

    return {
      token,
      user: {
        id: user._id,
        employeeId: user.employeeId,
        firstName: user.firstName,
        lastName: user.lastName,
        fullName: user.fullName,
        email: user.email,
        role: user.role,
        department: user.department,
        designation: user.designation,
        lastLogin: user.lastLogin
      }
    };
  }

  async getProfile(userId: string) {
    const user = await this.userRepo.findById(userId);
    if (!user) {
      const err: CustomError = new Error('User not found.');
      err.statusCode = 404;
      throw err;
    }

    return {
      id: user._id,
      employeeId: user.employeeId,
      fullName: user.fullName,
      email: user.email,
      role: user.role,
      department: user.department,
      designation: user.designation,
      isActive: user.isActive
    };
  }
}
