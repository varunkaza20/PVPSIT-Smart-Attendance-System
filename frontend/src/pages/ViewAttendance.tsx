import React, { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import axios from 'axios';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { useAuth } from '../contexts/AuthContext';
import { ConfirmModal } from '../components/ConfirmModal';
import { 
  Eye, 
  Pencil, 
  Trash2, 
  Search, 
  Download, 
  Clock, 
  Check, 
  X,
  FileSpreadsheet,
  AlertCircle
} from 'lucide-react';
import { getCurrentAcademicYear, getAcademicYearOptions } from '../utils/academicYear';

interface IFaculty {
  _id: string;
  fullName: string;
  employeeId: string;
}

interface ISubject {
  _id: string;
  subjectName: string;
  shortName: string;
}

interface IScan {
  action: 'IN' | 'OUT';
  timestamp: string;
}

interface IAttendanceRecord {
  studentId: string;
  rollNumber: string;
  studentName: string;
  status: 'PRESENT' | 'ABSENT' | 'AWAY';
  scans: IScan[];
  totalAwayMinutes: number;
  section?: string; // dynamically resolved section
}

interface IAttendanceSession {
  _id: string;
  sessionCode: string;
  facultyId: IFaculty;
  subjectId?: ISubject; // optional to accommodate custom sessions
  sessionTitle?: string; // for custom sessions
  description?: string; // for custom sessions
  venue?: string; // for custom sessions
  laboratoryId?: { _id: string; laboratoryName: string };
  academicYear?: string;
  year?: number;
  semester?: number;
  section?: string;
  sessionDate: string;
  startTime: string;
  endTime?: string;
  totalStudents: number;
  sessionStatus: 'ACTIVE' | 'ENDING' | 'COMPLETED';
  attendance: IAttendanceRecord[];
  presentCount?: number; // returned by aggregation summary
  attendancePercentage?: number; // returned by aggregation summary
  eventDate?: string; // for custom sessions
}

export const ViewAttendance: React.FC = () => {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();

  // Navigation tabs: regular vs custom attendance sessions
  const [activeTab, setActiveTab] = useState<'regular' | 'custom'>('regular');

  // Selected Session (for detailed View/Edit panel)
  const [selectedSession, setSelectedSession] = useState<IAttendanceSession | null>(null);
  const [selectedStudentHistory, setSelectedStudentHistory] = useState<IAttendanceRecord | null>(null);
  
  // List of sessions & loading states
  const [sessions, setSessions] = useState<IAttendanceSession[]>([]);
  const [customSessions, setCustomSessions] = useState<IAttendanceSession[]>([]);
  const [faculties, setFaculties] = useState<IFaculty[]>([]);
  const [loading, setLoading] = useState(true);

  // Deletion Modal states
  const [deleteModalOpen, setDeleteModalOpen] = useState(false);
  const [sessionToDelete, setSessionToDelete] = useState<string | null>(null);

  // Edit Mode states
  const [editingRecord, setEditingRecord] = useState<{ studentId: string; currentStatus: string; rollNumber: string; studentName: string } | null>(null);
  const [editStatus, setEditStatus] = useState<'PRESENT' | 'ABSENT'>('PRESENT');
  const [editReason, setEditReason] = useState('');

  // PAGE 1: Filters & Search for Regular
  const [filters, setFilters] = useState({
    academicYear: getCurrentAcademicYear(),
    year: '4',
    semester: '1',
    section: 'S1',
    date: '', // default to empty to allow loading previous sessions
    faculty: '',
    subject: ''
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // PAGE 1: Search & Sorting for Custom (Preserved across drill-downs)
  const [customSearch, setCustomSearch] = useState('');
  const [customSortBy, setCustomSortBy] = useState('newest');
  const [debouncedCustomSearch, setDebouncedCustomSearch] = useState('');

  // PAGE 2: Filters row inside selected custom session details
  const [customSectionFilter, setCustomSectionFilter] = useState('');
  const [customStudentSearch, setCustomStudentSearch] = useState('');
  const [debouncedCustomStudentSearch, setDebouncedCustomStudentSearch] = useState('');

  // 1. Debounce searches
  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQuery(searchQuery);
    }, 300);
    return () => clearTimeout(handler);
  }, [searchQuery]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedCustomSearch(customSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [customSearch]);

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedCustomStudentSearch(customStudentSearch);
    }, 300);
    return () => clearTimeout(handler);
  }, [customStudentSearch]);

  // 2. Fetch admins/faculty list if ADMIN logged in
  useEffect(() => {
    if (user?.role === 'ADMIN') {
      axios.get('/api/admin/faculty')
        .then(res => {
          if (res.data.success) {
            setFaculties(res.data.data);
          }
        })
        .catch(() => toast.error('Failed to load faculty listings.'));
    }
  }, [user]);

  // 3. Retrieve sessions list matching filters
  const fetchSessions = async () => {
    setLoading(true);
    try {
      const res = await axios.get('/api/attendance/sessions', { params: filters });
      if (res.data.success) {
        setSessions(res.data.data);
      }
    } catch (err) {
      toast.error('Failed to retrieve attendance sessions.');
    } finally {
      setLoading(false);
    }
  };

  const fetchCustomSessions = async () => {
    setLoading(true);
    try {
      const queryParams: any = {
        search: debouncedCustomSearch,
        sortBy: customSortBy
      };
      if (user?.role === 'ADMIN' && filters.faculty) {
        queryParams.faculty = filters.faculty;
      }
      const res = await axios.get('/api/custom-attendance/sessions', { params: queryParams });
      if (res.data.success) {
        setCustomSessions(res.data.data);
      }
    } catch (err) {
      toast.error('Failed to retrieve custom sessions.');
    } finally {
      setLoading(false);
    }
  };

  // Trigger fetches
  useEffect(() => {
    if (activeTab === 'regular') {
      fetchSessions();
    }
  }, [filters, activeTab]);

  useEffect(() => {
    if (activeTab === 'custom') {
      fetchCustomSessions();
    }
  }, [debouncedCustomSearch, customSortBy, activeTab, filters.faculty]);

  // 4. Retrieve single session details if param has sessionId
  const fetchSessionDetails = async (id: string, typeParam?: string) => {
    try {
      const currentType = typeParam || activeTab;
      const endpoint = currentType === 'custom'
        ? `/api/custom-attendance/sessions/${id}`
        : `/api/attendance/sessions/${id}`;
      const res = await axios.get(endpoint);
      if (res.data.success) {
        setSelectedSession(res.data.data);
        // Reset Page 2 local filters
        setCustomSectionFilter('');
        setCustomStudentSearch('');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to load details.');
    }
  };

  useEffect(() => {
    const sId = searchParams.get('sessionId');
    const type = searchParams.get('type');
    if (sId) {
      const resolvedType = type === 'custom' ? 'custom' : 'regular';
      setActiveTab(resolvedType);
      fetchSessionDetails(sId, resolvedType);
      // Clean query param
      setSearchParams({});
    }
  }, [searchParams]);

  const handleEditClick = (record: IAttendanceRecord) => {
    setEditingRecord({
      studentId: record.studentId || '',
      currentStatus: record.status,
      rollNumber: record.rollNumber,
      studentName: record.studentName
    });
    setEditStatus(record.status === 'AWAY' ? 'PRESENT' : record.status as 'PRESENT' | 'ABSENT');
    setEditReason('');
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSession || !editingRecord) return;
    if (!editReason.trim()) {
      toast.error('Please enter a reason for the adjustment.');
      return;
    }

    try {
      const endpoint = activeTab === 'custom' 
        ? `/api/custom-attendance/sessions/${selectedSession._id}/student/${editingRecord.rollNumber}`
        : `/api/attendance/sessions/${selectedSession._id}/student/${editingRecord.studentId}`;

      const res = await axios.patch(endpoint, {
        newStatus: editStatus,
        reason: editReason
      });

      if (res.data.success) {
        toast.success('Roster attendance record updated.');
        setEditingRecord(null);
        fetchSessionDetails(selectedSession._id);
        if (activeTab === 'regular') fetchSessions();
        else fetchCustomSessions();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to update record.');
    }
  };

  const handleDeleteRequest = (id: string) => {
    setSessionToDelete(id);
    setDeleteModalOpen(true);
  };

  const handleConfirmDelete = async () => {
    if (!sessionToDelete) return;
    try {
      const endpoint = activeTab === 'custom'
        ? `/api/custom-attendance/sessions/${sessionToDelete}`
        : `/api/attendance/sessions/${sessionToDelete}`;
      const res = await axios.delete(endpoint);
      if (res.data.success) {
        toast.success('Attendance session permanently deleted.');
        if (selectedSession?._id === sessionToDelete) {
          setSelectedSession(null);
          setSelectedStudentHistory(null);
        }
        if (activeTab === 'regular') fetchSessions();
        else fetchCustomSessions();
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to delete session.');
    } finally {
      setDeleteModalOpen(false);
      setSessionToDelete(null);
    }
  };

  // Filter list locally for regular sessions based on search bar
  const getFilteredRegularSessions = () => {
    if (!debouncedQuery.trim()) return sessions;
    const q = debouncedQuery.toUpperCase();

    return sessions.filter((s) => {
      const matchSubject = (s.subjectId?.subjectName || '').toUpperCase().includes(q) || (s.subjectId?.shortName || '').toUpperCase().includes(q);
      const matchFaculty = s.facultyId.fullName.toUpperCase().includes(q);
      const matchRoster = s.attendance ? s.attendance.some(record => record.rollNumber.toUpperCase().includes(q)) : false;
      return matchSubject || matchFaculty || matchRoster;
    });
  };

  // Filter student checklist locally for Page 2 Drill-down Details
  const getFilteredRosterList = () => {
    if (!selectedSession) return [];
    let list = selectedSession.attendance;

    // Apply Section filter if selected
    if (customSectionFilter) {
      list = list.filter(record => record.section === customSectionFilter);
    }

    // Apply student search (Roll Number or Name)
    if (debouncedCustomStudentSearch.trim()) {
      const q = debouncedCustomStudentSearch.toUpperCase();
      list = list.filter(record => 
        record.rollNumber.toUpperCase().includes(q) || 
        record.studentName.toUpperCase().includes(q)
      );
    }

    return list;
  };

  // Helper to extract unique sections for dropdown (Only if multiple sections exist)
  const getRosterSections = () => {
    if (!selectedSession) return [];
    const sections = selectedSession.attendance.map(r => r.section).filter(Boolean);
    return Array.from(new Set(sections)) as string[];
  };

  // Helper to get last scan time text
  const getLastScanTimeStr = (record: IAttendanceRecord) => {
    if (!record.scans || record.scans.length === 0) return 'N/A';
    const lastScan = record.scans[record.scans.length - 1];
    return new Date(lastScan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
  };

  // Export to Excel sheet
  const exportToExcel = (session: IAttendanceSession) => {
    const presentCount = session.attendance.filter(r => r.status === 'PRESENT').length;
    const absentCount = session.attendance.filter(r => r.status === 'ABSENT').length;
    const pct = session.totalStudents > 0 ? Math.round((presentCount / session.totalStudents) * 100) : 0;

    // Build worksheet metadata
    const metadata = activeTab === 'custom'
      ? [
          ['PVPSIT Smart Attendance Custom Session Report'],
          ['Session Code', session.sessionCode],
          ['Title', session.sessionTitle || 'N/A'],
          ['Description', session.description || 'N/A'],
          ['Faculty', session.facultyId.fullName],
          ['Venue', session.venue || 'N/A'],
          ['Session Date', new Date(session.startTime).toDateString()],
          ['Start Time', new Date(session.startTime).toLocaleTimeString()],
          ['Total Students', session.totalStudents],
          ['Present count', presentCount],
          ['Absent count', absentCount],
          ['Attendance Rate', `${pct}%`],
          ['Generated On', new Date().toLocaleString()],
          []
        ]
      : [
          ['PVPSIT Smart Attendance Session Report'],
          ['Session Code', session.sessionCode],
          ['Subject', `${session.subjectId?.shortName || 'N/A'} - ${session.subjectId?.subjectName || 'No Subject'}`],
          ['Faculty', session.facultyId.fullName],
          ['Section', `Section ${session.section}`],
          ['Laboratory', session.laboratoryId?.laboratoryName || 'Theory Lecture Room'],
          ['Session Date', new Date(session.startTime).toDateString()],
          ['Start Time', new Date(session.startTime).toLocaleTimeString()],
          ['Total Students', session.totalStudents],
          ['Present count', presentCount],
          ['Absent count', absentCount],
          ['Attendance Rate', `${pct}%`],
          ['Generated On', new Date().toLocaleString()],
          []
        ];

    // Build students roster list
    const headers = [['Roll Number', 'Student Name', 'Section', 'Status', 'Away Duration (mins)', 'Scans Count']];
    const rows = session.attendance.map(r => [
      r.rollNumber,
      r.studentName,
      r.section || 'N/A',
      r.status,
      r.totalAwayMinutes,
      r.scans.length
    ]);

    const worksheet = XLSX.utils.aoa_to_sheet([...metadata, ...headers, ...rows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'Attendance Session');

    XLSX.writeFile(workbook, `PVPSIT_Session_${session.sessionCode}.xlsx`);
    toast.success('Spreadsheet generated and downloaded!');
  };

  // Export to PDF
  const exportToPDF = (session: IAttendanceSession) => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      toast.error('Popup blocked. Enable popups to download PDF.');
      return;
    }

    const presentCount = session.attendance.filter(r => r.status === 'PRESENT').length;
    const pct = session.totalStudents > 0 ? Math.round((presentCount / session.totalStudents) * 100) : 0;

    const detailsHTML = activeTab === 'custom'
      ? `
        <div>
          <p><strong>Title:</strong> ${session.sessionTitle || 'N/A'}</p>
          <p><strong>Description:</strong> ${session.description || 'N/A'}</p>
          <p><strong>Faculty:</strong> ${session.facultyId.fullName}</p>
          <p><strong>Venue:</strong> ${session.venue || 'N/A'}</p>
        </div>
        <div>
          <p><strong>Date:</strong> ${new Date(session.startTime).toDateString()}</p>
          <p><strong>Time:</strong> ${new Date(session.startTime).toLocaleTimeString()} - ${session.endTime ? new Date(session.endTime).toLocaleTimeString() : 'N/A'}</p>
          <p><strong>Total Students:</strong> ${session.totalStudents}</p>
          <p><strong>Attendance Percentage:</strong> ${pct}%</p>
        </div>
      `
      : `
        <div>
          <p><strong>Subject:</strong> ${session.subjectId?.shortName || 'N/A'} - ${session.subjectId?.subjectName || 'No Subject'}</p>
          <p><strong>Faculty:</strong> ${session.facultyId.fullName}</p>
          <p><strong>Class Section:</strong> Section ${session.section}</p>
          <p><strong>Venue:</strong> ${session.laboratoryId?.laboratoryName || 'Theory Room'}</p>
        </div>
        <div>
          <p><strong>Date:</strong> ${new Date(session.startTime).toDateString()}</p>
          <p><strong>Time:</strong> ${new Date(session.startTime).toLocaleTimeString()} - ${session.endTime ? new Date(session.endTime).toLocaleTimeString() : 'N/A'}</p>
          <p><strong>Total Students:</strong> ${session.totalStudents}</p>
          <p><strong>Attendance Percentage:</strong> ${pct}%</p>
        </div>
      `;

    printWindow.document.write(`
      <html>
        <head>
          <title>Session Report - ${session.sessionCode}</title>
          <style>
            body { font-family: sans-serif; padding: 30px; color: #333; }
            h1 { color: #1e3a8a; margin-bottom: 5px; }
            table { width: 100%; border-collapse: collapse; margin-top: 20px; font-size: 12px; }
            th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
            th { background-color: #f3f4f6; }
            .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 20px; margin-top: 15px; font-size: 13px; }
            .status-badge { font-weight: bold; }
          </style>
        </head>
        <body>
          <h1>PVPSIT Smart Attendance System</h1>
          <h3>Session Code: ${session.sessionCode}</h3>
          <hr />
          <div class="grid">
            ${detailsHTML}
          </div>
          <table>
            <thead>
              <tr>
                <th>Roll Number</th>
                <th>Student Name</th>
                <th>Section</th>
                <th>Status</th>
                <th>Away Minutes</th>
                <th>Total Scans</th>
              </tr>
            </thead>
            <tbody>
              ${session.attendance.map(r => `
                <tr>
                  <td><strong>${r.rollNumber}</strong></td>
                  <td>${r.studentName}</td>
                  <td>${r.section || 'N/A'}</td>
                  <td class="status-badge">${r.status}</td>
                  <td>${r.totalAwayMinutes} mins</td>
                  <td>${r.scans.length} scans</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <p style="margin-top:40px; font-size:10px; color:#888;">Generated automatically on ${new Date().toLocaleString()}</p>
          <script>
            window.onload = function() { window.print(); window.close(); }
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  const handleFilterUpdate = (updater: (prev: any) => any) => {
    setSelectedSession(null);
    setSelectedStudentHistory(null);
    setFilters(updater);
  };

  const filteredRegularSessions = getFilteredRegularSessions();
  const rosterList = getFilteredRosterList();
  const uniqueRosterSections = getRosterSections();

  return (
    <div className="space-y-6 pb-12">
      
      {/* 1. BREADCRUMBS & HEADER */}
      <div className="border-b border-pvpsit-border pb-4">
        {selectedSession && activeTab === 'custom' ? (
          <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            <span>View Attendance</span>
            <span>&gt;</span>
            <span>Custom Attendance</span>
            <span>&gt;</span>
            <span className="text-pvpsit-blue">{selectedSession.sessionTitle}</span>
          </div>
        ) : (
          <div className="flex items-center space-x-2 text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">
            <span>View Attendance</span>
            <span>&gt;</span>
            <span className="text-pvpsit-blue">{activeTab === 'regular' ? 'Regular Attendance' : 'Custom Attendance'}</span>
          </div>
        )}
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-pvpsit-blue">View Attendance</h1>
            <p className="text-xs text-slate-500 mt-1">Review, manage, edit, and delete completed attendance sessions.</p>
          </div>
        </div>
      </div>

      {/* 2. TAB SELECTION */}
      <div className="flex border-b border-pvpsit-border bg-white rounded-xl overflow-hidden p-1.5 space-x-1 shadow-sm">
        <button
          onClick={() => {
            setActiveTab('regular');
            setSelectedSession(null);
            setSelectedStudentHistory(null);
          }}
          className={`flex items-center px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'regular' ? 'bg-pvpsit-blue text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          Regular Attendance
        </button>
        <button
          onClick={() => {
            setActiveTab('custom');
            setSelectedSession(null);
            setSelectedStudentHistory(null);
          }}
          className={`flex items-center px-4 py-2.5 text-xs font-bold rounded-lg transition-all ${
            activeTab === 'custom' ? 'bg-pvpsit-blue text-white shadow-sm' : 'text-slate-600 hover:bg-slate-50'
          }`}
        >
          Custom Attendance
        </button>
      </div>

      {/* =========================================================================== */}
      {/* ======================= REGULAR ATTENDANCE TAB ========================== */}
      {/* =========================================================================== */}
      {activeTab === 'regular' && (
        <>
          {/* SEARCH & FILTERS BOX (ALWAYS VISIBLE FOR REGULAR) */}
          <div className="bg-white rounded-xl border border-pvpsit-border p-5 shadow-sm space-y-4">
            
            <div className="grid grid-cols-4 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Academic Year</label>
                <select
                  className="w-full px-2.5 py-1.5 text-xs border border-pvpsit-border rounded-lg bg-slate-50 font-semibold focus:outline-none"
                  value={filters.academicYear}
                  onChange={(e) => handleFilterUpdate((prev) => ({ ...prev, academicYear: e.target.value }))}
                >
                  {getAcademicYearOptions().map((ay) => (
                    <option key={ay} value={ay}>{ay}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Year</label>
                <select
                  className="w-full px-2.5 py-1.5 text-xs border border-pvpsit-border rounded-lg bg-slate-50 font-semibold focus:outline-none"
                  value={filters.year}
                  onChange={(e) => handleFilterUpdate((prev) => ({ ...prev, year: e.target.value }))}
                >
                  <option value="2">2nd Year</option>
                  <option value="3">3rd Year</option>
                  <option value="4">4th Year</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Semester</label>
                <select
                  className="w-full px-2.5 py-1.5 text-xs border border-pvpsit-border rounded-lg bg-slate-50 font-semibold focus:outline-none"
                  value={filters.semester}
                  onChange={(e) => handleFilterUpdate((prev) => ({ ...prev, semester: e.target.value }))}
                >
                  <option value="1">1st Sem</option>
                  <option value="2">2nd Sem</option>
                </select>
              </div>

              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Section</label>
                <select
                  className="w-full px-2.5 py-1.5 text-xs border border-pvpsit-border rounded-lg bg-slate-50 font-semibold focus:outline-none"
                  value={filters.section}
                  onChange={(e) => handleFilterUpdate((prev) => ({ ...prev, section: e.target.value }))}
                >
                  <option value="S1">S1</option>
                  <option value="S2">S2</option>
                  <option value="S3">S3</option>
                  <option value="S4">S4</option>
                </select>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Date</label>
                <input
                  type="date"
                  className="w-full px-2.5 py-1.5 text-xs border border-pvpsit-border rounded-lg bg-slate-50 font-semibold focus:outline-none"
                  value={filters.date}
                  onChange={(e) => handleFilterUpdate((prev) => ({ ...prev, date: e.target.value }))}
                />
              </div>

              {user?.role === 'ADMIN' && (
                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Faculty Filter</label>
                  <select
                    className="w-full px-2.5 py-1.5 text-xs border border-pvpsit-border rounded-lg bg-slate-50 font-semibold focus:outline-none"
                    value={filters.faculty}
                    onChange={(e) => handleFilterUpdate((prev) => ({ ...prev, faculty: e.target.value }))}
                  >
                    <option value="">All Faculty Members</option>
                    {faculties.map((f) => (
                      <option key={f._id} value={f._id}>{f.fullName}</option>
                    ))}
                  </select>
                </div>
              )}

              <div className={user?.role === 'ADMIN' ? 'col-span-1' : 'col-span-2'}>
                <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Search Keywords</label>
                <div className="relative">
                  <input
                    type="text"
                    placeholder="Search by Subject, Faculty, or Roll..."
                    value={searchQuery}
                    onChange={(e) => {
                      setSelectedSession(null);
                      setSelectedStudentHistory(null);
                      setSearchQuery(e.target.value);
                    }}
                    className="w-full pl-8 pr-3 py-1.5 text-xs border border-pvpsit-border rounded-lg focus:outline-none focus:border-pvpsit-blue"
                  />
                  <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>
            </div>

          </div>

          {!selectedSession ? (
            /* REGULAR LIST VIEW */
            <div className="space-y-4 animate-fade-in">
              <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                Timetable Sessions List ({filteredRegularSessions.length})
              </h3>

              {loading ? (
                <div className="bg-white rounded-xl border border-pvpsit-border p-12 text-center text-slate-500">
                  <div className="w-8 h-8 border-4 border-pvpsit-blue border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                  <span className="text-xs font-semibold">Retrieving matching sessions...</span>
                </div>
              ) : filteredRegularSessions.length === 0 ? (
                <div className="bg-white rounded-xl border border-pvpsit-border p-12 text-center text-slate-400">
                  <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
                  <p className="text-xs font-semibold">No regular attendance sessions match these parameters.</p>
                </div>
              ) : (
                <div className="grid grid-cols-1 gap-4">
                  {filteredRegularSessions.map((session) => {
                    const present = session.presentCount !== undefined 
                      ? session.presentCount 
                      : (session.attendance ? session.attendance.filter(r => r.status === 'PRESENT').length : 0);
                    const pct = session.attendancePercentage !== undefined 
                      ? Math.round(session.attendancePercentage) 
                      : (session.totalStudents > 0 ? Math.round((present / session.totalStudents) * 100) : 0);
                    const absent = session.totalStudents - present;
                    
                    const isOwner = session.facultyId._id === user?.id;
                    const canModify = user?.role === 'ADMIN' || isOwner;

                    return (
                      <div 
                        key={session._id} 
                        className="bg-white rounded-xl border-2 border-pvpsit-border hover:border-slate-300 p-5 shadow-sm flex items-center justify-between transition-all"
                      >
                        <div className="space-y-2">
                          <div className="flex items-center space-x-2">
                            <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase">
                              REGULAR
                            </span>
                            <span className="text-[9px] font-bold bg-blue-50 text-pvpsit-blue px-2 py-0.5 rounded">
                              {session.sessionCode}
                            </span>
                          </div>

                          <h4 className="text-base font-bold text-pvpsit-dark">
                            {session.subjectId?.shortName || 'N/A'} - {session.subjectId?.subjectName || 'No Subject'}
                          </h4>
                          
                          <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500 font-semibold">
                            <span className="flex items-center">
                              <Clock className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                              {new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                              {session.endTime && ` - ${new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`}
                            </span>
                            <span>Section: S{session.section}</span>
                            <span>Faculty: {session.facultyId.fullName}</span>
                            <span>Venue: {session.laboratoryId?.laboratoryName || 'Theory Room'}</span>
                          </div>
                        </div>

                        <div className="flex items-center space-x-6">
                          <div className="text-right space-y-1">
                            <div className="text-[10px] font-bold text-slate-400 uppercase">Attendance Rate</div>
                            <span className={`text-lg font-black ${
                              pct >= 75 ? 'text-pvpsit-success' : pct >= 50 ? 'text-pvpsit-warning' : 'text-pvpsit-danger'
                            }`}>{pct}%</span>
                            <div className="text-[10px] text-slate-500 font-semibold">
                              {present} Present / {absent} Absent
                            </div>
                          </div>

                          <div className="flex flex-col space-y-1.5 border-l border-slate-100 pl-4">
                            <button
                              onClick={() => fetchSessionDetails(session._id)}
                              className="flex items-center justify-center px-4 py-2 text-xs font-bold text-pvpsit-blue bg-blue-50 hover:bg-pvpsit-blue hover:text-white transition-all rounded-lg"
                            >
                              <Eye className="w-3.5 h-3.5 mr-1" />
                              View
                            </button>
                            
                            {canModify && (
                              <>
                                <button
                                  onClick={() => {
                                    setSelectedSession(session);
                                    toast.success(`Edit mode active for ${session.sessionCode}.`);
                                  }}
                                  className="flex items-center justify-center px-4 py-2 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 transition-all rounded-lg"
                                >
                                  <Pencil className="w-3.5 h-3.5 mr-1" />
                                  Edit
                                </button>
                                
                                <button
                                  onClick={() => handleDeleteRequest(session._id)}
                                  className="flex items-center justify-center px-4 py-2 text-xs font-bold text-pvpsit-danger bg-red-50 hover:bg-pvpsit-danger hover:text-white transition-all rounded-lg"
                                >
                                  <Trash2 className="w-3.5 h-3.5 mr-1" />
                                  Delete
                                </button>
                              </>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* REGULAR DETAILED VIEW */
            <div className="bg-white rounded-xl border border-pvpsit-border p-6 shadow-md space-y-6 animate-fade-in">
              
              <div className="flex items-center justify-between border-b border-pvpsit-border pb-4">
                <div className="flex items-center space-x-4">
                  <button 
                    onClick={() => { setSelectedSession(null); setSelectedStudentHistory(null); }}
                    className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all rounded-lg"
                  >
                    ← Back to Sessions List
                  </button>
                  <div>
                    <span className="text-[9px] font-bold text-pvpsit-blue bg-blue-50 px-2 py-0.5 rounded uppercase">
                      Roster Details
                    </span>
                    <h3 className="font-extrabold text-pvpsit-dark mt-1 text-base">{selectedSession.sessionCode}</h3>
                  </div>
                </div>
              </div>

              {/* Stats Overview */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg border border-pvpsit-border text-center">
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Roster Count</div>
                  <div className="text-xl font-black text-pvpsit-dark mt-1">{selectedSession.totalStudents}</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-pvpsit-border text-center">
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Present Rate</div>
                  <div className="text-xl font-black text-pvpsit-success mt-1">
                    {selectedSession.totalStudents > 0 
                      ? Math.round((selectedSession.attendance.filter(r => r.status === 'PRESENT').length / selectedSession.totalStudents) * 100) 
                      : 0}%
                  </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-pvpsit-border text-center">
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Subject</div>
                  <div className="text-xs font-black text-pvpsit-blue mt-2 truncate">
                    {selectedSession.subjectId?.shortName || 'N/A'} - {selectedSession.subjectId?.subjectName || 'No Subject'}
                  </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-pvpsit-border text-center">
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Faculty</div>
                  <div className="text-xs font-black text-slate-600 mt-2 truncate">{selectedSession.facultyId.fullName}</div>
                </div>
              </div>

              {/* Action buttons */}
              <div className="p-4 bg-slate-50 rounded-lg border border-pvpsit-border flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Download Reports:</span>
                <div className="flex space-x-3">
                  <button
                    onClick={() => exportToExcel(selectedSession)}
                    className="flex items-center px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-650 border border-emerald-250 text-xs font-bold rounded-lg transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Excel spreadsheet
                  </button>
                  <button
                    onClick={() => exportToPDF(selectedSession)}
                    className="flex items-center px-4 py-2 bg-red-50 text-pvpsit-danger hover:bg-pvpsit-danger hover:text-white border border-red-200 text-xs font-bold rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    PDF Document
                  </button>
                </div>
              </div>

              {/* Students Checklist Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase">Roster Attendance Checklist</span>
                  <span className="text-[10px] font-semibold text-pvpsit-blue bg-blue-50 px-2.5 py-1 rounded">
                    ℹ️ Click any row to view raw logs in popup
                  </span>
                </div>

                <div className="border border-pvpsit-border rounded-xl overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-500 border-b border-pvpsit-border font-semibold">
                      <tr>
                        <th className="py-3 px-4">Roll Number</th>
                        <th className="py-3 px-4">Student Name</th>
                        <th className="py-3 px-4">Status</th>
                        <th className="py-3 px-4">Away Duration</th>
                        <th className="py-3 px-4">Scan count</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {selectedSession.attendance.map((record) => (
                        <tr 
                          key={record.rollNumber}
                          onClick={() => setSelectedStudentHistory(record)}
                          className="hover:bg-slate-50/60 cursor-pointer transition-colors"
                        >
                          <td className="py-3.5 px-4 font-bold text-slate-700 font-mono">{record.rollNumber}</td>
                          <td className="py-3.5 px-4 font-semibold text-pvpsit-dark">{record.studentName}</td>
                          <td className="py-3.5 px-4">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                              record.status === 'PRESENT' ? 'bg-green-100 text-green-700' :
                              record.status === 'AWAY' ? 'bg-orange-100 text-orange-700' :
                              'bg-red-100 text-red-700'
                            }`}>
                              {record.status}
                            </span>
                          </td>
                          <td className="py-3.5 px-4 text-slate-500 font-semibold">{record.totalAwayMinutes} mins</td>
                          <td className="py-3.5 px-4 text-slate-400 font-bold">{record.scans.length} scans</td>
                          <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                            <button
                              onClick={() => handleEditClick(record)}
                              className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-pvpsit-blue rounded-lg transition-colors"
                            >
                              <Pencil className="w-3.5 h-3.5" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
        </>
      )}

      {/* =========================================================================== */}
      {/* ======================== CUSTOM ATTENDANCE TAB ========================== */}
      {/* =========================================================================== */}
      {activeTab === 'custom' && (
        <>
          {!selectedSession ? (
            /* PAGE 1: CUSTOM SESSIONS LIST VIEW */
            <div className="space-y-6 animate-fade-in">
              
              {/* SEARCH & SORT PANEL (NO METADATA FILTERS ROW AT ALL) */}
              <div className="bg-white rounded-xl border border-pvpsit-border p-5 shadow-sm grid grid-cols-3 gap-4 items-end">
                <div className="col-span-2">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Search Sessions</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search by Title, Training Code, Faculty, or Venue..."
                      value={customSearch}
                      onChange={(e) => setCustomSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-2 text-xs border border-pvpsit-border rounded-lg focus:outline-none focus:border-pvpsit-blue"
                    />
                    <Search className="absolute left-2.5 top-2.5 w-4 h-4 text-slate-400" />
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Sort By</label>
                  <select
                    value={customSortBy}
                    onChange={(e) => setCustomSortBy(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-slate-50 font-semibold focus:outline-none"
                  >
                    <option value="newest">Newest First</option>
                    <option value="oldest">Oldest First</option>
                    <option value="name">Session Name</option>
                    <option value="percentage">Attendance Percentage</option>
                  </select>
                </div>
              </div>

              {/* LIST CONTAINER */}
              <div className="space-y-4">
                <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider">
                  Custom SDP / Training Sessions ({customSessions.length})
                </h3>

                {loading ? (
                  <div className="bg-white rounded-xl border border-pvpsit-border p-12 text-center text-slate-500">
                    <div className="w-8 h-8 border-4 border-pvpsit-blue border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
                    <span className="text-xs font-semibold">Retrieving matching sessions...</span>
                  </div>
                ) : customSessions.length === 0 ? (
                  <div className="bg-white rounded-xl border border-pvpsit-border p-12 text-center text-slate-400 space-y-3">
                    <AlertCircle className="w-10 h-10 text-slate-350 mx-auto" />
                    <p className="text-sm font-bold text-slate-700">No Custom Attendance Sessions Found</p>
                    <p className="text-xs text-slate-400 font-semibold max-w-sm mx-auto">Create a new Custom Attendance Session to start recording attendance.</p>
                  </div>
                ) : (
                  <div className="grid grid-cols-1 gap-4">
                    {customSessions.map((session) => {
                      const present = session.presentCount || 0;
                      const total = session.totalStudents || 0;
                      const pct = session.attendancePercentage !== undefined 
                        ? Math.round(session.attendancePercentage) 
                        : (total > 0 ? Math.round((present / total) * 100) : 0);

                      const dateStr = new Date(session.eventDate || session.startTime).toLocaleDateString([], {
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric'
                      });

                      const timeStr = new Date(session.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) + 
                        (session.endTime ? ` - ${new Date(session.endTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}` : '');

                      const isOwner = session.facultyId?._id === user?.id;
                      const canModify = user?.role === 'ADMIN' || isOwner;

                      return (
                        <div 
                          key={session._id} 
                          className="bg-white rounded-xl border-2 border-pvpsit-border hover:border-slate-300 p-5 shadow-sm flex items-center justify-between transition-all"
                        >
                          <div className="space-y-2">
                            <div className="flex items-center space-x-2">
                              <span className="text-[9px] font-bold bg-orange-50 text-orange-600 px-2 py-0.5 rounded uppercase border border-orange-100">
                                CUSTOM SDP
                              </span>
                              <span className="text-[9px] font-bold bg-blue-50 text-pvpsit-blue px-2 py-0.5 rounded font-mono">
                                Code: {session.sessionCode}
                              </span>
                              <span className={`text-[9px] font-bold px-2 py-0.5 rounded uppercase ${
                                session.sessionStatus === 'COMPLETED' ? 'bg-green-100 text-green-700' : 'bg-blue-100 text-blue-700'
                              }`}>
                                {session.sessionStatus}
                              </span>
                            </div>

                            <h4 className="text-base font-extrabold text-pvpsit-dark">
                              {session.sessionTitle}
                            </h4>
                            
                            {session.description && (
                              <p className="text-[11px] text-slate-450 font-semibold line-clamp-1 max-w-xl">
                                {session.description}
                              </p>
                            )}

                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-slate-500 font-semibold">
                              <span>Venue: {session.venue}</span>
                              <span>Date: {dateStr}</span>
                              <span>Time: {timeStr}</span>
                              <span>Faculty: {session.facultyId?.fullName || 'N/A'}</span>
                            </div>
                          </div>

                          <div className="flex items-center space-x-6">
                            
                            {/* Attendance statistics brief */}
                            <div className="text-right space-y-1">
                              <div className="text-[10px] font-bold text-slate-400 uppercase">Attendance Rate</div>
                              <span className={`text-lg font-black ${
                                pct >= 75 ? 'text-pvpsit-success' : pct >= 50 ? 'text-pvpsit-warning' : 'text-pvpsit-danger'
                              }`}>{pct}%</span>
                              <div className="text-[10px] text-slate-500 font-semibold">
                                {total} Participants
                              </div>
                            </div>

                            {/* Action buttons */}
                            <div className="flex flex-col space-y-1.5 border-l border-slate-100 pl-4">
                              <button
                                onClick={() => fetchSessionDetails(session._id)}
                                className="flex items-center justify-center px-4 py-2 text-xs font-bold text-pvpsit-blue bg-blue-50 hover:bg-pvpsit-blue hover:text-white transition-all rounded-lg"
                              >
                                <Eye className="w-3.5 h-3.5 mr-1" />
                                View
                              </button>
                              
                              {canModify && (
                                <>
                                  <button
                                    onClick={() => {
                                      fetchSessionDetails(session._id).then(() => {
                                        toast.success(`Edit mode active for ${session.sessionCode}.`);
                                      });
                                    }}
                                    className="flex items-center justify-center px-4 py-2 text-xs font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 transition-all rounded-lg"
                                  >
                                    <Pencil className="w-3.5 h-3.5 mr-1" />
                                    Edit
                                  </button>
                                  
                                  <button
                                    onClick={() => handleDeleteRequest(session._id)}
                                    className="flex items-center justify-center px-4 py-2 text-xs font-bold text-pvpsit-danger bg-red-50 hover:bg-pvpsit-danger hover:text-white transition-all rounded-lg"
                                  >
                                    <Trash2 className="w-3.5 h-3.5 mr-1" />
                                    Delete
                                  </button>
                                </>
                              )}
                            </div>

                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

            </div>
          ) : (
            /* PAGE 2: DETAILED SESSION VIEW AND DRILL DOWN */
            <div className="bg-white rounded-xl border border-pvpsit-border p-6 shadow-md space-y-6 animate-fade-in">
              
              {/* Back strip */}
              <div className="flex items-center justify-between border-b border-pvpsit-border pb-4">
                <div className="flex items-center space-x-4">
                  <button 
                    onClick={() => { setSelectedSession(null); setSelectedStudentHistory(null); }}
                    className="px-3.5 py-2 text-xs font-bold text-slate-700 bg-slate-100 hover:bg-slate-200 transition-all rounded-lg"
                  >
                    ← Back to Sessions
                  </button>
                  <div>
                    <span className="text-[9px] font-bold text-pvpsit-blue bg-blue-50 px-2 py-0.5 rounded uppercase">
                      Custom Session Details
                    </span>
                    <h3 className="font-extrabold text-pvpsit-dark mt-1 text-base">{selectedSession.sessionTitle}</h3>
                  </div>
                </div>
              </div>

              {/* Stats Overview */}
              <div className="grid grid-cols-4 gap-4">
                <div className="p-4 bg-slate-50 rounded-lg border border-pvpsit-border text-center">
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Participants</div>
                  <div className="text-xl font-black text-pvpsit-dark mt-1">{selectedSession.totalStudents}</div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-pvpsit-border text-center">
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Present</div>
                  <div className="text-xl font-black text-pvpsit-success mt-1">
                    {selectedSession.attendance.filter(r => r.status === 'PRESENT').length}
                  </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-pvpsit-border text-center">
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Absent</div>
                  <div className="text-xl font-black text-pvpsit-danger mt-1">
                    {selectedSession.attendance.filter(r => r.status === 'ABSENT').length}
                  </div>
                </div>
                <div className="p-4 bg-slate-50 rounded-lg border border-pvpsit-border text-center">
                  <div className="text-[9px] font-bold text-slate-400 uppercase">Attendance %</div>
                  <div className="text-xl font-black text-pvpsit-blue mt-1">
                    {selectedSession.totalStudents > 0 
                      ? Math.round((selectedSession.attendance.filter(r => r.status === 'PRESENT').length / selectedSession.totalStudents) * 100) 
                      : 0}%
                  </div>
                </div>
              </div>

              {/* Metadata details row */}
              <div className="p-4 bg-slate-50 border border-pvpsit-border rounded-xl grid grid-cols-3 gap-4 text-xs font-semibold text-slate-650">
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block">Training Code</span>
                  <span className="text-pvpsit-blue font-mono font-bold text-sm mt-0.5 block">{selectedSession.sessionCode}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block">Venue</span>
                  <span className="text-pvpsit-dark font-bold text-sm mt-0.5 block">{selectedSession.venue}</span>
                </div>
                <div>
                  <span className="text-[9px] text-slate-400 uppercase block">Faculty In Charge</span>
                  <span className="text-pvpsit-dark font-bold text-sm mt-0.5 block">{selectedSession.facultyId.fullName}</span>
                </div>
              </div>

              {/* Downloads & Roster Details */}
              <div className="p-4 bg-slate-50 rounded-lg border border-pvpsit-border flex items-center justify-between">
                <span className="text-xs font-bold text-slate-500">Download Reports:</span>
                <div className="flex space-x-3">
                  <button
                    onClick={() => exportToExcel(selectedSession)}
                    className="flex items-center px-4 py-2 bg-emerald-50 text-emerald-700 hover:bg-emerald-600 hover:text-white border border-emerald-200 text-xs font-bold rounded-lg transition-colors"
                  >
                    <FileSpreadsheet className="w-4 h-4 mr-2" />
                    Excel spreadsheet
                  </button>
                  <button
                    onClick={() => exportToPDF(selectedSession)}
                    className="flex items-center px-4 py-2 bg-red-50 text-pvpsit-danger hover:bg-pvpsit-danger hover:text-white border border-red-200 text-xs font-bold rounded-lg transition-colors"
                  >
                    <Download className="w-4 h-4 mr-2" />
                    PDF Document
                  </button>
                </div>
              </div>

              {/* PAGE 2 FILTERS (Shown ONLY inside detailed view) */}
              <div className="bg-slate-50/50 p-4 border border-pvpsit-border rounded-xl flex items-center space-x-4">
                {/* Section filter - Only if multiple sections exist */}
                {uniqueRosterSections.length > 1 && (
                  <div className="w-48">
                    <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Section</label>
                    <select
                      value={customSectionFilter}
                      onChange={(e) => setCustomSectionFilter(e.target.value)}
                      className="w-full px-2.5 py-1.5 text-xs border border-pvpsit-border rounded-lg bg-white font-semibold focus:outline-none"
                    >
                      <option value="">All Sections</option>
                      {uniqueRosterSections.map(sec => (
                        <option key={sec} value={sec}>Section {sec}</option>
                      ))}
                    </select>
                  </div>
                )}

                <div className="flex-1">
                  <label className="block text-[10px] font-bold text-slate-400 uppercase mb-1">Search Keywords</label>
                  <div className="relative">
                    <input
                      type="text"
                      placeholder="Search student by Roll Number or Name..."
                      value={customStudentSearch}
                      onChange={(e) => setCustomStudentSearch(e.target.value)}
                      className="w-full pl-8 pr-3 py-1.5 text-xs border border-pvpsit-border rounded-lg bg-white focus:outline-none focus:border-pvpsit-blue"
                    />
                    <Search className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-slate-400" />
                  </div>
                </div>
              </div>

              {/* Students Checklist Table */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-slate-400 uppercase">Roster Attendance Checklist</span>
                  <span className="text-[10px] font-semibold text-pvpsit-blue bg-blue-50 px-2.5 py-1 rounded">
                    ℹ️ Click any row to view raw entry/exit logs in a popup modal
                  </span>
                </div>

                <div className="border border-pvpsit-border rounded-xl overflow-hidden bg-white shadow-sm">
                  <table className="w-full text-left text-xs border-collapse">
                    <thead className="bg-slate-50 text-slate-500 border-b border-pvpsit-border font-semibold">
                      <tr>
                        <th className="py-3 px-4">Roll Number</th>
                        <th className="py-3 px-4">Student Name</th>
                        <th className="py-3 px-4">Section</th>
                        <th className="py-3 px-4">Attendance Status</th>
                        <th className="py-3 px-4">Away Duration</th>
                        <th className="py-3 px-4">Scan count</th>
                        <th className="py-3 px-4">Last Scan Time</th>
                        <th className="py-3 px-4 text-right">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {rosterList.length === 0 ? (
                        <tr>
                          <td colSpan={8} className="py-8 text-center font-semibold text-slate-400 text-xs">
                            No students match the current search filters.
                          </td>
                        </tr>
                      ) : (
                        rosterList.map((record) => (
                          <tr 
                            key={record.rollNumber}
                            onClick={() => setSelectedStudentHistory(record)}
                            className="hover:bg-slate-50/60 cursor-pointer transition-colors"
                          >
                            <td className="py-3.5 px-4 font-bold text-slate-700 font-mono">{record.rollNumber}</td>
                            <td className="py-3.5 px-4 font-semibold text-pvpsit-dark">{record.studentName}</td>
                            <td className="py-3.5 px-4 font-semibold text-slate-500">{record.section || 'N/A'}</td>
                            <td className="py-3.5 px-4">
                              <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                                record.status === 'PRESENT' ? 'bg-green-100 text-green-700' :
                                record.status === 'AWAY' ? 'bg-orange-100 text-orange-700' :
                                'bg-red-100 text-red-700'
                              }`}>
                                {record.status}
                              </span>
                            </td>
                            <td className="py-3.5 px-4 text-slate-500 font-semibold">{record.totalAwayMinutes} mins</td>
                            <td className="py-3.5 px-4 text-slate-455 font-bold">{record.scans.length} scans</td>
                            <td className="py-3.5 px-4 text-slate-450 font-mono">{getLastScanTimeStr(record)}</td>
                            <td className="py-3.5 px-4 text-right" onClick={(e) => e.stopPropagation()}>
                              <button
                                onClick={() => handleEditClick(record)}
                                className="p-1.5 hover:bg-slate-100 text-slate-400 hover:text-pvpsit-blue rounded-lg transition-colors"
                              >
                                <Pencil className="w-3.5 h-3.5" />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              </div>

            </div>
          )}
        </>
      )}

      {/* STUDENT HISTORY MODAL TIMELINE OVERLAY */}
      {selectedStudentHistory && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-xl border border-pvpsit-border shadow-md overflow-hidden">
            
            <div className="px-6 py-4 border-b border-pvpsit-border flex items-center justify-between">
              <div>
                <h3 className="font-bold text-pvpsit-blue">Scan Movement Logs</h3>
                <p className="text-[10px] text-slate-500 font-semibold mt-0.5 font-mono">
                  {selectedStudentHistory.rollNumber} — {selectedStudentHistory.studentName}
                </p>
              </div>
              <button 
                onClick={() => setSelectedStudentHistory(null)} 
                className="text-slate-450 hover:text-slate-700 font-black text-sm"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="flex justify-between items-center text-xs font-semibold text-slate-650 border-b border-slate-100 pb-2">
                <span>Total Away Duration:</span>
                <span className="font-bold text-pvpsit-blue bg-blue-50 px-2 py-0.5 rounded">
                  {selectedStudentHistory.totalAwayMinutes} Mins
                </span>
              </div>

              <div className="relative pl-4 border-l border-slate-200 space-y-4 max-h-[300px] overflow-y-auto pr-1">
                {selectedStudentHistory.scans.length === 0 ? (
                  <div className="text-slate-400 text-center py-6 font-semibold text-xs">
                    No raw entry/exit movement logs recorded for this student.
                  </div>
                ) : (
                  selectedStudentHistory.scans.map((scan, idx) => (
                    <div key={idx} className="relative">
                      <div className={`absolute -left-[21px] top-1.5 w-2 h-2 rounded-full border-2 border-white ring-4 ${
                        scan.action === 'IN' ? 'bg-green-500 ring-green-50' : 'bg-orange-500 ring-orange-50'
                      }`}></div>
                      <div className="text-xs">
                        <span className={`font-bold uppercase ${scan.action === 'IN' ? 'text-green-600' : 'text-orange-500'}`}>
                          {scan.action === 'IN' ? 'Entered Room' : 'Left Room'}
                        </span>
                        <p className="text-[10px] text-slate-450 font-semibold mt-0.5 font-mono">
                          {new Date(scan.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        </p>
                      </div>
                    </div>
                  ))
                )}
              </div>

              <div className="px-6 py-4 border-t border-pvpsit-border flex items-center justify-end -mx-6 -mb-6 bg-slate-50 mt-6">
                <button
                  type="button"
                  onClick={() => setSelectedStudentHistory(null)}
                  className="px-4 py-2 text-xs font-semibold border border-slate-200 rounded-lg text-slate-700 bg-white hover:bg-slate-100 transition-colors"
                >
                  Close Logs
                </button>
              </div>
            </div>

          </div>
        </div>
      )}

      {/* EDIT MODAL DIALOG OVERLAY */}
      {editingRecord && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-md bg-white rounded-xl border border-pvpsit-border shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-pvpsit-border flex items-center justify-between">
              <h3 className="font-bold text-pvpsit-blue">Adjust Student Attendance</h3>
              <button onClick={() => setEditingRecord(null)} className="text-slate-400 hover:text-slate-600 font-bold">✕</button>
            </div>
            
            <form onSubmit={handleEditSubmit} className="p-6 space-y-4">
              
              <div>
                <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Student</span>
                <span className="text-sm font-black text-pvpsit-dark font-mono">{editingRecord.rollNumber}</span>
                <span className="text-xs text-slate-500 font-semibold block">{editingRecord.studentName}</span>
              </div>

              <div>
                <label className="block text-xs font-semibold text-pvpsit-dark mb-1.5">Change Status To *</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setEditStatus('PRESENT')}
                    className={`py-2 text-xs font-bold rounded-lg border-2 transition-all flex items-center justify-center ${
                      editStatus === 'PRESENT'
                        ? 'border-pvpsit-success bg-green-50 text-pvpsit-success'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <Check className="w-3.5 h-3.5 mr-1" />
                    PRESENT
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditStatus('ABSENT')}
                    className={`py-2 text-xs font-bold rounded-lg border-2 transition-all flex items-center justify-center ${
                      editStatus === 'ABSENT'
                        ? 'border-pvpsit-danger bg-red-50 text-pvpsit-danger'
                        : 'border-slate-200 text-slate-500 hover:bg-slate-50'
                    }`}
                  >
                    <X className="w-3.5 h-3.5 mr-1" />
                    ABSENT
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Reason for Adjustment *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. Late Correction / Scanner bypass"
                  value={editReason}
                  onChange={(e) => setEditReason(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none focus:border-pvpsit-blue"
                />
              </div>

              <div className="px-6 py-4 border-t border-pvpsit-border flex items-center justify-end space-x-3 -mx-6 -mb-6 bg-slate-50 mt-6">
                <button
                  type="button"
                  onClick={() => setEditingRecord(null)}
                  className="px-4 py-2 text-xs font-semibold border border-slate-200 rounded-lg text-slate-700 bg-white hover:bg-slate-100 transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-bold bg-pvpsit-blue hover:bg-blue-700 text-white rounded-lg transition-colors"
                >
                  Save Changes
                </button>
              </div>

            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      <ConfirmModal
        isOpen={deleteModalOpen}
        title="Delete Attendance Session"
        message="Are you sure you want to delete this attendance session? This action cannot be easily undone and will permanently remove this record from the database."
        onConfirm={handleConfirmDelete}
        onCancel={() => { setDeleteModalOpen(false); setSessionToDelete(null); }}
      />

    </div>
  );
};
