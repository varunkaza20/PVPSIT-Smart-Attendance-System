import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';
import { io, Socket } from 'socket.io-client';
import { ScannerInput } from '../components/ScannerInput';
import {
  Play,
  AlertCircle,
  Clock,
  Search
} from 'lucide-react';

interface ITimetable {
  _id: string;
  year: number;
  semester: number;
  section: string;
  subjectId: { _id: string; subjectName: string; shortName: string };
  laboratoryId?: { _id: string; laboratoryName: string };
  startTime: string;
  endTime: string;
  duration: number;
  facultyId: { _id: string; fullName: string; employeeId: string };
}

interface IStudentScanned {
  studentId: string;
  rollNumber: string;
  studentName: string;
  status: 'PRESENT' | 'ABSENT' | 'AWAY';
  scans: any[];
  totalAwayMinutes: number;
  lastScanTime?: string;
}

interface IMovementLog {
  timestamp: string;
  rollNumber: string;
  studentName: string;
  logMessage: string;
}

interface IActiveSession {
  _id: string;
  sessionCode: string;
  startTime: string;
  subjectId: { subjectName: string; shortName: string };
  laboratoryId?: { laboratoryName: string };
  section: string;
  year: number;
  semester: number;
  totalStudents: number;
  attendance: IStudentScanned[];
}

