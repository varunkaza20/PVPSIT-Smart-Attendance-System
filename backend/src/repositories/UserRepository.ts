import { User, IUser } from '../models/User';

export class UserRepository {
  async findById(id: string): Promise<IUser | null> {
    return User.findById(id);
  }

  async findByEmployeeId(employeeId: string): Promise<IUser | null> {
    return User.findOne({ employeeId, isActive: true });
  }

  async findByEmail(email: string): Promise<IUser | null> {
    return User.findOne({ email, isActive: true });
  }

  async findAll(): Promise<IUser[]> {
    return User.find({}).select('-password');
  }

  async create(userData: Partial<IUser>): Promise<IUser> {
    const user = new User(userData);
    return user.save();
  }

  async update(id: string, userData: Partial<IUser>): Promise<IUser | null> {
    return User.findByIdAndUpdate(id, userData, { new: true }).select('-password');
  }

  async softDelete(id: string): Promise<IUser | null> {
    return User.findByIdAndUpdate(id, { isActive: false }, { new: true });
  }
}
