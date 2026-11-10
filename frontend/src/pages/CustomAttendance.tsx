import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import * as XLSX from 'xlsx';
import { io, Socket } from 'socket.io-client';
import { ScannerInput } from '../components/ScannerInput';
import { HeaderActions } from '../components/HeaderActions';
import { playErrorBeep, preloadErrorBeep } from '../utils/errorBeep';
import { ScanBlockedPopup, BlockedScanInfo } from '../components/ScanBlockedPopup';
import { defaultDecision, reviewDetail } from '../utils/reviewReason';
import {
  Clock,
  Search,
  Plus,
  AlertCircle,
  Clipboard
} from 'lucide-react';
import { getCurrentAcademicYear, getAcademicYearOptions } from '../utils/academicYear';

interface IStudentRoster {
  rollNumber: string;
  studentName: string;
}

interface IActiveCustomSession {
  _id: string;
  sessionCode: string;
  sessionTitle: string;
  venue: string;
  startTime: string;
  totalStudents: number;
  attendance: any[];
}

/** Rebuilds the movement log from scans saved in the database (survives refresh/re-login). Newest first. */
const buildMovementHistory = (students: any[]): any[] => {
  const entries: any[] = [];
  students.forEach(st => {
    let lastOut: number | null = null;
    (st.scans || []).forEach((sc: any) => {
      const t = new Date(sc.timestamp).getTime();
      let logMessage = 'Entered session';
      if (sc.action === 'OUT') {
        lastOut = t;
        logMessage = 'Left session';
      } else if (lastOut !== null) {
        logMessage = `Returned (Away duration: ${Math.round((t - lastOut) / 60000)} min)`;
        lastOut = null;
      }
      entries.push({ timestamp: new Date(sc.timestamp).toISOString(), rollNumber: st.rollNumber, studentName: st.studentName, logMessage });
    });
  });
  return entries.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
};

