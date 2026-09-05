import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AppProvider, useApp } from './contexts/AppContext';
import { ThemeProvider } from './contexts/ThemeContext';
import AppLayout from './components/AppLayout';
import { LoginPage, SignupPage } from './pages/Auth';
import Onboarding from './pages/Onboarding';
import Dashboard from './pages/Dashboard';
import AssessmentPage from './pages/Assessment';
import Journal from './pages/Journal';
import Recommendations from './pages/Recommendations';
import Chat from './pages/Chat';

export default function App() {
  return (
    <ThemeProvider>
      <AppProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/" element={<Navigate to="/auth/login" replace />} />
            <Route path="/auth/login"  element={<LoginPage />} />
            <Route path="/auth/signup" element={<SignupPage />} />
            <Route path="/onboarding"  element={<OnboardingRoute />} />
            <Route element={<ProtectedLayout />}>
              <Route path="/dashboard"       element={<Dashboard />} />
              <Route path="/assessment"      element={<AssessmentPage />} />
              <Route path="/journal"         element={<Journal />} />
              <Route path="/recommendations" element={<Recommendations />} />
              <Route path="/chat"            element={<Chat />} />
            </Route>
            <Route path="*" element={<Navigate to="/auth/login" replace />} />
          </Routes>
        </BrowserRouter>
      </AppProvider>
    </ThemeProvider>
  );
}

function OnboardingRoute() {
  const { user, onboardingStep } = useApp();
  if (!user) return <Navigate to="/auth/login" replace />;
  // If onboarding is already complete, never show it again
  if (user.onboardingCompleted) return <Navigate to="/dashboard" replace />;
  if (onboardingStep >= 6) return <Navigate to="/dashboard" replace />;
  return <Onboarding />;
}

function ProtectedLayout() {
  const { user, onboardingStep } = useApp();
  if (!user) return <Navigate to="/auth/login" replace />;
  // Only block access if onboarding is explicitly in-progress (not completed)
  if (!user.onboardingCompleted && onboardingStep > 0 && onboardingStep < 6) {
    return <Navigate to="/onboarding" replace />;
  }
  return <AppLayout />;
}