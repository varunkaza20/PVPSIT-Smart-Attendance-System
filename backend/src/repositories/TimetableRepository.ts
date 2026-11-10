import { Timetable, ITimetable } from '../models/Timetable';

export class TimetableRepository {
  async findById(id: string): Promise<ITimetable | null> {
    return Timetable.findById(id).populate('subjectId').populate('laboratoryId');
  }

  async findByFacultyAndDay(facultyId: string, dayOfWeek: number): Promise<ITimetable[]> {
    return Timetable.find({ facultyId, dayOfWeek, isActive: true })
      .populate('subjectId')
      .populate('laboratoryId');
  }

  async findByDay(dayOfWeek: number): Promise<ITimetable[]> {
    return Timetable.find({ dayOfWeek, isActive: true })
      .populate('facultyId', 'employeeId firstName lastName fullName department')
      .populate('subjectId')
      .populate('laboratoryId');
  }

  async findAll(query: any = {}): Promise<ITimetable[]> {
    return Timetable.find(query)
      .populate('facultyId', 'employeeId firstName lastName fullName department')
      .populate('subjectId')
      .populate('laboratoryId');
  }

  async create(timetableData: Partial<ITimetable>): Promise<ITimetable> {
    const entry = new Timetable(timetableData);
    return entry.save();
  }

  async update(id: string, timetableData: Partial<ITimetable>): Promise<ITimetable | null> {
    return Timetable.findByIdAndUpdate(id, timetableData, { new: true });
  }

  async delete(id: string): Promise<ITimetable | null> {
    return Timetable.findByIdAndDelete(id);
  }
}