export const RegularAttendance: React.FC = () => {
  // Navigation Stage
  const [session, setSession] = useState<IActiveSession | null>(null);
  
  // Stage 1 (Setup) states
  const [schedule, setSchedule] = useState<ITimetable[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [setupConfig, setSetupConfig] = useState({
    year: 4,
    semester: 1,
    section: 'S1',
    timetableId: ''
  });

  // Stage 2 (Live Session) states
  const [searchQuery, setSearchQuery] = useState('');
  const [elapsedTime, setElapsedTime] = useState('00:00:00');
  const [stats, setStats] = useState({ total: 0, present: 0, absent: 0, away: 0 });
  const [movementLog, setMovementLog] = useState<IMovementLog[]>([]);
  
  // Highlight flash state
  const [highlightRoll, setHighlightRoll] = useState<string | null>(null);
  const [highlightStatus, setHighlightStatus] = useState<'PRESENT' | 'AWAY' | null>(null);

  // Review Dialog states
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [awayStudents, setAwayStudents] = useState<any[]>([]);
  const [reviewDecisions, setReviewDecisions] = useState<{ [rollNumber: string]: 'PRESENT' | 'ABSENT' }>({});

  const socketRef = useRef<Socket | null>(null);

  // 1. Fetch Today's schedule on load
  const fetchTodaySchedule = async () => {
    setLoadingSchedule(true);
    try {
      const res = await axios.get('/api/faculty/timetable/today');
      if (res.data.success) {
        setSchedule(res.data.data);
        if (res.data.data.length > 0) {
          const first = res.data.data[0];
          setSetupConfig({
            year: first.year,
            semester: first.semester,
            section: first.section,
            timetableId: first._id
          });
        }
      }
    } catch (err) {
      toast.error("Failed to load today's class schedule.");
    } finally {
      setLoadingSchedule(false);
    }
  };

  // Check for pre-existing active session on mount
  const checkActiveSession = async () => {
    try {
      const res = await axios.get('/api/attendance/active');
      if (res.data.success && res.data.data) {
        const active = res.data.data;
        setSession(active);
        // Initialize local stats from session data
        let present = 0, absent = 0, away = 0;
        active.attendance.forEach((r: any) => {
          if (r.status === 'PRESENT') present++;
          else if (r.status === 'ABSENT') absent++;
          else if (r.status === 'AWAY') away++;
        });
        setStats({ total: active.totalStudents, present, absent, away });
      } else {
        fetchTodaySchedule();
      }
    } catch (err) {
      console.error('Failed to resolve active session.');
      fetchTodaySchedule();
    }
  };

  useEffect(() => {
    checkActiveSession();

    // Persist a socket listener for global timetable updates
    const socket = io();
    socket.on('timetableUpdated', () => {
      fetchTodaySchedule();
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  // Auto-update timetableId when filters change to select the first matching slot
  useEffect(() => {
    const matched = schedule.find(
      (s) =>
        s.year === setupConfig.year &&
        s.semester === setupConfig.semester &&
        s.section === setupConfig.section
    );
    setSetupConfig((prev) => ({
      ...prev,
      timetableId: matched ? matched._id : ''
    }));
  }, [setupConfig.year, setupConfig.semester, setupConfig.section, schedule]);

  // 2. Setup Socket.IO listener for active session
  useEffect(() => {
    if (!session) {
      if (socketRef.current) {
        socketRef.current.disconnect();
        socketRef.current = null;
      }
      return;
    }

    // Connect to server socket proxy link
    const socket = io();
    socketRef.current = socket;

    socket.emit('joinSession', session._id);

    socket.on('studentScanned', (data: any) => {
      // Flash highlight updated row
      setHighlightRoll(data.rollNumber);
      setHighlightStatus(data.status === 'AWAY' ? 'AWAY' : 'PRESENT');
      
      setTimeout(() => {
        setHighlightRoll(null);
        setHighlightStatus(null);
      }, 800);

      // Update student table roster in memory
      setSession((prev) => {
        if (!prev) return null;
        const updated = prev.attendance.map((s) =>
          s.rollNumber.toUpperCase() === data.rollNumber.toUpperCase()
            ? { ...s, status: data.status, scans: data.scans, totalAwayMinutes: data.totalAwayMinutes, lastScanTime: data.lastScanTime }
            : s
        );
        return { ...prev, attendance: updated };
      });

      // Smooth scroll target row into view
      setTimeout(() => {
        const row = document.getElementById(`row-${data.rollNumber}`);
        row?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      }, 50);
    });

    socket.on('statisticsUpdated', (statsData: any) => {
      setStats(statsData);
    });

    socket.on('movementUpdated', (moveData: any) => {
      setMovementLog((prev) => [moveData, ...prev.slice(0, 99)]); // keep latest 100 entries
    });

    socket.on('sessionEnding', () => {
      console.log('Session has entered ending review mode.');
    });

    socket.on('sessionCompleted', () => {
      toast.success('Session completed by administrator / external source.');
      setSession(null);
      fetchTodaySchedule();
    });

    return () => {
      socket.disconnect();
    };
  }, [session]);

  // 3. Setup running session timer
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

  // 4. Global wedge keyboard scanner integrations
  const handleBarcodeProcess = async (barcode: string) => {
    if (!session) return;
    try {
      await axios.post('/api/attendance/scan', {
        sessionId: session._id,
        rollNumber: barcode
      });
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Invalid barcode scanner input.');
    }
  };



  const handleStartSession = async () => {
    try {
      const res = await axios.post('/api/attendance/start', setupConfig);
      if (res.data.success) {
        toast.success('Attendance session started successfully!');
        setSession(res.data.data);
        setMovementLog([]);
        setStats({ total: res.data.data.totalStudents, present: 0, absent: res.data.data.totalStudents, away: 0 });
      }
    } catch (err: any) {
      toast.error(err.response?.data?.message || 'Failed to start attendance session.');
    }
  };

  const handleEndSession = async () => {
    if (!session) return;
    try {
      const res = await axios.post('/api/attendance/end', { sessionId: session._id });
      if (res.data.success) {
        if (res.data.needsReview) {
          setAwayStudents(res.data.awayStudents);
          // Initialize review decisions to PRESENT by default
          const initialDecisions: any = {};
          res.data.awayStudents.forEach((s: any) => {
            initialDecisions[s.rollNumber] = 'PRESENT';
          });
          setReviewDecisions(initialDecisions);
          setShowReviewModal(true);
        } else {
          toast.success('Attendance session completed successfully!');
          setSession(null);
          fetchTodaySchedule();
        }
      }
    } catch (err) {
      toast.error('Failed to end attendance session.');
    }
  };

  const handleFinalizeSession = async () => {
    if (!session) return;
    
    // Map decisions into array
    const decisionsArray = Object.keys(reviewDecisions).map((roll) => ({
      rollNumber: roll,
      finalDecision: reviewDecisions[roll]
    }));

    try {
      const res = await axios.post('/api/attendance/finalize', {
        sessionId: session._id,
        reviewDecisions: decisionsArray
      });
      if (res.data.success) {
        toast.success('Attendance session finalized & locked.');
        setShowReviewModal(false);
        setSession(null);
        fetchTodaySchedule();
      }
    } catch (err) {
      toast.error('Failed to finalize session decisions.');
    }
  };

  // Preview selected schedule card values
  const getSelectedPreview = () => {
    return schedule.find((s) => s._id === setupConfig.timetableId);
  };

  const preview = getSelectedPreview();

  // Filter students based on search string
  const filteredStudents = session?.attendance.filter(
    (std) =>
      std.rollNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      std.studentName.toLowerCase().includes(searchQuery.toLowerCase())
  ) || [];

  return (
    <div className="h-full">
      {!session ? (
        
        // --- STAGE 1: SETUP PANEL ---
        <div className="max-w-2xl mx-auto space-y-6">
          <div className="border-b border-pvpsit-border pb-4">
            <h1 className="text-2xl font-bold text-pvpsit-blue">Regular Attendance</h1>
            <p className="text-xs text-slate-500 mt-1">Select year, sem, section to pull today's scheduled classes.</p>
          </div>

          <div className="bg-pvpsit-card rounded-xl border border-pvpsit-border p-6 space-y-6">
            <h3 className="font-bold text-pvpsit-blue text-sm">Academic Details</h3>
            
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Year</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50"
                  value={setupConfig.year}
                  onChange={(e) => setSetupConfig({ ...setupConfig, year: Number(e.target.value) })}
                >
                  <option value={2}>II Year</option>
                  <option value={3}>III Year</option>
                  <option value={4}>IV Year</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Semester</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50"
                  value={setupConfig.semester}
                  onChange={(e) => setSetupConfig({ ...setupConfig, semester: Number(e.target.value) })}
                >
                  <option value={1}>Sem 1</option>
                  <option value={2}>Sem 2</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Section</label>
                <select
                  className="w-full px-3 py-2 text-sm border border-pvpsit-border rounded-lg bg-slate-50"
                  value={setupConfig.section}
                  onChange={(e) => setSetupConfig({ ...setupConfig, section: e.target.value })}
                >
                  <option value="S1">Section 1</option>
                  <option value="S2">Section 2</option>
                  <option value="S3">Section 3</option>
                  {setupConfig.year !== 4 && <option value="S4">Section 4</option>}
                </select>
              </div>
            </div>

            {loadingSchedule ? (
              <div className="p-6 text-center text-slate-500">Retrieving today's slots...</div>
            ) : schedule.length === 0 ? (
              <div className="p-6 bg-red-50 border border-red-200 rounded-lg text-xs font-semibold text-pvpsit-danger text-center">
                No classes scheduled for today matching these filters.
              </div>
            ) : (
              <div>
                <label className="block text-xs font-semibold text-pvpsit-dark mb-1">Select Scheduled Slot *</label>
                <select
                  className="w-full px-3 py-2.5 text-sm border border-pvpsit-border rounded-lg bg-slate-50"
                  value={setupConfig.timetableId}
                  onChange={(e) => setSetupConfig({ ...setupConfig, timetableId: e.target.value })}
                >
                  {schedule
                    .filter((s) => s.year === setupConfig.year && s.section === setupConfig.section && s.semester === setupConfig.semester)
                    .map((s) => (
                      <option key={s._id} value={s._id}>
                        {s.startTime} - {s.endTime} | {s.subjectId.subjectName} {s.laboratoryId ? `(${s.laboratoryId.laboratoryName})` : ''} (Faculty: {s.facultyId?.fullName || 'N/A'})
                      </option>
                    ))}
                </select>
              </div>
            )}

            {/* Preview Card */}
            {preview && (
              <div className="p-4 bg-slate-50 border border-pvpsit-border rounded-lg grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="font-semibold text-slate-400 block uppercase mb-0.5">Subject</span>
                  <span className="font-bold text-pvpsit-dark text-sm">{preview.subjectId.subjectName}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400 block uppercase mb-0.5">Classroom / Lab</span>
                  <span className="font-bold text-pvpsit-dark text-sm">
                    {preview.laboratoryId ? preview.laboratoryId.laboratoryName : 'Theory Class'}
                  </span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400 block uppercase mb-0.5">Assigned time slot</span>
                  <span className="font-semibold text-slate-600 text-sm">{preview.startTime} - {preview.endTime}</span>
                </div>
                <div>
                  <span className="font-semibold text-slate-400 block uppercase mb-0.5">Duration</span>
                  <span className="font-semibold text-slate-600 text-sm">{preview.duration} minutes</span>
                </div>
              </div>
            )}

            <button
              onClick={handleStartSession}
              disabled={loadingSchedule || schedule.length === 0}
              className="w-full py-3 bg-pvpsit-blue hover:bg-blue-700 text-white rounded-lg text-sm font-semibold transition-colors disabled:bg-blue-300 flex items-center justify-center"
            >
              <Play className="w-4 h-4 mr-2" />
              START ATTENDANCE SESSION
            </button>
          </div>
        </div>
      ) : (
        
        // --- STAGE 2: LIVE ATTENDANCE DASHBOARD ---
        <div className="space-y-6 h-full flex flex-col">
          
          {/* Top Panel - Info Strip */}
          <div className="bg-pvpsit-card rounded-xl border border-pvpsit-border p-4 flex items-center justify-between shadow-sm">
            <div>
              <span className="text-[10px] font-bold text-pvpsit-blue uppercase tracking-wider">
                Session Code: {session.sessionCode}
              </span>
              <h2 className="text-lg font-bold text-pvpsit-dark mt-0.5">
                {session.subjectId.shortName} - {session.subjectId.subjectName}
              </h2>
              <p className="text-xs text-slate-500 font-semibold mt-0.5">
                Section {session.section} | {session.laboratoryId?.laboratoryName || 'Theory Lecture Room'}
              </p>
            </div>

            {/* Active Scanner Text Box */}
            <ScannerInput
              onScan={handleBarcodeProcess}
              enabled={!!session && !showReviewModal}
            />

            <div className="flex items-center space-x-6">
              {/* Elapsed Timer */}
              <div className="flex items-center space-x-3 bg-slate-50 px-4 py-2 border border-pvpsit-border rounded-lg">
                <Clock className="w-5 h-5 text-pvpsit-blue" />
                <div className="text-center">
                  <div className="text-xs text-slate-400 font-bold uppercase tracking-wider leading-none">Running Timer</div>
                  <div className="text-base font-bold text-pvpsit-dark mt-0.5">{elapsedTime}</div>
                </div>
              </div>

              {/* Status Badge */}
              <span className="px-3 py-1.5 bg-green-50 text-pvpsit-success border border-green-200 text-xs font-bold rounded-lg animate-pulse">
                ACTIVE SCANNING
              </span>
            </div>
          </div>

          {/* Stats Bar */}
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



          {/* Main workspace splits */}
          <div className="grid grid-cols-3 gap-6 flex-1 overflow-hidden">
            
            {/* Left: Students Table (2 width) */}
            <div className="col-span-2 bg-pvpsit-card rounded-xl border border-pvpsit-border flex flex-col overflow-hidden">
              <div className="p-4 border-b border-pvpsit-border flex items-center justify-between">
                <h3 className="font-bold text-pvpsit-blue text-sm">Class Attendance list</h3>
                
                {/* Local search bar */}
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
                      <th className="px-4 py-3">Away Duration</th>
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
                          <td className="px-4 py-3 text-slate-600">{std.totalAwayMinutes} mins</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Right: Live Movements Logs (1 width) */}
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

          {/* End session bar */}
          <div className="flex justify-end pt-3 border-t border-pvpsit-border shrink-0">
            <button
              onClick={handleEndSession}
              className="px-8 py-3 bg-pvpsit-danger hover:bg-red-700 text-white rounded-lg text-sm font-bold transition-colors shadow-sm"
            >
              End Session & Submit
            </button>
          </div>
        </div>
      )}

      {/* AWAY REVIEW DIALOG MODAL */}
      {showReviewModal && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="w-full max-w-2xl bg-white rounded-xl border border-pvpsit-border shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-pvpsit-border bg-red-50 flex items-center justify-between">
              <h3 className="font-bold text-pvpsit-danger text-sm flex items-center">
                <AlertCircle className="w-4 h-4 mr-2" />
                Students Currently Away
              </h3>
            </div>
            
            <div className="p-6 space-y-4">
              <p className="text-xs text-slate-500 font-medium">
                The following students were scanned OUT and are still away. Select whether they should be marked Present or Absent before final submission.
              </p>

              <div className="max-h-[300px] overflow-auto border border-pvpsit-border rounded-lg">
                <table className="w-full text-left border-collapse text-xs">
                  <thead className="bg-slate-50 border-b border-pvpsit-border font-semibold">
                    <tr>
                      <th className="px-4 py-2.5">Roll Number</th>
                      <th className="px-4 py-2.5">Student Name</th>
                      <th className="px-4 py-2.5">Away Duration</th>
                      <th className="px-4 py-2.5 text-right">Final Decision</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-pvpsit-border">
                    {awayStudents.map((std) => (
                      <tr key={std.rollNumber}>
                        <td className="px-4 py-3 font-semibold text-pvpsit-dark">{std.rollNumber}</td>
                        <td className="px-4 py-3 font-medium">{std.studentName}</td>
                        <td className="px-4 py-3">{std.totalAwayMinutes} mins</td>
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
                  Submit & Lock Attendance
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
