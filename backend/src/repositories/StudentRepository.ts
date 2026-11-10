import { Student, IStudent } from '../models/Student';

export class StudentRepository {
  async findById(id: string): Promise<IStudent | null> {
    return Student.findById(id);
  }

  async findByRollNumber(rollNumber: string): Promise<IStudent | null> {
    return Student.findOne({ rollNumber });
  }

  async findActiveByRollNumber(rollNumber: string): Promise<IStudent | null> {
    return Student.findOne({ rollNumber, isActive: true });
  }

  async findBySection(year: number, semester: number, section: string): Promise<IStudent[]> {
    return Student.find({ year, section: section.toUpperCase(), isActive: true });
  }

  async countBySection(year: number, semester: number, section: string): Promise<number> {
    return Student.countDocuments({ year, section: section.toUpperCase(), isActive: true });
  }

  async findAll(query: any = {}): Promise<IStudent[]> {
    return Student.find(query);
  }

  async create(studentData: Partial<IStudent>): Promise<IStudent> {
    const student = new Student(studentData);
    return student.save();
  }

  async update(id: string, studentData: Partial<IStudent>): Promise<IStudent | null> {
    return Student.findByIdAndUpdate(id, studentData, { new: true });
  }

  async softDelete(id: string): Promise<IStudent | null> {
    return Student.findByIdAndUpdate(id, { isActive: false }, { new: true });
  }

  async bulkUpsert(students: Partial<IStudent>[]): Promise<void> {
    const bulkOps = students.map((std) => ({
      updateOne: {
        filter: { rollNumber: std.rollNumber },
        update: { $set: std },
        upsert: true
      }
    }));
    await Student.bulkWrite(bulkOps);
  }
}
