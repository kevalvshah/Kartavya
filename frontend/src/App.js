/**
 * App.js — Kartavya v1 (main branch) entry point.
 *
 * Route-level code splitting via React.lazy + Suspense:
 *   - Every page chunk downloads only when first visited.
 *   - Initial bundle = shell + auth + routing only (~15 KB).
 *
 * Heavy pages (ProjectBoardPage, TaskEditor, AdminPage) are fully lazy.
 * Brand tokens, auth helpers, layout components live in lib/ and components/layout/.
 */
import React, { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import './App.css';
import './styles/layout.css';
import './styles/modern-components.css';
import './styles/dark-theme.css';
import './styles/animations.css';
import './styles/mobile-responsive.css';
import { ToastProvider } from './components/ui/toast';

// ── Eagerly loaded (shell + auth — always needed) ─────────────────────────────
import AppShell             from './components/layout/AppShell';
import Protected            from './components/layout/Protected';
import { LoginPage, AcceptInvitePage } from './pages/LoginPage';

// ── Lazy pages (one chunk per route) ─────────────────────────────────────────
const DashboardPage         = lazy(() => import('./pages/DashboardPage'));
const ProjectsPage          = lazy(() => import('./pages/ProjectsPage'));
const ProjectBoardPage      = lazy(() => import('./pages/ProjectBoardPage'));
const TasksListPage         = lazy(() => import('./pages/TasksListPage'));
const CategoriesPage        = lazy(() => import('./pages/CategoriesPage'));
const ApprovalsPage         = lazy(() => import('./pages/ApprovalsPage'));
const TeamsPage             = lazy(() => import('./pages/TeamsPage'));
const AdminPage             = lazy(() => import('./pages/AdminPage'));
const NotificationsSettings = lazy(() => import('./pages/NotificationsSettingsPage'));
const ClientProjectsPage    = lazy(() => import('./pages/ClientProjectsPage'));
const ClientBoardPage       = lazy(() => import('./pages/ClientBoardPage'));
const ClientPortalPage      = lazy(() => import('./pages/ClientPortalPage'));

// ── Suspense fallback ─────────────────────────────────────────────────────────
function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', minHeight: '60vh', color: 'var(--color-muted-foreground)', fontSize: 13, fontFamily: "'Nunito',sans-serif" }}>
      <span style={{ opacity: 0.5 }}>Loading…</span>
    </div>
  );
}

// ── Router ────────────────────────────────────────────────────────────────────
function AppRouter() {
  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        <Route path="/login"         element={<LoginPage />} />
        <Route path="/accept-invite" element={<AcceptInvitePage />} />

        <Route path="/" element={<Protected><AppShell /></Protected>}>
          <Route index                             element={<Navigate to="/dashboard" replace />} />
          <Route path="dashboard"                  element={<DashboardPage />} />
          <Route path="projects"                   element={<ProjectsPage />} />
          <Route path="projects/:projectId"        element={<ProjectBoardPage />} />
          <Route path="tasks"                      element={<TasksListPage />} />
          <Route path="teams"                      element={<TeamsPage />} />
          <Route path="approvals"                  element={<ApprovalsPage />} />
          <Route path="settings/categories"        element={<CategoriesPage />} />
          <Route path="settings/notifications"     element={<NotificationsSettings />} />
          <Route path="admin"                      element={<AdminPage />} />
          <Route path="client"                     element={<ClientProjectsPage />} />
          <Route path="client/projects"            element={<ClientProjectsPage />} />
          <Route path="client/project/:projectId" element={<ClientBoardPage />} />
        </Route>

        <Route path="/client/legacy" element={<Protected><ClientPortalPage /></Protected>} />
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
