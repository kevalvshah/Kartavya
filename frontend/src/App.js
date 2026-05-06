/**
 * App.js — Kartavya v2 entry point.
 * All logic lives in pages/ and components/layout/.
 * This file is ONLY imports + router.
 */
import React from 'react';
import { BrowserRouter, Routes, Route, Navigate, useOutletContext } from 'react-router-dom';
import './App.css';
import './lib/tokens.css';
import './styles/layout.css';
import './styles/modern-components.css';
import './styles/dark-theme.css';
import './styles/animations.css';
import './styles/mobile-responsive.css';
import { ToastProvider } from './components/ui/toast';

// Layout
import AppShell, { Protected }  from './components/layout/AppShell';

// Auth pages
import { LoginPage, AcceptInvitePage } from './pages/LoginPage';

// Core pages (already split into their own files)
import V2DashboardPage  from './pages/DashboardPage';
import ActivityFeedPage from './pages/ActivityFeedPage';
import AutomationsPage  from './pages/AutomationsPage';
import TimeReportPage   from './pages/TimeReportPage';
import ProjectBoardPageV2 from './pages/ProjectBoardPage';
import TeamsPage        from './pages/TeamsPage';
import NotificationsSettingsPage from './pages/NotificationsSettingsPage';
import AdminPage        from './pages/AdminPage';
import ApprovalsPage    from './pages/ApprovalsPage';
import { ProjectsPage, TasksListPage, CategoriesPage } from './pages/ProjectsPage';
import { ClientProjectsPage, ClientProjectBoardPage, ClientPortal } from './pages/ClientPages';

// ── Context wrappers (pass outlet context into v2 pages) ──────────────────────
function ActivityFeedWrapper() {
  const { teamId } = useOutletContext();
  return <ActivityFeedPage teamId={teamId} />;
}
function AutomationsWrapper() {
  const { teamId } = useOutletContext();
  return <AutomationsPage teamId={teamId} />;
}
function DashboardWrapper() {
  const { teams } = useOutletContext();
  return <V2DashboardPage teams={teams} />;
}

// ── Router ────────────────────────────────────────────────────────────────────
function AppRouter() {
  return (
    <Routes>
      <Route path="/login"          element={<LoginPage />} />
      <Route path="/accept-invite"  element={<AcceptInvitePage />} />
      <Route path="/" element={<Protected><AppShell /></Protected>}>
        <Route index                          element={<Navigate to="/dashboard" replace />} />
        <Route path="dashboard"               element={<DashboardWrapper />} />
        <Route path="projects"                element={<ProjectsPage />} />
        <Route path="projects/:projectId"     element={<ProjectBoardPageV2 />} />
        <Route path="tasks"                   element={<TasksListPage />} />
        <Route path="teams"                   element={<TeamsPage />} />
        <Route path="activity"                element={<ActivityFeedWrapper />} />
        <Route path="automations"             element={<AutomationsWrapper />} />
        <Route path="time"                    element={<TimeReportPage />} />
        <Route path="approvals"               element={<ApprovalsPage />} />
        <Route path="settings/categories"     element={<CategoriesPage />} />
        <Route path="settings/notifications"  element={<NotificationsSettingsPage />} />
        <Route path="admin"                   element={<AdminPage />} />
        <Route path="client"                  element={<ClientProjectsPage />} />
        <Route path="client/projects"         element={<ClientProjectsPage />} />
        <Route path="client/project/:projectId" element={<ClientProjectBoardPage />} />
      </Route>
      <Route path="/client/legacy" element={<Protected><ClientPortal /></Protected>} />
      <Route path="*"              element={<Navigate to="/dashboard" replace />} />
    </Routes>
  );
}

function App() {
  return (
    <ToastProvider>
      <BrowserRouter>
        <AppRouter />
      </BrowserRouter>
    </ToastProvider>
  );
}

export default App;
