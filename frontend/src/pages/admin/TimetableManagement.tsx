import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { 
  Plus, 
  Trash, 
  Clock, 
  Calendar, 
  User, 
  BookOpen
} from 'lucide-react';
import { getCurrentAcademicYear, getAcademicYearOptions } from '../../utils/academicYear';
import { ConfirmModal } from '../../components/ConfirmModal';

interface ITimetable {
  _id: string;
  academicYear: string;
  year: number;
  semester: number;
  section: string;
  facultyId: { _id: string; fullName: string; employeeId: string };
  subjectId: { _id: string; subjectName: string; shortName: string; isLaboratory: boolean };
  laboratoryId?: { _id: string; laboratoryName: string };
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  duration: number;
}

interface IFaculty {
  _id: string;
  fullName: string;
  employeeId: string;
}

interface ISubject {
  _id: string;
  subjectName: string;
  shortName: string;
  isLaboratory: boolean;
}

interface ILaboratory {
  _id: string;
  laboratoryName: string;
}

// Time Slots Definitions
const TIME_SLOTS = [
  { id: 1, label: '09:00 - 10:00', start: '09:00', end: '10:00', value: 60 },
  { id: 2, label: '10:00 - 11:00', start: '10:00', end: '11:00', value: 60 },
  { id: 3, label: '11:00 - 12:00', start: '11:00', end: '12:00', value: 60 },
  { id: 4, label: '13:00 - 14:00', start: '13:00', end: '14:00', value: 60 },
  { id: 5, label: '14:00 - 15:00', start: '14:00', end: '15:00', value: 60 },
  { id: 6, label: '15:00 - 16:00', start: '15:00', end: '16:00', value: 60 },
  { id: 7, label: '16:00 - 17:00', start: '16:00', end: '17:00', value: 60 }
];

const DAYS = [
  { id: 1, name: 'Monday' },
  { id: 2, name: 'Tuesday' },
  { id: 3, name: 'Wednesday' },
  { id: 4, name: 'Thursday' },
  { id: 5, name: 'Friday' },
  { id: 6, name: 'Saturday' }
];

