/**
 * App.js — Kartavya v2 entry point.
 * Week 3: Templates route added to sidebar + lazy import.
 */
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate, useOutletContext } from 'react-router-dom';
import './App.css';
import './lib/tokens.css';
import './styles/layout.css';
import './styles/modern-components.css';
import './styles/dark-theme.css';
import './styles/animations.css';
import './styles/mobile-responsive.css';
import { ToastProvider } from './components/ui/toast';
import AppShell, { Protected } from './components/layout/AppShell';
import { LoginPage, AcceptInvitePage } from './pages/LoginPage';

// ── Lazy pages ──────────────────────────────────────────────────────────────────
const DashboardPage         = lazy(() => import('./pages/DashboardPage'));
const ProjectsPage          = lazy(() => import('./pages/ProjectsPage'));
const ProjectBoardPage      = lazy(() => import('./pages/ProjectBoardPage'));
const TasksListPage         = lazy(() => import('./pages/TasksListPage'));
const TeamsPage             = lazy(() => import('./pages/TeamsPage'));
const ActivityFeedPage      = lazy(() => import('./pages/ActivityFeedPage'));
const AutomationsPage       = lazy(() => import('./pages/AutomationsPage'));
const TimeReportPage        = lazy(() => import('./pages/TimeReportPage'));
const ApprovalsPage         = lazy(() => import('./pages/ApprovalsPage'));
const TemplatesPage         = lazy(() => import('./pages/TemplatesPage'));   // Week 3
const CategoriesPage        = lazy(() => import('./pages/CategoriesPage'));
const NotificationsSettings = lazy(() => import('./pages/NotificationsSettingsPage'));
const AdminPage             = lazy(() => import('./pages/AdminPage'));
const ClientProjectsPage    = lazy(() => import('./pages/ClientProjectsPage'));
const ClientBoardPage       = lazy(() => import('./pages/ClientBoardPage'));
const ClientPortal          = lazy(() => import('./pages/ClientPortal'));

// ── Suspense fallback ───────────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div style={{ display:'flex', alignItems:'center', justifyContent:'center', minHeight:'60vh', color:'var(--text-muted)', fontSize: 13, fontFamily:"'Inter',sans-serif" }}>
      <span style={{ opacity: 0.5 }}>Loading…</span>
    </div>
  );
}

// ── Outlet context wrappers ────────────────────────────────────────────────────
function DashboardWrapper()   { const { teams  } = useOutletContext(); return <DashboardPage  teams={teams} />; }
function ActivityWrapper()    { const { teamId } = useOutletContext(); return <ActivityFeedPage teamId={teamId} />; }
function AutomationsWrapper() { const { teamId } = useOutletContext(); return <AutomationsPage  teamId={teamId} />; }
function TimeWrapper()        { const { teamId } = useOutletContext(); return <TimeReportPage   teamId={teamId} />; }

// ── Route tree ────────────────────────────────────────────────────────────────────
function AppRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login"         element={<LoginPage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />

        <Route path="/" element={<Protected><AppShell /></Protected>}>
          <Route index                             element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"                  element={<DashboardWrapper />} />
          <Route path="projects"                   element={<ProjectsPage />} />
          <Route path="projects/:projectId"        element={<ProjectBoardPage />} />
          <Route path="tasks"                      element={<TasksListPage />} />
          <Route path="teams"                      element={<TeamsPage />} />
          <Route path="activity"                   element={<ActivityWrapper />} />
          <Route path="automations"                element={<AutomationsWrapper />} />
          <Route path="time"                       element={<TimeWrapper />} />
          <Route path="templates"                  element={<TemplatesPage />} />
          <Route path="approvals"                  element={<ApprovalsPage />} />
          <Route path="settings/categories"        element={<CategoriesPage />} />
          <Route path="settings/notifications"     element={<NotificationsSettings />} />
          <Route path="admin"                      element={<AdminPage />} />
          <Route path="client"                     element={<ClientProjectsPage />} />
          <Route path="client/projects"            element={<ClientProjectsPage />} />
          <Route path="client/project/:projectId" element={<ClientBoardPage />} />
        </Route>

        <Route path="/client/legacy" element={<Protected><ClientPortal /></Protected>} />
        <Route path="*"              element={<Navigate to="/dashboard" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </ToastProvider>
  );
}
