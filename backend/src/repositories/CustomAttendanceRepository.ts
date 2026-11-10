import { CustomAttendanceSession, ICustomAttendanceSession } from '../models/CustomAttendanceSession';

export class CustomAttendanceRepository {
  async findById(id: string): Promise<ICustomAttendanceSession | null> {
    return CustomAttendanceSession.findById(id)
      .populate('facultyId', 'employeeId firstName lastName fullName department');
  }

  async findActiveByFaculty(facultyId: string): Promise<ICustomAttendanceSession | null> {
    return CustomAttendanceSession.findOne({
      facultyId,
      sessionStatus: { $in: ['ACTIVE', 'ENDING'] }
    }).populate('facultyId', 'employeeId firstName lastName fullName department');
  }

  async findLatestSessionCode(yearPrefix: string): Promise<string | null> {
    // Look for codes matching CUS-YYYY-******
    const regex = new RegExp(`^CUS-${yearPrefix}-\\d{6}$`);
    const latestSession = await CustomAttendanceSession.findOne({ sessionCode: regex })
      .sort({ sessionCode: -1 })
      .select('sessionCode')
      .lean();
    return latestSession ? latestSession.sessionCode : null;
  }

  async create(sessionData: Partial<ICustomAttendanceSession>): Promise<ICustomAttendanceSession> {
    const session = new CustomAttendanceSession(sessionData);
    return session.save();
  }

  async save(session: ICustomAttendanceSession): Promise<ICustomAttendanceSession> {
    return session.save();
  }

  async findAll(query: any = {}): Promise<ICustomAttendanceSession[]> {
    return CustomAttendanceSession.find(query)
      .populate('facultyId', 'employeeId firstName lastName fullName department')
      .sort({ eventDate: -1 });
  }

  async findSummaryAll(filter: any = {}, queryOptions: any = {}): Promise<any[]> {
    const aggregatePipeline: any[] = [];

    // Push match stage for filter parameters
    aggregatePipeline.push({ $match: filter });

    // Lookup faculty info
    aggregatePipeline.push({
      $lookup: {
        from: 'users',
        localField: 'facultyId',
        foreignField: '_id',
        as: 'facultyInfo'
      }
    });
    aggregatePipeline.push({
      $unwind: { path: '$facultyInfo', preserveNullAndEmptyArrays: true }
    });

    // If search text is provided
    if (queryOptions.search) {
      const q = String(queryOptions.search);
      aggregatePipeline.push({
        $match: {
          $or: [
            { sessionTitle: { $regex: q, $options: 'i' } },
            { sessionCode: { $regex: q, $options: 'i' } },
            { venue: { $regex: q, $options: 'i' } },
            { 'facultyInfo.fullName': { $regex: q, $options: 'i' } }
          ]
        }
      });
    }

    // Project general info, faculty details, and count of PRESENT students
    aggregatePipeline.push({
      $project: {
        sessionCode: 1,
        sessionTitle: 1,
        description: 1,
        venue: 1,
        eventDate: 1,
        totalStudents: 1,
        sessionStatus: 1,
        startTime: 1,
        endTime: 1,
        academicYear: 1,
        year: 1,
        semester: 1,
        section: 1,
        facultyId: {
          _id: '$facultyInfo._id',
          employeeId: '$facultyInfo.employeeId',
          firstName: '$facultyInfo.firstName',
          lastName: '$facultyInfo.lastName',
          fullName: '$facultyInfo.fullName',
          department: '$facultyInfo.department'
        },
        presentCount: {
          $size: {
            $filter: {
              input: { $ifNull: ["$attendance", []] },
              as: "att",
              cond: { $eq: ["$$att.status", "PRESENT"] }
            }
          }
        }
      }
    });

    // Add attendancePercentage virtual field for sorting/returning
    aggregatePipeline.push({
      $addFields: {
        attendancePercentage: {
          $cond: {
            if: { $gt: ["$totalStudents", 0] },
            then: { $multiply: [ { $divide: ["$presentCount", "$totalStudents"] }, 100 ] },
            else: 0
          }
        }
      }
    });

    // Apply sorting
    let sortStage: any = { eventDate: -1, startTime: -1 }; // default newest first
    if (queryOptions.sortBy === 'oldest') {
      sortStage = { eventDate: 1, startTime: 1 };
    } else if (queryOptions.sortBy === 'name') {
      sortStage = { sessionTitle: 1 };
    } else if (queryOptions.sortBy === 'percentage') {
      sortStage = { attendancePercentage: -1 };
    }
    aggregatePipeline.push({ $sort: sortStage });

    return CustomAttendanceSession.aggregate(aggregatePipeline);
  }
}