export const CustomAttendance: React.FC = () => {
  const [session, setSession] = useState<IActiveCustomSession | null>(null);

  // Setup form states
  const [sessionTitle, setSessionTitle] = useState('');
  const [venue, setVenue] = useState('Auditorium');
  const [description, setDescription] = useState('');
  const [eventDate, setEventDate] = useState(new Date().toISOString().split('T')[0]);
  const [academicYear, setAcademicYear] = useState(getCurrentAcademicYear());
  const [year, setYear] = useState('');
  const [semester, setSemester] = useState('');
  const [section, setSection] = useState('');
  const [rosterSource, setRosterSource] = useState<'excel' | 'manual'>('excel');
  const [studentRoster, setStudentRoster] = useState<IStudentRoster[]>([]);

  // Manual entry states
  const [manualRoll, setManualRoll] = useState('');
  const [manualName, setManualName] = useState('');

  // Live session states
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [searchQuery, setSearchQuery] = useState('');
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0, away: 0 });
  const [movementLog, setMovementLog] = useState<any[]>([]);
  const [blockedPopup, setBlockedPopup] = useState<BlockedScanInfo | null>(null);

  // Flash highlight state
  const [highlightRoll, setHighlightRoll] = useState<string | null>(null);
  const [highlightStatus, setHighlightStatus] = useState<'PRESENT' | 'AWAY' | null>(null);

  // Review Dialog states
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [awayStudents, setAwayStudents] = useState<any[]>([]);
  const [reviewDecisions, setReviewDecisions] = useState<{ [rollNumber: string]: 'PRESENT' | 'ABSENT' }>({});

  const socketRef = useRef<Socket | null>(null);

  // Load the alert sound ahead of time so the first refused scan beeps instantly
  useEffect(() => { preloadErrorBeep(); }, []);

  // Check for active custom session on mount
  const checkActiveSession = async () => {
    try {
      const res = await axios.get('/api/custom-attendance/active');
      if (res.data.success && res.data.data) {
        const active = res.data.data;
        setSession(active);
        setMovementLog(buildMovementHistory(active.attendance || []));
        let present = 0, absent = 0, away = 0;
        active.attendance.forEach((r: any) => {
          if (r.status === 'PRESENT') present++;
          else if (r.status === 'ABSENT') absent++;
          else if (r.status === 'AWAY') away++;
        });
        setStats({ total: active.totalStudents, present, absent, away });
      }
    } catch (err) {
      console.error('Failed to load active custom session.');
    }
  };

  useEffect(() => {
    checkActiveSession();
  }, []);

  // WebSockets configurations
  useEffect(() => {
    if (!session) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    const socket = io();
    socketRef.current = socket;

    socket.emit('joinSession', session._id);

    socket.on('studentScanned', (data: any) => {
      setHighlightRoll(data.rollNumber);
      setHighlightStatus(data.status === 'AWAY' ? 'AWAY' : 'PRESENT');
      setTimeout(() => {
        setHighlightRoll(null);
        setHighlightStatus(null);
      }, 800);

      setSession((prev) => {
        if (!prev) return null;
        const updated = prev.attendance.map((s) =>
          s.rollNumber.toUpperCase() === data.rollNumber.toUpperCase()
            ? { ...s, status: data.status, scans: data.scans, totalAwayMinutes: data.totalAwayMinutes, lastScanTime: data.lastScanTime }
            : s
        );
        return { ...prev, attendance: updated };
      });

      setTimeout(() => {
        const row = document.getElementById(`row-${data.rollNumber}`);
        row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    });

    socket.on('statisticsUpdated', (statsData: any) => {
      setStats(statsData);
    });

    socket.on('movementUpdated', (moveData: any) => {
      setMovementLog((prev) => [moveData, ...prev]);
    });

    socket.on('sessionCompleted', () => {
      toast.success('Custom session completed.');
      setSession(null);
    });

    return () => {
      socket.disconnect();
    };
  }, [session]);

  // Session elapsed timer
  useEffect(() => {
    if (!session) return;

    const updateTimer = () => {
      const start = new Date(session.startTime).getTime();
      const diff = Date.now() - start;
      const secs = Math.floor((diff / 1000) % 60);
      const mins = Math.floor((diff / (1000 * 60)) % 60);
      const hours = Math.floor(diff / (1000 * 60 * 60));

      const padded = (n: number) => n.toString().padStart(2, '0');
      setElapsedTime(`${padded(hours)}:${padded(mins)}:${padded(secs)}`);
    };

    updateTimer();
    const interval = setInterval(updateTimer, 1000);
    return () => clearInterval(interval);
  }, [session]);

  // Parse Excel sheets client-side
  const handleExcelImport = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!e.target.files || !e.target.files[0]) return;

    const file = e.target.files[0];
    const reader = new FileReader();

    reader.onload = (event) => {
      const data = new Uint8Array(event.target?.result as ArrayBuffer);
      const workbook = XLSX.read(data, { type: 'array' });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<any>(sheet);

      const parsedRoster: IStudentRoster[] = [];
      json.forEach((row: any) => {
        const roll = String(row['Roll_Number'] || row['Roll Number'] || row['RollNo'] || row['ROLL NUMBER'] || '').trim().toUpperCase();
        const name = String(row['Name'] || row['Student Name'] || row['studentName'] || row['STUDENT NAME'] || '').trim();
        if (roll && name) {
          parsedRoster.push({ rollNumber: roll, studentName: name });
        }
      });

      if (parsedRoster.length > 0) {
        setStudentRoster(parsedRoster);
        toast.success(`Loaded ${parsedRoster.length} students from spreadsheet.`);
      } else {
        toast.error('No valid roll numbers/names columns found in the spreadsheet.');
      }
    };
    reader.readAsArrayBuffer(file);
  };

  const handleAddManual = () => {
    if (!manualRoll || !manualName) {
      toast.error('Please enter both roll number and name.');
      return;
    }
    const exists = studentRoster.some((s) => s.rollNumber.toUpperCase() === manualRoll.trim().toUpperCase());
    if (exists) {
      toast.error('Student roll number already exists in roster.');
      return;
    }
    setStudentRoster([...studentRoster, { rollNumber: manualRoll.trim().toUpperCase(), studentName: manualName.trim() }]);
    setManualRoll('');
    setManualName('');
  };

  const handleRemoveManual = (idx: number) => {
    setStudentRoster(studentRoster.filter((_, i) => i !== idx));
  };

  const handleStartSession = async () => {
    if (!sessionTitle.trim() || studentRoster.length === 0) {
      toast.error('Session Title and Student roster are required.');
      return;
    }

    try {
      const res = await axios.post('/api/custom-attendance/start', {
        sessionTitle,
        venue,
        description,
        eventDate,
        studentRoster,
        academicYear,
        year: year ? Number(year) : undefined,
        semester: semester ? Number(semester) : undefined,
        section: section || undefined
      });
      if (res.data.success) {
        toast.success('Custom session active!');
        setSession(res.data.data);
        setMovementLog([]);
        setStats({ total: studentRoster.length, present: 0, absent: studentRoster.length, away: 0 });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to start custom session.');
    }
  };

  const handleBarcodeProcess = async (barcode: string) => {
    if (!session) return;
    try {
      await axios.post('/api/custom-attendance/scan', {
        sessionId: session._id,
        rollNumber: barcode
      });
    } catch (err: any) {
      const data = err.response?.data;
      if (err.response?.status === 403 && data?.reason === 'BLOCKLIST') {
        playErrorBeep();
        setBlockedPopup({ message: data.message, rollNumber: data.details?.rollNumber, studentName: data.details?.studentName });
        return;
      }
      toast.error(data?.message || 'Invalid barcode scanner input.');
    }
  };



  const handleEndSession = async () => {
    if (!session) return;
    try {
      const res = await axios.post('/api/custom-attendance/end', { sessionId: session._id });
      if (res.data.success) {
        if (res.data.needsReview) {
          setAwayStudents(res.data.awayStudents);
          const initialDecisions: any = {};
          res.data.awayStudents.forEach((s: any) => {
            initialDecisions[s.rollNumber] = defaultDecision(s.reason);
          });
          setReviewDecisions(initialDecisions);
          setShowReviewModal(true);
        } else {
          toast.success('Custom session ended successfully.');
          setSession(null);
        }
      }
    } catch (err) {
      toast.error('Failed to end custom session.');
    }
  };

  const handleFinalizeSession = async () => {
    if (!session) return;
    const decisionsArray = Object.keys(reviewDecisions).map((roll) => ({
      rollNumber: roll,
      finalDecision: reviewDecisions[roll]
    }));

    try {
      const res = await axios.post('/api/custom-attendance/finalize', {
        sessionId: session._id,
        reviewDecisions: decisionsArray
      });
      if (res.data.success) {
        toast.success('Custom attendance locked.');
        setShowReviewModal(false);
        setSession(null);
      }
    } catch (err) {
      toast.error('Failed to finalize decisions.');
    }
  };

  const filteredStudents = session?.attendance.filter(
    (std) =>
      std.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      std.studentName.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="h-full">
      {!session ? (
        
        // --- STAGE 1: SETUP PANEL ---
        <div className="grid grid-cols-3 gap-6">
          <div className="col-span-2 bg-pvpsit-card rounded-xl border border-pvpsit-border p-6 space-y-4">
            <h3 className="font-bold text-pvpsit-blue text-sm">Custom Attendance Details</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Session Event Title *</label>
                <input
                  type="text"
                  required
                  placeholder="e.g. SDP Bootcamp, Hackathon, Guest Lecture"
                  className="w-full px-3 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none"
                  value={sessionTitle}
                  onChange={(e) => setSessionTitle(e.target.value)}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Venue Location *</label>
                  <input
                    type="text"
                    required
                    className="w-full px-3 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none"
                    value={venue}
                    onChange={(e) => setVenue(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Event Date</label>
                  <input
                    type="date"
                    className="w-full px-3 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none"
                    value={eventDate}
                    onChange={(e) => setEventDate(e.target.value)}
                  />
                </div>
              </div>

              <div className="grid grid-cols-4 gap-4 bg-slate-50 p-4 border border-pvpsit-border rounded-xl">
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Academic Year</label>
                  <select
                    className="w-full px-3 py-1.5 text-xs border border-pvpsit-border rounded-lg bg-white font-semibold focus:outline-none"
                    value={academicYear}
                    onChange={(e) => setAcademicYear(e.target.value)}
                  >
                    {getAcademicYearOptions().map((ay) => (
                      <option key={ay} value={ay}>{ay}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Target Year (Opt)</label>
                  <select
                    className="w-full px-3 py-1.5 text-xs border border-pvpsit-border rounded-lg bg-white font-semibold focus:outline-none"
                    value={year}
                    onChange={(e) => setYear(e.target.value)}
                  >
                    <option value="">All Years</option>
                    <option value="2">2nd Year</option>
                    <option value="3">3rd Year</option>
                    <option value="4">4th Year</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Semester (Opt)</label>
                  <select
                    className="w-full px-3 py-1.5 text-xs border border-pvpsit-border rounded-lg bg-white font-semibold focus:outline-none"
                    value={semester}
                    onChange={(e) => setSemester(e.target.value)}
                  >
                    <option value="">All Semesters</option>
                    <option value="1">1st Sem</option>
                    <option value="2">2nd Sem</option>
                  </select>
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase mb-1">Section (Opt)</label>
                  <select
                    className="w-full px-3 py-1.5 text-xs border border-pvpsit-border rounded-lg bg-white font-semibold focus:outline-none"
                    value={section}
                    onChange={(e) => setSection(e.target.value)}
                  >
                    <option value="">All Sections</option>
                    <option value="S1">S1</option>
                    <option value="S2">S2</option>
                    <option value="S3">S3</option>
                    <option value="S4">S4</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Short Description</label>
                <textarea
                  className="w-full px-3 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none h-16"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />
              </div>

              <div className="border-t border-slate-100 pt-4 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-pvpsit-dark">Configure Student Roster</span>
                  <div className="space-x-2">
                    <button
                      type="button"
                      onClick={() => { setRosterSource('excel'); setStudentRoster([]); }}
                      className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                        rosterSource === 'excel' ? 'bg-pvpsit-blue text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      Import Spreadsheet
                    </button>
                    <button
                      type="button"
                      onClick={() => { setRosterSource('manual'); setStudentRoster([]); }}
                      className={`px-3 py-1.5 rounded text-xs font-bold transition-all ${
                        rosterSource === 'manual' ? 'bg-pvpsit-blue text-white' : 'bg-slate-100 text-slate-600'
                      }`}
                    >
                      Manual Entry
                    </button>
                  </div>
                </div>

                {rosterSource === 'excel' ? (
                  <div className="p-4 bg-slate-50 border border-pvpsit-border rounded-lg flex items-center justify-between">
                    <input
                      type="file"
                      accept=".xlsx, .xls"
                      onChange={handleExcelImport}
                      className="text-xs file:mr-3 file:py-1.5 file:px-3 file:rounded file:border-0 file:bg-slate-200 file:text-slate-700 cursor-pointer"
                    />
                  </div>
                ) : (
                  <div className="p-4 bg-slate-50 border border-pvpsit-border rounded-lg space-y-3">
                    <div className="grid grid-cols-2 gap-3">
                      <input
                        type="text"
                        placeholder="Roll Number (e.g. 23501A0501)"
                        className="px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-white uppercase"
                        value={manualRoll}
                        onChange={(e) => setManualRoll(e.target.value)}
                      />
                      <input
                        type="text"
                        placeholder="Full Name"
                        className="px-3 py-2 text-xs border border-pvpsit-border rounded-lg bg-white"
                        value={manualName}
                        onChange={(e) => setManualName(e.target.value)}
                      />
                    </div>
                    <button
                      type="button"
                      onClick={handleAddManual}
                      className="flex items-center px-4 py-2 bg-pvpsit-blue text-white rounded text-xs font-semibold"
                    >
                      <Plus className="w-3.5 h-3.5 mr-1" /> Add Row
                    </button>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Setup right side (roster preview) */}
          <div className="col-span-1 bg-pvpsit-card rounded-xl border border-pvpsit-border p-6 flex flex-col justify-between overflow-hidden max-h-[400px]">
            <h3 className="font-bold text-pvpsit-blue text-sm mb-2 flex items-center">
              <Clipboard className="w-4 h-4 mr-1.5" />
              Roster Preview ({studentRoster.length})
            </h3>
            
            <div className="flex-1 overflow-auto border border-slate-100 rounded-lg">
              {studentRoster.length === 0 ? (
                <div className="text-center text-xs text-slate-400 mt-12">Roster is currently empty.</div>
              ) : (
                <table className="w-full text-left border-collapse text-[10px]">
                  <tbody className="divide-y divide-slate-100">
                    {studentRoster.map((std, idx) => (
                      <tr key={idx} className="hover:bg-slate-50">
                        <td className="px-3 py-2 font-bold text-pvpsit-dark">{std.rollNumber}</td>
                        <td className="px-3 py-2 truncate max-w-[100px]">{std.studentName}</td>
                        {rosterSource === 'manual' && (
                          <td className="px-3 py-2 text-right">
                            <button onClick={() => handleRemoveManual(idx)} className="text-pvpsit-danger">✕</button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            <button
              onClick={handleStartSession}
              disabled={studentRoster.length === 0 || !sessionTitle.trim()}
              className="w-full mt-4 py-2.5 bg-pvpsit-blue hover:bg-blue-700 text-white rounded-lg text-xs font-semibold transition-colors disabled:bg-blue-300"
            >
              Start Custom Session
            </button>
          </div>
        </div>
      ) : (
        
        // --- STAGE 2: LIVE ATTENDANCE DASHBOARD ---
        <div className="space-y-6 h-full flex flex-col animate-fade-in">
          
          <div className="bg-pvpsit-card rounded-xl border border-pvpsit-border p-4 flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[10px] font-bold text-pvpsit-blue uppercase tracking-wider">
                Custom Session Code: {session.sessionCode}
              </span>
              <h2 className="text-lg font-bold text-pvpsit-dark mt-0.5">{session.sessionTitle}</h2>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">Venue: {session.venue}</p>
            </div>

            {/* Active Scanner Text Box */}
            <ScannerInput
              onScan={handleBarcodeProcess}
              enabled={!!session && !showReviewModal}
            />

            <div className="flex items-center space-x-6">
              <div className="flex items-center space-x-3 bg-slate-50 px-4 py-2 border border-pvpsit-border rounded-lg">
                <Clock className="w-5 h-5 text-pvpsit-blue" />
                <div className="text-center">
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-wider leading-none">Running Timer</div>
                  <div className="text-base font-bold text-pvpsit-dark mt-0.5">{elapsedTime}</div>
                </div>
              </div>
              <span className="px-3 py-1.5 bg-green-50 text-pvpsit-success border border-green-200 text-xs font-bold rounded-lg animate-pulse">
                ACTIVE SCANNING
              </span>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-4">
            <div className="bg-pvpsit-card rounded-xl border border-pvpsit-border p-4 flex flex-col justify-between">
              <span className="text-[10px] font-bold text-slate-400 uppercase">Roster Count</span>
              <span className="text-2xl font-bold text-pvpsit-dark mt-1">{stats.total}</span>
            </div>
            <div className="bg-pvpsit-card rounded-xl border border-pvpsit-border p-4 flex flex-col justify-between border-l-4 border-l-pvpsit-success">
              <span className="text-[10px] font-bold text-pvpsit-success uppercase">Present</span>
              <span className="text-2xl font-bold text-pvpsit-success mt-1">{stats.present}</span>
            </div>
            <div className="bg-pvpsit-card rounded-xl border border-pvpsit-border p-4 flex flex-col justify-between border-l-4 border-l-pvpsit-danger">
              <span className="text-[10px] font-bold text-pvpsit-danger uppercase">Absent</span>
              <span className="text-2xl font-bold text-pvpsit-danger mt-1">{stats.absent}</span>
            </div>
            <div className="bg-pvpsit-card rounded-xl border border-pvpsit-border p-4 flex flex-col justify-between border-l-4 border-l-pvpsit-warning">
              <span className="text-[10px] font-bold text-pvpsit-warning uppercase">Away</span>
              <span className="text-2xl font-bold text-pvpsit-warning mt-1">{stats.away}</span>
            </div>
          </div>



          {/* Live Scanner workspace splits */}
          <div className="grid grid-cols-3 gap-6 flex-1 overflow-hidden">
            <div className="col-span-2 bg-pvpsit-card rounded-xl border border-pvpsit-border flex flex-col overflow-hidden">
              <div className="p-4 border-b border-pvpsit-border flex items-center justify-between">
                <h3 className="font-bold text-pvpsit-blue text-sm"> Roster list</h3>
                <div className="relative">
                  <input
                    type="text"
                    className="pl-8 pr-3 py-1.5 text-xs border border-pvpsit-border rounded-lg bg-slate-50 focus:outline-none"
                    placeholder="Search by Roll/Name..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                  />
                  <Search className="absolute left-2.5 top-2 w-3.5 h-3.5 text-slate-400" />
                </div>
              </div>

              <div className="flex-1 overflow-auto">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-pvpsit-border text-slate-600 font-semibold sticky top-0">
                    <tr>
                      <th className="px-4 py-3">Roll Number</th>
                      <th className="px-4 py-3">Student Name</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Scan Count</th>
                      <th className="px-4 py-3">Last Scan</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pvpsit-border">
                    {filteredStudents.map((std) => {
                      const isHighlighted = highlightRoll === std.rollNumber;
                      return (
                        <tr
                          key={std.rollNumber}
                          id={`row-${std.rollNumber}`}
                          className={`transition-all duration-300 hover:bg-slate-50/50 ${
                            isHighlighted
                              ? highlightStatus === 'AWAY'
                                ? 'scan-highlight-away'
                                : 'scan-highlight-present'
                              : ''
                          }`}
                        >
                          <td className="px-4 py-3 font-semibold text-pvpsit-dark">{std.rollNumber}</td>
                          <td className="px-4 py-3 font-medium">{std.studentName}</td>
                          <td className="px-4 py-3">
                            <span className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                              std.status === 'PRESENT'
                                ? 'bg-green-50 text-pvpsit-success border border-green-200'
                                : std.status === 'AWAY'
                                ? 'bg-amber-50 text-pvpsit-warning border border-amber-200'
                                : 'bg-red-50 text-pvpsit-danger border border-red-200'
                            }`}>
                              {std.status}
                            </span>
                          </td>
                          <td className="px-4 py-3 font-semibold">{std.scans.length}</td>
                          <td className="px-4 py-3 text-slate-500">
                            {std.lastScanTime ? new Date(std.lastScanTime).toLocaleTimeString() : '-'}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            <div className="col-span-1 bg-pvpsit-card rounded-xl border border-pvpsit-border flex flex-col overflow-hidden">
              <div className="p-4 border-b border-pvpsit-border bg-slate-50">
                <h3 className="font-bold text-pvpsit-blue text-sm">Real-time Movements Log</h3>
              </div>
              <div className="flex-1 overflow-auto p-4 space-y-3">
                {movementLog.length === 0 ? (
                  <div className="text-center text-xs text-slate-400 mt-12">No barcodes scanned yet.</div>
                ) : (
                  movementLog.map((log, idx) => (
                    <div key={idx} className="text-[11px] border-b border-slate-100 pb-2.5 space-y-1">
                      <div className="flex justify-between font-bold text-slate-400">
                        <span>{new Date(log.timestamp).toLocaleTimeString()}</span>
                        <span className="text-pvpsit-blue">{log.rollNumber}</span>
                      </div>
                      <div className="font-medium text-pvpsit-dark truncate">{log.studentName}</div>
                      <div className="font-semibold text-slate-600">{log.logMessage}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* End Session lives in the top bar, next to the clock */}
          <HeaderActions>
            <button
              onClick={handleEndSession}
              className="px-4 py-2 bg-pvpsit-danger hover:bg-red-700 text-white rounded-lg text-xs font-bold transition-colors shadow-sm whitespace-nowrap"
            >
              End Session &amp; Submit
            </button>
          </HeaderActions>
        </div>
      )}

      <ScanBlockedPopup info={blockedPopup} onClose={() => setBlockedPopup(null)} />

      {/* AWAY REVIEW DIALOG MODAL */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-2xl bg-white rounded-xl border border-pvpsit-border shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-pvpsit-border bg-red-50 flex items-center justify-between">
              <h3 className="font-bold text-pvpsit-danger text-sm flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                Students Needing Your Decision
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500 font-medium">
                These students are still away, or were refused at the scanner (block list) so nothing was recorded for them. Mark each Present or Absent before final submission.
              </p>

              <div className="max-h-[300px] overflow-auto border border-pvpsit-border rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-pvpsit-border font-semibold">
                    <tr>
                      <th className="px-4 py-2.5">Roll Number</th>
                      <th className="px-4 py-2.5">Student Name</th>
                      <th className="px-4 py-2.5">Reason</th>
                      <th className="px-4 py-2.5 text-right">Final Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pvpsit-border">
                    {awayStudents.map((std) => (
                      <tr key={std.rollNumber}>
                        <td className="px-4 py-3 font-semibold text-pvpsit-dark">{std.rollNumber}</td>
                        <td className="px-4 py-3 font-medium">{std.studentName}</td>
                        <td className="px-4 py-3">{reviewDetail(std)}</td>
                        <td className="px-4 py-3 text-right space-x-3">
                          <label className="inline-flex items-center cursor-pointer">
                            <input
                              type="radio"
                              name={`decision-${std.rollNumber}`}
                              className="w-3.5 h-3.5 text-pvpsit-success"
                              checked={reviewDecisions[std.rollNumber] === 'PRESENT'}
                              onChange={() => setReviewDecisions({ ...reviewDecisions, [std.rollNumber]: 'PRESENT' })}
                            />
                            <span className="ml-1 text-xs font-bold text-pvpsit-success">Present</span>
                          </label>
                          <label className="inline-flex items-center cursor-pointer">
                            <input
                              type="radio"
                              name={`decision-${std.rollNumber}`}
                              className="w-3.5 h-3.5 text-pvpsit-danger"
                              checked={reviewDecisions[std.rollNumber] === 'ABSENT'}
                              onChange={() => setReviewDecisions({ ...reviewDecisions, [std.rollNumber]: 'ABSENT' })}
                            />
                            <span className="ml-1 text-xs font-bold text-pvpsit-danger">Absent</span>
                          </label>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="px-6 py-4 border-t border-pvpsit-border flex items-center justify-end space-x-3 -mx-6 -mb-6 bg-slate-50 mt-6">
                <button
                  type="button"
                  onClick={() => setShowReviewModal(false)}
                  className="px-4 py-2 text-xs font-medium border border-slate-200 rounded-lg text-slate-700 bg-white hover:bg-slate-100"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleFinalizeSession}
                  className="px-4 py-2 text-xs font-semibold bg-pvpsit-blue hover:bg-blue-700 text-white rounded-lg"
                >
                  Finalize & Submit
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
