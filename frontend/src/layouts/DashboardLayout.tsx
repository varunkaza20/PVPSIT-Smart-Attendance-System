import { Footer } from '../components/Footer';
import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation, Link } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import {
  Calendar,
  Users,
  BookOpen,
  ClipboardList,
  Sliders,
  LogOut,
  Clock,
  Building,
  UserCheck,
  Menu,
  ChevronLeft,
  LayoutDashboard,
  Eye
} from 'lucide-react';

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  
  // Collapse state for sidebar
  const [isCollapsed, setIsCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem('sidebar_collapsed');
    return saved === 'true';
  });

  // State for live clock
  const [time, setTime] = useState<Date>(new Date());

  useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const toggleSidebar = () => {
    setIsCollapsed(prev => {
      const next = !prev;
      localStorage.setItem('sidebar_collapsed', String(next));
      return next;
    });
  };

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  // Build breadcrumbs dynamically based on path
  const getBreadcrumb = () => {
    const path = location.pathname;
    if (path.includes('/dashboard')) return 'Dashboard';
    if (path.includes('/regular-attendance')) return 'Regular Attendance';
    if (path.includes('/custom-attendance')) return 'Custom Attendance';
    if (path.includes('/view-attendance')) return 'View Attendance';
    if (path.includes('/reports')) return 'Reports';
    if (path.includes('/settings')) return 'Settings';
    if (path.includes('/admin/faculty')) return 'Faculty Management';
    if (path.includes('/admin/students')) return 'Student Management';
    if (path.includes('/admin/subjects')) return 'Subject Management';
    if (path.includes('/admin/timetable')) return 'Timetable Management';
    return 'Dashboard';
  };

  const formattedDate = time.toLocaleDateString('en-US', {
    weekday: 'short',
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });

  const formattedTime = time.toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: true
  });

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-pvpsit-bg">
      
      {/* SIDEBAR */}
      <aside 
        className={`h-full bg-pvpsit-card flex flex-col border-r border-pvpsit-border transition-all duration-300 ${
          isCollapsed ? 'w-[72px]' : 'w-[280px]'
        }`}
      >
        {/* LOGO AREA */}
        <div className={`border-b border-pvpsit-border flex flex-col items-center justify-center transition-all ${
          isCollapsed ? 'p-4 h-[120px]' : 'p-6 h-[150px]'
        }`}>
          <img 
            src="/pvpsit_logo.png" 
            alt="PVPSIT Logo" 
            className={`object-contain transition-all ${
              isCollapsed ? 'w-10 h-10' : 'w-16 h-16 mb-2'
            }`} 
          />
          {!isCollapsed && (
            <>
              <span className="text-base font-bold text-pvpsit-blue text-center">PVPSIT</span>
              <span className="text-[10px] font-bold text-pvpsit-dark text-center tracking-wide uppercase mt-0.5">
                Smart Attendance
              </span>
            </>
          )}
        </div>

        {/* NAVIGATION LINKS */}
        <nav className="flex-1 px-3 py-6 space-y-1 overflow-y-auto">
          
          {/* Main Navigation Group */}
          {!isCollapsed && (
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
              Menu
            </div>
          )}

          <Link
            to="/dashboard"
            title={isCollapsed ? "Dashboard" : ""}
            className={`flex items-center py-2.5 text-xs font-semibold rounded-lg transition-all ${
              isCollapsed ? 'justify-center px-0' : 'px-3'
            } ${
              location.pathname === '/dashboard'
                ? 'bg-pvpsit-blue text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <LayoutDashboard className={`w-5 h-5 shrink-0 ${isCollapsed ? 'mr-0' : 'mr-3'}`} />
            {!isCollapsed && <span>Dashboard</span>}
          </Link>

          <Link
            to="/regular-attendance"
            title={isCollapsed ? "Regular Attendance" : ""}
            className={`flex items-center py-2.5 text-xs font-semibold rounded-lg transition-all ${
              isCollapsed ? 'justify-center px-0' : 'px-3'
            } ${
              location.pathname === '/regular-attendance'
                ? 'bg-pvpsit-blue text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Calendar className={`w-5 h-5 shrink-0 ${isCollapsed ? 'mr-0' : 'mr-3'}`} />
            {!isCollapsed && <span>Regular Attendance</span>}
          </Link>

          <Link
            to="/custom-attendance"
            title={isCollapsed ? "Custom Attendance" : ""}
            className={`flex items-center py-2.5 text-xs font-semibold rounded-lg transition-all ${
              isCollapsed ? 'justify-center px-0' : 'px-3'
                } ${
              location.pathname === '/custom-attendance'
                ? 'bg-pvpsit-blue text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Building className={`w-5 h-5 shrink-0 ${isCollapsed ? 'mr-0' : 'mr-3'}`} />
            {!isCollapsed && <span>Custom Attendance</span>}
          </Link>

          <Link
            to="/view-attendance"
            title={isCollapsed ? "View Attendance" : ""}
            className={`flex items-center py-2.5 text-xs font-semibold rounded-lg transition-all ${
              isCollapsed ? 'justify-center px-0' : 'px-3'
            } ${
              location.pathname === '/view-attendance'
                ? 'bg-pvpsit-blue text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Eye className={`w-5 h-5 shrink-0 ${isCollapsed ? 'mr-0' : 'mr-3'}`} />
            {!isCollapsed && <span>View Attendance</span>}
          </Link>

          <Link
            to="/reports"
            title={isCollapsed ? "Reports" : ""}
            className={`flex items-center py-2.5 text-xs font-semibold rounded-lg transition-all ${
              isCollapsed ? 'justify-center px-0' : 'px-3'
            } ${
              location.pathname === '/reports'
                ? 'bg-pvpsit-blue text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <ClipboardList className={`w-5 h-5 shrink-0 ${isCollapsed ? 'mr-0' : 'mr-3'}`} />
            {!isCollapsed && <span>Reports</span>}
          </Link>

          {/* Admin Specific Links */}
          {user?.role === 'ADMIN' && (
            <>
              <div className="border-t border-slate-100 my-4"></div>
              {!isCollapsed && (
                <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider px-3 mb-2">
                  Master Administration
                </div>
              )}
              
              <Link
                to="/admin/faculty"
                title={isCollapsed ? "Faculty Management" : ""}
                className={`flex items-center py-2.5 text-xs font-semibold rounded-lg transition-all ${
                  isCollapsed ? 'justify-center px-0' : 'px-3'
                } ${
                  location.pathname === '/admin/faculty'
                    ? 'bg-pvpsit-blue text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <UserCheck className={`w-5 h-5 shrink-0 ${isCollapsed ? 'mr-0' : 'mr-3'}`} />
                {!isCollapsed && <span>Faculty Management</span>}
              </Link>

              <Link
                to="/admin/students"
                title={isCollapsed ? "Student Management" : ""}
                className={`flex items-center py-2.5 text-xs font-semibold rounded-lg transition-all ${
                  isCollapsed ? 'justify-center px-0' : 'px-3'
                } ${
                  location.pathname === '/admin/students'
                    ? 'bg-pvpsit-blue text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Users className={`w-5 h-5 shrink-0 ${isCollapsed ? 'mr-0' : 'mr-3'}`} />
                {!isCollapsed && <span>Student Management</span>}
              </Link>

              <Link
                to="/admin/subjects"
                title={isCollapsed ? "Subject Management" : ""}
                className={`flex items-center py-2.5 text-xs font-semibold rounded-lg transition-all ${
                  isCollapsed ? 'justify-center px-0' : 'px-3'
                } ${
                  location.pathname === '/admin/subjects'
                    ? 'bg-pvpsit-blue text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <BookOpen className={`w-5 h-5 shrink-0 ${isCollapsed ? 'mr-0' : 'mr-3'}`} />
                {!isCollapsed && <span>Subject Management</span>}
              </Link>

              <Link
                to="/admin/timetable"
                title={isCollapsed ? "Timetable Management" : ""}
                className={`flex items-center py-2.5 text-xs font-semibold rounded-lg transition-all ${
                  isCollapsed ? 'justify-center px-0' : 'px-3'
                } ${
                  location.pathname === '/admin/timetable'
                    ? 'bg-pvpsit-blue text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Calendar className={`w-5 h-5 shrink-0 ${isCollapsed ? 'mr-0' : 'mr-3'}`} />
                {!isCollapsed && <span>Timetable Management</span>}
              </Link>

              <Link
                to="/settings"
                title={isCollapsed ? "Settings" : ""}
                className={`flex items-center py-2.5 text-xs font-semibold rounded-lg transition-all ${
                  isCollapsed ? 'justify-center px-0' : 'px-3'
                } ${
                  location.pathname === '/settings'
                    ? 'bg-pvpsit-blue text-white'
                    : 'text-slate-600 hover:bg-slate-100'
                }`}
              >
                <Sliders className={`w-5 h-5 shrink-0 ${isCollapsed ? 'mr-0' : 'mr-3'}`} />
                {!isCollapsed && <span>Settings</span>}
              </Link>
            </>
          )}
        </nav>

        {/* BOTTOM USER LOGOUT AREA */}
        <div className={`border-t border-pvpsit-border bg-slate-50 transition-all ${
          isCollapsed ? 'p-2 flex flex-col items-center space-y-4 py-4' : 'p-4'
        }`}>
          <div className="flex items-center w-full">
            <div 
              className="w-10 h-10 bg-slate-200 text-slate-700 rounded-full flex items-center justify-center font-bold text-sm shrink-0"
              title={isCollapsed ? `${user?.fullName} (${user?.employeeId})` : ""}
            >
              {user?.fullName?.slice(0, 2).toUpperCase() || 'U'}
            </div>
            {!isCollapsed && (
              <div className="ml-3 overflow-hidden">
                <div className="text-sm font-bold text-pvpsit-dark truncate">{user?.fullName}</div>
                <div className="text-[10px] font-bold text-slate-500 truncate">{user?.employeeId} ({user?.role})</div>
              </div>
            )}
          </div>
          
          {isCollapsed ? (
            <button
              onClick={handleLogout}
              title="Logout"
              className="p-2 border border-slate-200 text-slate-600 bg-white hover:bg-slate-100 hover:text-pvpsit-danger hover:border-pvpsit-danger transition-colors rounded-lg flex items-center justify-center"
            >
              <LogOut className="w-4 h-4" />
            </button>
          ) : (
            <button
              onClick={handleLogout}
              className="w-full flex items-center justify-center px-4 py-2 border border-slate-200 text-sm font-medium rounded-lg text-slate-700 bg-white hover:bg-slate-100 hover:text-pvpsit-danger hover:border-pvpsit-danger transition-colors"
            >
              <LogOut className="w-4 h-4 mr-2" />
              Logout
            </button>
          )}
        </div>
      </aside>

      {/* HEADER & MAIN VIEWPORT */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* HEADER */}
        <header className="h-[72px] bg-pvpsit-card border-b border-pvpsit-border flex items-center justify-between px-6 shrink-0">
          
          {/* Left: Collapsed toggle + Breadcrumb */}
          <div className="flex items-center space-x-4">
            <button
              onClick={toggleSidebar}
              className="p-2 hover:bg-slate-100 rounded-lg border border-slate-200/60 transition-colors text-slate-600 flex items-center justify-center"
              title={isCollapsed ? "Expand Sidebar" : "Collapse Sidebar"}
            >
              {isCollapsed ? <Menu className="w-4 h-4" /> : <ChevronLeft className="w-4 h-4" />}
            </button>
            <div className="flex items-center space-x-2 text-sm text-slate-500">
              <span className="font-semibold text-pvpsit-blue">{getBreadcrumb()}</span>
            </div>
          </div>

          {/* Right: page actions (e.g. End Session) + Clock Widget */}
          <div className="flex items-center space-x-3">
          <div id="header-actions" className="flex items-center" />
          <div className="flex items-center space-x-4 bg-slate-50 px-4 py-2 rounded-lg border border-pvpsit-border">
            <Clock className="w-4 h-4 text-pvpsit-blue" />
            <span className="text-xs text-slate-600 font-medium">
              {formattedDate} | {formattedTime}
            </span>
          </div>
          </div>
        </header>

        {/* MAIN VIEWPORT BODY */}
        <main className="flex-1 overflow-auto p-8" style={{ scrollbarGutter: 'stable' }}>
          {children}
        </main>
        <Footer />
      </div>
    </div>
  );
};
