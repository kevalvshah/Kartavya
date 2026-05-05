import React from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import LoginPageStandalone, { RegisterPage } from './pages/LoginPageStandalone';
import TeamsPage from './pages/TeamsPage';
import NotificationsSettingsPage from './pages/NotificationsSettingsPage';
import './App.css';

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          <Route path="/login" element={<LoginPageStandalone />} />
          <Route path="/register" element={<RegisterPage />} />
          <Route path="/teams" element={<TeamsPage />} />
          <Route path="/dashboard" element={<Navigate to="/teams" replace />} />
          <Route path="/notifications-settings" element={<NotificationsSettingsPage />} />
          <Route path="/" element={<Navigate to="/login" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;