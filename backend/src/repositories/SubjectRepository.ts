import { Subject, ISubject } from '../models/Subject';

export class SubjectRepository {
  async findById(id: string): Promise<ISubject | null> {
    return Subject.findById(id);
  }

  async findByCode(subjectCode: string): Promise<ISubject | null> {
    return Subject.findOne({ subjectCode });
  }

  async findAll(query: any = {}): Promise<ISubject[]> {
    return Subject.find(query);
  }

  async create(subjectData: Partial<ISubject>): Promise<ISubject> {
    const subject = new Subject(subjectData);
    return subject.save();
  }

  async update(id: string, subjectData: Partial<ISubject>): Promise<ISubject | null> {
    return Subject.findByIdAndUpdate(id, subjectData, { new: true });
  }

  async softDelete(id: string): Promise<ISubject | null> {
    return Subject.findByIdAndUpdate(id, { isActive: false }, { new: true });
  }
}
