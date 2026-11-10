import { Laboratory, ILaboratory } from '../models/Laboratory';

export class LaboratoryRepository {
  async findById(id: string): Promise<ILaboratory | null> {
    return Laboratory.findById(id);
  }

  async findByCode(laboratoryCode: string): Promise<ILaboratory | null> {
    return Laboratory.findOne({ laboratoryCode });
  }

  async findAll(query: any = {}): Promise<ILaboratory[]> {
    return Laboratory.find(query);
  }

  async create(labData: Partial<ILaboratory>): Promise<ILaboratory> {
    const lab = new Laboratory(labData);
    return lab.save();
  }

  async update(id: string, labData: Partial<ILaboratory>): Promise<ILaboratory | null> {
    return Laboratory.findByIdAndUpdate(id, labData, { new: true });
  }

  async softDelete(id: string): Promise<ILaboratory | null> {
    return Laboratory.findByIdAndUpdate(id, { isActive: false }, { new: true });
  }
}
