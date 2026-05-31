import React, { useState } from 'react';
import { Outlet, Navigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import Sidebar from './Sidebar';
import './AppLayout.css';

export default function AppLayout() {
  const { user, onboardingStep } = useApp();
  const [collapsed, setCollapsed] = useState(false);

  if (!user) return <Navigate to="/auth/login" replace />;

  return (
    <div className={`app-layout ${collapsed ? 'app-layout--collapsed' : ''}`}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed(c => !c)} />
      <main className="app-main">
        <div className="app-main-inner">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
