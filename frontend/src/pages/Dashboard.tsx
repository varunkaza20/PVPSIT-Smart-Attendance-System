import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { useAuth } from '../contexts/AuthContext';
import { 
  Play, 
  PlusCircle, 
  Eye, 
  BarChart2, 
  Calendar, 
  Clock, 
  Users, 
  CheckCircle, 
  AlertCircle,
  TrendingUp,
  Activity,
  ArrowRight
} from 'lucide-react';

interface ITimetableItem {
  _id: string;
  year: number;
  semester: number;
  section: string;
  subjectId: { _id: string; subjectName: string; shortName: string };
  laboratoryId?: { _id: string; laboratoryName: string };
  startTime: string;
  endTime: string;
  facultyId: { _id: string; fullName: string };
}

interface IRecentSession {
  _id: string;
  sessionCode: string;
  subjectId?: { _id: string; subjectName: string; shortName: string };
  sessionTitle?: string;
  section?: string;
  venue?: string;
  startTime: string;
  totalStudents: number;
  attendance: any[];
  sessionStatus?: 'ACTIVE' | 'ENDING' | 'COMPLETED';
  isCustom?: boolean;
  presentCount?: number;
  attendancePercentage?: number;
}

export const Dashboard: React.FC = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [greeting, setGreeting] = useState('');
  const [schedule, setSchedule] = useState<ITimetableItem[]>([]);
  const [recentSessions, setRecentSessions] = useState<IRecentSession[]>([]);
  const [activeSessionsState, setActiveSessionsState] = useState<IRecentSession[]>([]);
  const [loadingSchedule, setLoadingSchedule] = useState(true);
  const [loadingRecent, setLoadingRecent] = useState(true);

  // Statistics State
  const [stats, setStats] = useState({
    sessionsCount: 0,
    presentCount: 0,
    absentCount: 0,
    averagePercentage: 0
  });

  // Calculate dynamic greeting based on local time
  useEffect(() => {
    const hrs = new Date().getHours();
    if (hrs < 12) setGreeting('Good Morning');
    else if (hrs < 17) setGreeting('Good Afternoon');
    else setGreeting('Good Evening');
  }, []);

  // Fetch today's schedule
  const fetchTodaySchedule = async () => {
    setLoadingSchedule(true);
    try {
      const res = await axios.get('/api/faculty/timetable/today');
      if (res.data.success) {
        let slots = res.data.data as ITimetableItem[];
        // Both Admin and Faculty should see only their own schedule
        slots = slots.filter(s => s.facultyId?._id === user?.id);
        // Sort chronologically by startTime (e.g. 09:00 AM)
        slots.sort((a, b) => a.startTime.localeCompare(b.startTime));
        setSchedule(slots);
      }
    } catch (err) {
      console.error('Failed to load today\'s timetable.');
    } finally {
      setLoadingSchedule(false);
    }
  };

  // Fetch recent completed sessions and calculate stats
  const fetchRecentAndStats = async () => {
    setLoadingRecent(true);
    try {
      // Fetch both regular and custom sessions
      const [regRes, custRes] = await Promise.all([
        axios.get('/api/attendance/sessions'),
        axios.get('/api/custom-attendance/sessions')
      ]);

      let allSessions: IRecentSession[] = [];
      if (regRes.data.success) {
        allSessions = [...allSessions, ...regRes.data.data.map((s: any) => ({ ...s, isCustom: false }))];
      }
      if (custRes.data.success) {
        allSessions = [...allSessions, ...custRes.data.data.map((s: any) => ({ 
          ...s, 
          isCustom: true,
          presentCount: s.presentCount !== undefined ? s.presentCount : 0,
          attendancePercentage: s.attendancePercentage !== undefined ? s.attendancePercentage : 0
        }))];
      }

      // Sort chronologically descending (latest first)
      allSessions.sort((a, b) => new Date(b.startTime).getTime() - new Date(a.startTime).getTime());

      // Under "Recent Attendance Sessions", show the completed sessions (sessionStatus === 'COMPLETED')
      const completedSessions = allSessions.filter(s => s.sessionStatus === 'COMPLETED');
      setRecentSessions(completedSessions.slice(0, 5));

      // Under "Active Sessions", show active sessions (sessionStatus !== 'COMPLETED')
      const activeSessions = allSessions.filter(s => s.sessionStatus === 'ACTIVE' || s.sessionStatus === 'ENDING');
      setActiveSessionsState(activeSessions);

      // 2. Filter today's completed sessions to calculate Today's Stats
      const todayStr = new Date().toDateString();
      const todays = completedSessions.filter(s => new Date(s.startTime).toDateString() === todayStr);

      let sessionsCount = todays.length;
      let presentCount = 0;
      let totalRecordsCount = 0;

      todays.forEach(s => {
        if (s.isCustom) {
          totalRecordsCount += s.totalStudents || 0;
          const pres = s.presentCount !== undefined 
            ? s.presentCount 
            : (s.attendance ? s.attendance.filter((r: any) => r.status === 'PRESENT').length : 0);
          presentCount += pres;
        } else {
          const attendanceList = s.attendance || [];
          attendanceList.forEach(record => {
            totalRecordsCount++;
            if (record.status === 'PRESENT') {
              presentCount++;
            }
          });
        }
      });

      let absentCount = totalRecordsCount - presentCount;
      let averagePercentage = totalRecordsCount > 0 ? Math.round((presentCount / totalRecordsCount) * 100) : 0;

      setStats({
        sessionsCount,
        presentCount,
        absentCount,
        averagePercentage
      });
    } catch (err) {
      console.error('Failed to fetch sessions data.');
    } finally {
      setLoadingRecent(false);
    }
  };

  useEffect(() => {
    fetchTodaySchedule();
    fetchRecentAndStats();
  }, [user]);

  // Derive schedule slot status based on time comparisons
  const getSlotStatus = (startTimeStr: string, endTimeStr: string): 'Upcoming' | 'Active' | 'Completed' => {
    const now = new Date();
    const timeToMinutes = (tStr: string) => {
      const [time, modifier] = tStr.split(' ');
      let [hours, minutes] = time.split(':').map(Number);
      if (modifier === 'PM' && hours < 12) hours += 12;
      if (modifier === 'AM' && hours === 12) hours = 0;
      return hours * 60 + minutes;
    };

    const currentMinutes = now.getHours() * 60 + now.getMinutes();
    const startMinutes = timeToMinutes(startTimeStr);
    const endMinutes = timeToMinutes(endTimeStr);

    if (currentMinutes < startMinutes) return 'Upcoming';
    if (currentMinutes > endMinutes) return 'Completed';
    return 'Active';
  };



  const todayFormatted = new Date().toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });

  return (
    <div className="space-y-8 animate-fade-in pb-12">
      
      {/* 1. WELCOME SECTION */}
      <div className="bg-gradient-to-r from-blue-600 to-indigo-700 text-white rounded-2xl p-6 shadow-md relative overflow-hidden">
        <div className="absolute right-0 top-0 opacity-10 translate-x-12 -translate-y-12">
          <Activity className="w-96 h-96" />
        </div>
        <span className="text-xs font-bold bg-white/20 px-3 py-1 rounded-full uppercase tracking-wider select-none">
          PVPSIT ERP PORTAL
        </span>
        <h1 className="text-2xl font-bold font-outfit mt-3">
          {greeting}, {user?.fullName || 'User'}
        </h1>
        <p className="text-sm opacity-80 font-medium mt-1">
          Today is {todayFormatted}
        </p>
      </div>

      {/* 2. QUICK ACTIONS */}
      <div>
        <h3 className="text-xs font-bold text-slate-400 uppercase tracking-wider mb-3">Quick Actions</h3>
        <div className="grid grid-cols-4 gap-6">
          
          <button
            onClick={() => navigate('/regular-attendance')}
            className="bg-white border-2 border-pvpsit-blue/5 hover:border-pvpsit-blue hover:shadow-md rounded-xl p-5 flex flex-col items-start transition-all group text-left"
          >
            <div className="p-3 bg-blue-50 text-pvpsit-blue rounded-lg group-hover:bg-pvpsit-blue group-hover:text-white transition-all">
              <Play className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold text-pvpsit-dark mt-4">Start Regular Attendance</span>
            <span className="text-[10px] font-semibold text-slate-400 mt-1 leading-snug">Begin session from daily timetable slots.</span>
          </button>

          <button
            onClick={() => navigate('/custom-attendance')}
            className="bg-white border-2 border-amber-500/5 hover:border-amber-500 hover:shadow-md rounded-xl p-5 flex flex-col items-start transition-all group text-left"
          >
            <div className="p-3 bg-amber-50 text-amber-600 rounded-lg group-hover:bg-amber-500 group-hover:text-white transition-all">
              <PlusCircle className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold text-pvpsit-dark mt-4">Start Custom Attendance</span>
            <span className="text-[10px] font-semibold text-slate-400 mt-1 leading-snug">Launch attendance for FDP, training or events.</span>
          </button>

          <button
            onClick={() => navigate('/view-attendance')}
            className="bg-white border-2 border-emerald-500/5 hover:border-emerald-500 hover:shadow-md rounded-xl p-5 flex flex-col items-start transition-all group text-left"
          >
            <div className="p-3 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-500 group-hover:text-white transition-all">
              <Eye className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold text-pvpsit-dark mt-4">View Attendance</span>
            <span className="text-[10px] font-semibold text-slate-400 mt-1 leading-snug">Review, audit and edit completed registers.</span>
          </button>

          <button
            onClick={() => navigate('/reports')}
            className="bg-white border-2 border-purple-500/5 hover:border-purple-500 hover:shadow-md rounded-xl p-5 flex flex-col items-start transition-all group text-left"
          >
            <div className="p-3 bg-purple-50 text-purple-600 rounded-lg group-hover:bg-purple-500 group-hover:text-white transition-all">
              <BarChart2 className="w-5 h-5" />
            </div>
            <span className="text-sm font-bold text-pvpsit-dark mt-4">Generate Reports</span>
            <span className="text-[10px] font-semibold text-slate-400 mt-1 leading-snug">Analyze metrics and download spreadsheets.</span>
          </button>

        </div>
      </div>

      {/* Grid container for schedule & stats */}
      <div className="grid grid-cols-3 gap-8">
        
        {/* 3. TODAY'S SCHEDULE (2 Cols) */}
        <div className="col-span-2 bg-white rounded-xl border border-pvpsit-border p-6 shadow-sm flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-pvpsit-blue text-sm flex items-center">
              <Calendar className="w-4 h-4 mr-2" />
              Today's Schedule ({schedule.length} Sessions)
            </h3>
            <span className="text-[10px] font-bold text-slate-400 uppercase">
              My Timetable Slots
            </span>
          </div>

          {loadingSchedule ? (
            <div className="p-12 text-center text-slate-500 flex-1 flex flex-col items-center justify-center">
              <div className="w-8 h-8 border-4 border-pvpsit-blue border-t-transparent rounded-full animate-spin mb-3"></div>
              <span className="text-xs">Fetching daily schedule...</span>
            </div>
          ) : schedule.length === 0 ? (
            <div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-lg flex-1 flex flex-col items-center justify-center">
              <AlertCircle className="w-10 h-10 text-slate-300 mb-2" />
              <p className="text-xs font-semibold">No scheduled sessions for you today.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-50 text-slate-500 border-b border-pvpsit-border">
                  <tr>
                    <th className="py-2.5 px-4 font-semibold">Time</th>
                    <th className="py-2.5 px-4 font-semibold">Subject</th>
                    <th className="py-2.5 px-4 font-semibold">Section</th>
                    <th className="py-2.5 px-4 font-semibold">Laboratory</th>
                    {user?.role === 'ADMIN' && <th className="py-2.5 px-4 font-semibold">Faculty</th>}
                    <th className="py-2.5 px-4 font-semibold text-right">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-pvpsit-border">
                  {schedule.map((item) => {
                    const status = getSlotStatus(item.startTime, item.endTime);
                    return (
                      <tr key={item._id} className="hover:bg-slate-50/40">
                        <td className="py-3 px-4 font-bold text-slate-700 flex items-center">
                          <Clock className="w-3.5 h-3.5 text-slate-400 mr-1.5" />
                          {item.startTime} - {item.endTime}
                        </td>
                        <td className="py-3 px-4 font-semibold text-pvpsit-dark">
                          {item.subjectId?.shortName || 'N/A'} <span className="text-slate-400 font-medium">({item.subjectId?.subjectName || 'No Subject'})</span>
                        </td>
                        <td className="py-3 px-4 font-bold text-slate-600">S{item.section}</td>
                        <td className="py-3 px-4 text-slate-500">
                          {item.laboratoryId ? item.laboratoryId.laboratoryName : 'Theory'}
                        </td>
                        {user?.role === 'ADMIN' && (
                          <td className="py-3 px-4 text-slate-600 font-medium">
                            {item.facultyId?.fullName || 'Unassigned'}
                          </td>
                        )}
                        <td className="py-3 px-4 text-right">
                          <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold uppercase ${
                            status === 'Completed' ? 'bg-slate-100 text-slate-500' :
                            status === 'Active' ? 'bg-green-50 text-pvpsit-success border border-green-200 animate-pulse' :
                            'bg-blue-50 text-pvpsit-blue border border-blue-100'
                          }`}>
                            {status}
                          </span>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* 4. TODAY'S STATISTICS (1 Col) */}
        <div className="bg-white rounded-xl border border-pvpsit-border p-6 shadow-sm flex flex-col justify-between">
          <div>
            <h3 className="font-bold text-pvpsit-blue text-sm flex items-center mb-4">
              <TrendingUp className="w-4 h-4 mr-2" />
              Today's Statistics
            </h3>
            
            <div className="space-y-4">
              <div className="bg-slate-50 p-3 rounded-lg border border-pvpsit-border flex justify-between items-center">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Sessions Conducted</div>
                  <div className="text-lg font-bold text-pvpsit-dark mt-0.5">{stats.sessionsCount}</div>
                </div>
                <CheckCircle className="w-5 h-5 text-pvpsit-blue opacity-55" />
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-pvpsit-border flex justify-between items-center">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Present Students</div>
                  <div className="text-lg font-bold text-pvpsit-success mt-0.5">{stats.presentCount}</div>
                </div>
                <Users className="w-5 h-5 text-pvpsit-success opacity-55" />
              </div>

              <div className="bg-slate-50 p-3 rounded-lg border border-pvpsit-border flex justify-between items-center">
                <div>
                  <div className="text-[10px] font-bold text-slate-400 uppercase">Absent Students</div>
                  <div className="text-lg font-bold text-pvpsit-danger mt-0.5">{stats.absentCount}</div>
                </div>
                <AlertCircle className="w-5 h-5 text-pvpsit-danger opacity-55" />
              </div>
            </div>
          </div>

          <div className="border-t border-pvpsit-border pt-4 mt-4">
            <div className="flex justify-between items-center">
              <div>
                <span className="text-[9px] font-bold text-slate-400 uppercase">Avg Attendance Rate</span>
                <div className="text-2xl font-black text-pvpsit-blue mt-0.5">{stats.averagePercentage}%</div>
              </div>
              <div className="w-12 h-12 rounded-full border-4 border-pvpsit-blue/20 border-t-pvpsit-blue flex items-center justify-center font-bold text-[10px] text-pvpsit-blue animate-spin-slow">
                %
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Grid container for recent sessions & activities */}
      <div className="grid grid-cols-3 gap-8">
        
        {/* 5. RECENT SESSIONS (2 Cols) */}
        <div className="col-span-2 bg-white rounded-xl border border-pvpsit-border p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-bold text-pvpsit-blue text-sm">Recent Attendance Sessions</h3>
            <button 
              onClick={() => navigate('/view-attendance')}
              className="text-xs font-bold text-pvpsit-blue hover:text-blue-700 flex items-center"
            >
              View Archive
              <ArrowRight className="w-3.5 h-3.5 ml-1" />
            </button>
          </div>

          {loadingRecent ? (
            <div className="p-12 text-center text-slate-500">
              <div className="w-8 h-8 border-4 border-pvpsit-blue border-t-transparent rounded-full animate-spin mx-auto mb-3"></div>
              <span className="text-xs">Loading sessions...</span>
            </div>
          ) : recentSessions.length === 0 ? (
            <div className="p-12 text-center text-slate-400 border-2 border-dashed border-slate-100 rounded-lg">
              <AlertCircle className="w-10 h-10 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-semibold">No recent sessions found.</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {recentSessions.map((session) => {
                const present = session.isCustom
                  ? (session.presentCount !== undefined ? session.presentCount : (session.attendance ? session.attendance.filter((r: any) => r.status === 'PRESENT').length : 0))
                  : (session.attendance ? session.attendance.filter((r: any) => r.status === 'PRESENT').length : 0);
                const pct = session.isCustom && session.attendancePercentage !== undefined
                  ? Math.round(session.attendancePercentage)
                  : (session.totalStudents > 0 ? Math.round((present / session.totalStudents) * 100) : 0);
                
                const timeStr = new Date(session.startTime).toLocaleTimeString('en-US', {
                  hour: '2-digit',
                  minute: '2-digit',
                  hour12: true
                });
                const dateStr = new Date(session.startTime).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric'
                });

                const isCustom = session.isCustom;

                return (
                  <div 
                    key={session._id}
                    onClick={() => navigate(`/view-attendance?sessionId=${session._id}&type=${isCustom ? 'custom' : 'regular'}`)}
                    className="p-4 border border-pvpsit-border hover:border-pvpsit-blue hover:shadow-sm rounded-xl cursor-pointer transition-all flex items-center justify-between"
                  >
                    <div className="space-y-1">
                      <div className="flex items-center space-x-2">
                        <span className="text-[9px] font-bold bg-slate-100 text-slate-500 px-2 py-0.5 rounded uppercase">
                          Code: {session.sessionCode}
                        </span>
                        {isCustom && (
                          <span className="text-[8px] font-bold bg-orange-50 text-orange-600 px-1.5 py-0.5 rounded uppercase border border-orange-100">
                            Custom
                          </span>
                        )}
                      </div>
                      <h4 className="text-sm font-bold text-pvpsit-dark">
                        {isCustom ? session.sessionTitle : `${session.subjectId?.shortName || 'N/A'} - ${session.subjectId?.subjectName || 'No Subject'}`}
                      </h4>
                      <div className="flex items-center space-x-3 text-[11px] text-slate-500 font-semibold">
                        <span>{isCustom ? `Venue: ${session.venue}` : `Sec ${session.section}`}</span>
                        <span>•</span>
                        <span>{dateStr} | {timeStr}</span>
                        <span>•</span>
                        <span>Total: {session.totalStudents} Students</span>
                      </div>
                    </div>

                    <div className="text-right space-y-1">
                      <span className="text-sm font-black text-pvpsit-blue">{pct}%</span>
                      <div className="text-[9px] text-slate-400 font-bold uppercase">Rate</div>
                      <div className="w-24 bg-slate-100 h-1.5 rounded-full overflow-hidden">
                        <div 
                          className="bg-pvpsit-blue h-full rounded-full" 
                          style={{ width: `${pct}%` }}
                        ></div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 6. ACTIVE SESSIONS (1 Col) */}
        <div className="bg-white rounded-xl border border-pvpsit-border p-6 shadow-sm flex flex-col min-h-[300px]">
          <h3 className="font-bold text-pvpsit-blue text-sm flex items-center mb-4 border-b border-pvpsit-border pb-3">
            <Activity className="w-4 h-4 mr-2 animate-pulse text-pvpsit-danger" />
            Active Sessions
          </h3>

          <div className="space-y-4 flex-1 overflow-y-auto max-h-[360px] pr-1">
            {activeSessionsState.length === 0 ? (
              <div className="text-center py-12 text-slate-400 font-semibold border-2 border-dashed border-slate-100 rounded-lg flex flex-col justify-center items-center h-full min-h-[200px]">
                <Clock className="w-8 h-8 text-slate-300 mb-2 animate-pulse" />
                <p className="text-xs">No active sessions running.</p>
              </div>
            ) : (
              activeSessionsState.map((act) => {
                const isCustom = act.isCustom;
                const timeStr = new Date(act.startTime).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
                
                return (
                  <div key={act._id} className="p-4 bg-slate-50 border border-pvpsit-border rounded-xl space-y-2 relative overflow-hidden">
                    <div className="flex justify-between items-start">
                      <span className={`text-[8px] font-bold px-1.5 py-0.5 rounded uppercase ${
                        isCustom ? 'bg-orange-50 text-orange-600 border border-orange-100' : 'bg-green-50 text-pvpsit-success border border-green-100'
                      }`}>
                        {isCustom ? 'Custom' : 'Regular'}
                      </span>
                      <span className="text-[10px] text-slate-400 font-bold">{timeStr}</span>
                    </div>

                    <h4 className="text-xs font-black text-pvpsit-dark line-clamp-1">
                      {isCustom ? act.sessionTitle : `${act.subjectId?.shortName || 'N/A'} - ${act.subjectId?.subjectName || 'No Subject'}`}
                    </h4>

                    <div className="text-[10px] text-slate-500 font-semibold flex justify-between items-center pt-1.5">
                      <span>{isCustom ? `Venue: ${act.venue}` : `Sec: S${act.section}`}</span>
                      <button
                        onClick={() => navigate(isCustom ? '/custom-attendance' : '/regular-attendance')}
                        className="px-2.5 py-1 bg-pvpsit-blue hover:bg-blue-700 text-white rounded text-[10px] font-bold transition-all"
                      >
                        Resume
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

      </div>

    </div>
  );
};