export const TimetableManagement: React.FC = () => {
  const [timetable, setTimetable] = useState<ITimetable[]>([]);
  const [faculties, setFaculties] = useState<IFaculty[]>([]);
  const [subjects, setSubjects] = useState<ISubject[]>([]);
  const [laboratories, setLaboratories] = useState<ILaboratory[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  // In-app delete confirm states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [timetableToDelete, setTimetableToDelete] = useState<string | null>(null);

  // Header Filter States
  const [filters, setFilters] = useState({
    year: 4,
    semester: 1,
    section: 'S1'
  });

  // Modal form states
  const [targetCell, setTargetCell] = useState<{ dayId: number; slotId: number } | null>(null);
  const [formData, setFormData] = useState({
    academicYear: getCurrentAcademicYear(),
    facultyId: '',
    subjectId: '',
    laboratoryId: '',
    startSlotId: 1,
    endSlotId: 1
  });

  const fetchData = async () => {
    setLoading(true);
    try {
      const [tRes, fRes, sRes, lRes] = await Promise.all([
        axios.get('/api/admin/timetable'),
        axios.get('/api/admin/faculty'),
        axios.get('/api/admin/subjects'),
        axios.get('/api/admin/laboratories')
      ]);

      if (tRes.data.success) setTimetable(tRes.data.data);
      if (fRes.data.success) setFaculties(fRes.data.data);
      if (sRes.data.success) setSubjects(sRes.data.data);
      if (lRes.data.success) setLaboratories(lRes.data.data);
    } catch (err) {
      toast.error('Failed to load timetable parameters.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Pre-fill fields when selecting subject in form
  useEffect(() => {
    const selectedSub = subjects.find(s => s._id === formData.subjectId);
    if (selectedSub && !selectedSub.isLaboratory) {
      setFormData(prev => ({ ...prev, laboratoryId: '' }));
    }
  }, [formData.subjectId, subjects]);

  const handleDeleteClick = (id: string, e: React.MouseEvent) => {
    e.stopPropagation(); // prevent opening create modal on grid cell click
    setTimetableToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!timetableToDelete) return;
    try {
      const res = await axios.delete(`/api/admin/timetable/${timetableToDelete}`);
      if (res.data.success) {
        toast.success('Timetable entry deleted.');
        fetchData();
      }
    } catch (err) {
      toast.error('Failed to delete slot.');
    } finally {
      setDeleteModalOpen(false);
      setTimetableToDelete(null);
    }
  };

  const handleOpenCell = (dayId: number, slotId: number) => {
    setTargetCell({ dayId, slotId });
    setFormData({
      academicYear: getCurrentAcademicYear(),
      facultyId: faculties[0]?._id || '',
      subjectId: subjects[0]?._id || '',
      laboratoryId: '',
      startSlotId: slotId,
      endSlotId: slotId
    });
    setShowModal(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetCell) return;

    const startSlot = TIME_SLOTS.find(s => s.id === Number(formData.startSlotId));
    const endSlot = TIME_SLOTS.find(s => s.id === Number(formData.endSlotId));

    if (!startSlot || !endSlot) {
      toast.error('Invalid slot range.');
      return;
    }

    if (startSlot.id > endSlot.id) {
      toast.error('Start slot cannot be after end slot.');
      return;
    }

    // Check if slot range spans across Lunch Break (between Slot 3 [11:00-12:00] and Slot 4 [13:00-14:00])
    if (startSlot.id <= 3 && endSlot.id >= 4) {
      toast.error('Allocations cannot span across the 12:00 - 13:00 Lunch Break. Please split them into separate morning and afternoon entries.');
      return;
    }

    // Helper to calculate total duration in minutes
    // Lunch break is 12:00 - 13:00 (60 mins) which is skipped if slot crosses it
    let totalDuration = 0;
    for (let i = startSlot.id; i <= endSlot.id; i++) {
      const slot = TIME_SLOTS.find(ts => ts.id === i);
      if (slot) totalDuration += slot.value;
    }

    const payload: any = {
      academicYear: formData.academicYear,
      year: filters.year,
      semester: filters.semester,
      section: filters.section,
      facultyId: formData.facultyId,
      subjectId: formData.subjectId,
      dayOfWeek: targetCell.dayId,
      startTime: startSlot.start,
      endTime: endSlot.end,
      duration: totalDuration
    };

    if (formData.laboratoryId) {
      payload.laboratoryId = formData.laboratoryId;
    }

    try {
      const res = await axios.post('/api/admin/timetable', payload);
      if (res.data.success) {
        toast.success('Timetable slot added successfully.');
        setShowModal(false);
        fetchData();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to add timetable slot.');
    }
  };

  // Helper to retrieve matching schedule for a day and standard slot column
  const getSlotAllocation = (dayId: number, slot: typeof TIME_SLOTS[0]) => {
    return timetable.find(entry => {
      if (
        entry.year === filters.year &&
        entry.semester === filters.semester &&
        entry.section === filters.section &&
        entry.dayOfWeek === dayId
      ) {
        // Parse database start/end times and check overlap with column slot
        // Columns: 9-10, 10-11, 11-12, 13-14, 14-15, 15-16, 16-17
        const entStartHour = parseInt(entry.startTime.split(':')[0], 10);
        const entEndHour = parseInt(entry.endTime.split(':')[0], 10);
        const slotStartHour = parseInt(slot.start.split(':')[0], 10);

        return slotStartHour >= entStartHour && slotStartHour < entEndHour;
      }
      return false;
    });
  };

  return (
    <div className="space-y-6">
      
      {/* HEADER SECTION */}
      <div className="flex items-center justify-between border-b border-pvpsit-border pb-4">
        <div>
          <h1 className="text-2xl font-bold text-pvpsit-blue">Timetable Scheduler</h1>
          <p className="text-xs text-slate-500 mt-1">Configure slot allocations and lab sessions.</p>
        </div>
      </div>

      {/* FILTER CONTROLS */}
      <div className="bg-pvpsit-card rounded-xl border border-pvpsit-border p-5">
        <div className="grid grid-cols-3 gap-6">
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Academic Year</label>
            <select
              className="w-full px-3 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none"
              value={filters.year}
              onChange={(e) => setFilters({ ...filters, year: Number(e.target.value) })}
            >
              <option value={2}>II Year (Sophomores)</option>
              <option value={3}>III Year (Juniors)</option>
              <option value={4}>IV Year (Seniors)</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Semester</label>
            <select
              className="w-full px-3 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none"
              value={filters.semester}
              onChange={(e) => setFilters({ ...filters, semester: Number(e.target.value) })}
            >
              <option value={1}>Semester 1</option>
              <option value={2}>Semester 2</option>
            </select>
          </div>
          <div>
            <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Section Group</label>
            <select
              className="w-full px-3 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50"
              value={filters.section}
              onChange={(e) => setFilters({ ...filters, section: e.target.value })}
            >
              <option value="S1">Section 1</option>
              <option value="S2">Section 2</option>
              <option value="S3">Section 3</option>
              <option value="S4">Section 4</option>
            </select>
          </div>
        </div>
      </div>

      {/* WEEKLY GRID LAYOUT */}
      <div className="bg-pvpsit-card rounded-xl border border-pvpsit-border overflow-hidden shadow-sm">
        {loading ? (
          <div className="p-12 flex flex-col items-center">
            <div className="w-10 h-10 border-4 border-pvpsit-blue border-t-transparent rounded-full animate-spin mb-4"></div>
            <p className="text-sm text-slate-500 font-semibold">Generating scheduler grid...</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-center border-collapse border border-slate-200">
              <thead className="bg-slate-50 text-slate-600 font-semibold text-xs">
                <tr className="divide-x divide-slate-200 border-b border-slate-200">
                  <th className="px-3 py-4 w-28 text-left bg-slate-100">Day</th>
                  {TIME_SLOTS.map((ts, idx) => (
                    <React.Fragment key={ts.id}>
                      {idx === 3 && <th className="px-2 py-4 bg-slate-100 w-24">12:00 - 13:00</th>}
                      <th className="px-4 py-4 min-w-[120px]">{ts.label}</th>
                    </React.Fragment>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 text-xs">
                {DAYS.map(day => (
                  <tr key={day.id} className="divide-x divide-slate-200 hover:bg-slate-50/20">
                    {/* Day label */}
                    <td className="px-3 py-6 font-bold text-pvpsit-dark text-left bg-slate-50">{day.name}</td>
                    
                    {/* Time slots mapping */}
                    {TIME_SLOTS.map((ts, idx) => {
                      const entry = getSlotAllocation(day.id, ts);
                      
                      // Check if this slot represents the starting point of an allocation card
                      const isStart = entry && entry.startTime === ts.start;

                      const elements: React.ReactNode[] = [];

                      // Add Lunch Break column
                      if (idx === 3) {
                        elements.push(
                          <td key={`lunch-${day.id}`} className="bg-slate-100/60 font-semibold text-[10px] text-slate-400 select-none cursor-not-allowed">
                            LUNCH BREAK
                          </td>
                        );
                      }

                      if (entry) {
                        if (isStart) {
                          // Compute columns span based on times
                          const startId = TIME_SLOTS.find(t => t.start === entry.startTime)?.id || 1;
                          const endId = TIME_SLOTS.find(t => t.end === entry.endTime)?.id || 1;
                          const colSpan = endId - startId + 1;

                          elements.push(
                            <td
                              key={ts.id}
                              colSpan={colSpan}
                              className="p-1.5"
                            >
                              <div className={`group relative p-2.5 rounded-lg border text-left shadow-sm flex flex-col justify-between h-20 transition-all ${
                                entry.subjectId?.isLaboratory 
                                  ? 'bg-amber-50/80 border-amber-200 text-amber-900' 
                                  : 'bg-blue-50/80 border-blue-200 text-pvpsit-blue'
                              }`}>
                                <div className="space-y-1">
                                  <div className="font-bold flex items-center justify-between">
                                    <span className="truncate flex items-center">
                                      <BookOpen className="w-3.5 h-3.5 mr-1 text-slate-400 shrink-0" />
                                      {entry.subjectId?.shortName || 'Subject'}
                                    </span>
                                    <button
                                      onClick={(e) => handleDeleteClick(entry._id, e)}
                                      className="p-1 text-slate-400 hover:text-pvpsit-danger rounded hover:bg-white/70 opacity-0 group-hover:opacity-100 transition-opacity"
                                      title="Remove allocation"
                                    >
                                      <Trash className="w-3 h-3" />
                                    </button>
                                  </div>
                                  <div className="text-[10px] font-semibold text-slate-600 flex items-center truncate">
                                    <User className="w-3 h-3 mr-1 text-slate-400 shrink-0" />
                                    {entry.facultyId?.fullName}
                                  </div>
                                </div>
                                
                                {entry.laboratoryId && (
                                  <span className="text-[9px] font-bold px-1.5 py-0.5 bg-white border border-amber-200 rounded self-start truncate mt-1">
                                    {entry.laboratoryId.laboratoryName}
                                  </span>
                                )}
                              </div>
                            </td>
                          );
                        }
                        // Overlapping cells of spanned entries are skipped in colSpan rendering
                      } else {
                        // Render empty cell
                        elements.push(
                          <td
                            key={ts.id}
                            onClick={() => handleOpenCell(day.id, ts.id)}
                            className="p-2 cursor-pointer hover:bg-blue-50/40 group transition-all"
                          >
                            <div className="h-16 border border-dashed border-slate-200 rounded-lg flex items-center justify-center opacity-0 group-hover:opacity-100 text-slate-400 font-bold hover:border-pvpsit-blue/50 hover:text-pvpsit-blue">
                              <Plus className="w-4 h-4" />
                            </div>
                          </td>
                        );
                      }

                      return elements;
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* CREATE SLOT ALLOCATION MODAL */}
      {showModal && targetCell && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-lg bg-white rounded-xl border border-pvpsit-border shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-pvpsit-border flex items-center justify-between">
              <h3 className="font-bold text-pvpsit-blue flex items-center text-sm">
                <Calendar className="w-4 h-4 mr-2" />
                Assign Class Allocation Slot
              </h3>
              <button onClick={() => setShowModal(false)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Target Section Group</label>
                  <input
                    type="text"
                    disabled
                    className="w-full px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-slate-100 font-semibold"
                    value={`Year ${filters.year} Sem ${filters.semester} - Section ${filters.section}`}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Academic Year *</label>
                  <select
                    required
                    className="w-full px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-slate-50 font-semibold focus:outline-none"
                    value={formData.academicYear}
                    onChange={(e) => setFormData({ ...formData, academicYear: e.target.value })}
                  >
                    {getAcademicYearOptions().map((ay) => (
                      <option key={ay} value={ay}>{ay}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Select Subject *</label>
                <select
                  required
                  className="w-full px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none"
                  value={formData.subjectId}
                  onChange={(e) => setFormData({ ...formData, subjectId: e.target.value })}
                >
                  {subjects
                    .filter(s => s.isLaboratory || !formData.laboratoryId) // logical safeguards
                    .map(s => (
                      <option key={s._id} value={s._id}>
                        {s.subjectName} ({s.shortName}) {s.isLaboratory ? ' [Laboratory]' : ' [Theory]'}
                      </option>
                    ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Assigned Faculty Member *</label>
                  <select
                    required
                    className="w-full px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none"
                    value={formData.facultyId}
                    onChange={(e) => setFormData({ ...formData, facultyId: e.target.value })}
                  >
                    {faculties.map(f => (
                      <option key={f._id} value={f._id}>
                        {f.fullName} ({f.employeeId})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Laboratory Venue (Optional)</label>
                  <select
                    className="w-full px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none"
                    value={formData.laboratoryId}
                    onChange={(e) => setFormData({ ...formData, laboratoryId: e.target.value })}
                  >
                    <option value="">None (Theory classroom)</option>
                    {laboratories.map(l => (
                      <option key={l._id} value={l._id}>
                        {l.laboratoryName}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* SLOT RANGE SELECTOR FOR LAB COMBINATIONS */}
              <div className="p-4 bg-slate-50 border border-slate-100 rounded-lg space-y-3">
                <div className="font-semibold text-slate-500 text-xs flex items-center">
                  <Clock className="w-4 h-4 mr-1 text-pvpsit-blue" /> Choose Allocation Slot Range
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Start Time Slot</label>
                    <select
                      className="w-full px-3 py-1.5 text-xs border border-pvpsit-border rounded bg-white"
                      value={formData.startSlotId}
                      onChange={(e) => setFormData({ ...formData, startSlotId: Number(e.target.value) })}
                    >
                      {TIME_SLOTS.map(ts => (
                        <option key={ts.id} value={ts.id}>{ts.label}</option>
                      ))}
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">End Time Slot</label>
                    <select
                      className="w-full px-3 py-1.5 text-xs border border-pvpsit-border rounded bg-white"
                      value={formData.endSlotId}
                      onChange={(e) => setFormData({ ...formData, endSlotId: Number(e.target.value) })}
                    >
                      {TIME_SLOTS.filter(ts => ts.id >= formData.startSlotId).map(ts => (
                        <option key={ts.id} value={ts.id}>{ts.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                
                <p className="text-[10px] text-slate-400 font-medium">
                  * Select contiguous slots (e.g. 09:00 - 12:00) to schedule multi-hour laboratory sessions.
                </p>
              </div>

              <div className="px-6 py-4 border-t border-pvpsit-border flex items-center justify-end space-x-3 -mx-6 -mb-6 bg-slate-50 mt-6">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="px-4 py-2 text-xs font-medium border border-slate-200 rounded-lg text-slate-700 bg-white hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-semibold bg-pvpsit-blue hover:bg-blue-700 text-white rounded-lg"
                >
                  Assign to Grid
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* IN-APP CONFIRMATION MODAL */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Confirm Timetable Deletion"
        message="Are you sure you want to remove this timetable slot allocation? Associated faculty classes for this session will be cancelled."
        onConfirm={handleConfirmDelete}
        onCancel={() => { setDeleteModalOpen(false); setTimetableToDelete(null); }}
      />
    </div>
  );
};
