import React, { useEffect } from 'react';
import { HashRouter, Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { useAuthStore } from './store/authStore';
import { useSettingsStore } from './store/settingsStore';
import { UserRole } from '@shared/types';

// Components
import { Sidebar } from './components/Sidebar';
import { StatusBar } from './components/StatusBar';
import { NotificationContainer } from './components/NotificationToast';

// Pages
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { DashboardPage } from './pages/DashboardPage';
import { SettingsPage } from './pages/SettingsPage';
import { ManagerDashboard } from './pages/ManagerDashboard';
import { TeamManagement } from './pages/TeamManagement';
import { ProjectsPage } from './pages/ProjectsPage';
import { ProjectDetail } from './pages/ProjectDetail';
import { TimesheetsPage } from './pages/TimesheetsPage';
import { AttendancePage } from './pages/AttendancePage';
import { DepartmentsPage } from './pages/DepartmentsPage';
import { ReportsPage } from './pages/ReportsPage';
import { NotificationsPage } from './pages/NotificationsPage';
import { ScreenshotsPage } from './pages/ScreenshotsPage';
import { ClientPortal } from './pages/ClientPortal';
import { AcceptInvitePage } from './pages/AcceptInvitePage';

const MANAGER_ABOVE_ROLES: UserRole[] = ['OWNER', 'ADMIN', 'MANAGER'];
const STAFF_ROLES: UserRole[] = ['OWNER', 'ADMIN', 'MANAGER', 'EMPLOYEE'];

/** The landing route for a given role. */
function roleHome(role?: UserRole): string {
  if (role === 'CLIENT') return '/client-portal';
  if (role === 'EMPLOYEE') return '/dashboard';
  return '/';
}

/** Redirects to /login if not authenticated */
function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { isAuthenticated } = useAuthStore();
  const location = useLocation();
  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }
  return <>{children}</>;
}

/** Allows only the listed roles; sends everyone else to their own home. */
function RequireRoles({ allow, children }: { allow: UserRole[]; children: React.ReactNode }) {
  const { user } = useAuthStore();
  if (!user || !allow.includes(user.role)) {
    return <Navigate to={roleHome(user?.role)} replace />;
  }
  return <>{children}</>;
}

/** Manager-or-above only. */
function ManagerRoute({ children }: { children: React.ReactNode }) {
  return <RequireRoles allow={MANAGER_ABOVE_ROLES}>{children}</RequireRoles>;
}

/** Internal staff only (blocks external CLIENT users). */
function StaffRoute({ children }: { children: React.ReactNode }) {
  return <RequireRoles allow={STAFF_ROLES}>{children}</RequireRoles>;
}

/** Client-only (the read-only project portal). */
function ClientRoute({ children }: { children: React.ReactNode }) {
  return <RequireRoles allow={['CLIENT']}>{children}</RequireRoles>;
}

/** Sends the user to the home route appropriate for their role. */
function HomeRedirect() {
  const { user } = useAuthStore();
  return <Navigate to={roleHome(user?.role)} replace />;
}

/**
 * Main Layout Shell — Sidebar + Mac drag region + StatusBar
 * The sidebar adapts its nav links based on the user's role.
 */
function AppShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden mesh-bg">
      {/* Mac Drag Region */}
      <div className="absolute top-0 left-0 right-0 h-10 drag-region z-50 pointer-events-none" />

      {/* Sidebar */}
      <div className="no-drag h-full z-40 relative">
        <Sidebar />
      </div>

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 no-drag relative">
        {navigator.userAgent.includes('Mac') && <div className="h-10 shrink-0" />}

        <main className="flex-1 flex flex-col overflow-hidden overflow-y-auto">
          {children}
        </main>

        <StatusBar />
      </div>

      <NotificationContainer />
    </div>
  );
}

export function App() {
  const { setAuthState } = useAuthStore();
  const { settings, loadSettings } = useSettingsStore();
  const [isInitializing, setIsInitializing] = React.useState(true);

  useEffect(() => {
    async function init() {
      try {
        await loadSettings();
        const authRes = await window.worktrack.auth.getState();
        if (authRes.success && authRes.data) {
          setAuthState(authRes.data);
        }
      } catch (err) {
        console.error('Initialization failed:', err);
      } finally {
        setIsInitializing(false);
      }
    }
    init();

    const unsubAuth = window.worktrack.auth.onStateChanged((state) => {
      setAuthState(state);
    });

    return () => unsubAuth();
  }, []);

  useEffect(() => {
    const root = document.documentElement;
    const applyDark = () => { root.classList.add('dark'); root.classList.remove('light'); };
    const applyLight = () => { root.classList.add('light'); root.classList.remove('dark'); };

    if (settings.theme === 'dark') {
      applyDark();
    } else if (settings.theme === 'light') {
      applyLight();
    } else if (window.matchMedia('(prefers-color-scheme: dark)').matches) {
      applyDark();
    } else {
      applyLight();
    }
  }, [settings.theme]);

  if (isInitializing) {
    return (
      <div className="h-screen w-full flex items-center justify-center bg-background">
        <div className="w-16 h-16 rounded-2xl bg-primary/20 flex items-center justify-center animate-pulse">
          <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <HashRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <Routes>
        {/* Public routes */}
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />

        {/* Protected routes */}
        <Route
          path="/*"
          element={
            <ProtectedRoute>
              <AppShell>
                <Routes>
                  {/* Manager-only routes */}
                  <Route path="/" element={
                    <ManagerRoute>
                      <ManagerDashboard />
                    </ManagerRoute>
                  } />
                  <Route path="/team" element={
                    <ManagerRoute>
                      <TeamManagement />
                    </ManagerRoute>
                  } />
                  <Route path="/attendance" element={
                    <ManagerRoute>
                      <AttendancePage />
                    </ManagerRoute>
                  } />
                  <Route path="/departments" element={
                    <ManagerRoute>
                      <DepartmentsPage />
                    </ManagerRoute>
                  } />
                  <Route path="/reports" element={
                    <ManagerRoute>
                      <ReportsPage />
                    </ManagerRoute>
                  } />

                  {/* Client-only portal */}
                  <Route path="/client-portal" element={
                    <ClientRoute>
                      <ClientPortal />
                    </ClientRoute>
                  } />

                  {/* Staff routes (blocked for external clients) */}
                  <Route path="/projects" element={<StaffRoute><ProjectsPage /></StaffRoute>} />
                  <Route path="/projects/:id" element={<StaffRoute><ProjectDetail /></StaffRoute>} />
                  <Route path="/timesheets" element={<StaffRoute><TimesheetsPage /></StaffRoute>} />
                  <Route path="/dashboard" element={<StaffRoute><DashboardPage /></StaffRoute>} />

                  {/* Available to every authenticated role */}
                  <Route path="/screenshots" element={<ScreenshotsPage />} />
                  <Route path="/notifications" element={<NotificationsPage />} />
                  <Route path="/settings" element={<SettingsPage />} />
                  <Route path="*" element={<HomeRedirect />} />
                </Routes>
              </AppShell>
            </ProtectedRoute>
          }
        />
      </Routes>
    </HashRouter>
  );
}
