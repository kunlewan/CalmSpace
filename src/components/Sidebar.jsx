import React, { useState, useEffect } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../api.js';
import {
  MdDashboard, MdBook, MdAssignment, MdLightbulb, MdGroups,
  MdSunny, MdNightlight, MdNotifications, MdLogout,
  MdChevronLeft, MdChevronRight, MdWhatshot, MdSettings,
  MdPerson,
} from 'react-icons/md';
import './Sidebar.css';

const NAV_ITEMS = [
  { to: '/dashboard',       label: 'Dashboard',       Icon: MdDashboard,  badge: null },
  { to: '/journal',         label: 'Mood Journal',    Icon: MdBook,       badge: null },
  { to: '/assessment',      label: 'Assessment',      Icon: MdAssignment, badge: null },
  { to: '/recommendations', label: 'Recommendations', Icon: MdLightbulb,  badge: null },
  { to: '/chat',            label: 'Community',       Icon: MdGroups,     badge: null },
];

export default function Sidebar({ collapsed, onToggle }) {
  const { user, logout, notifications, markAllRead, unreadCount, streak, setStreak } = useApp();
  const { toggle: toggleTheme, isDark } = useTheme();
  const navigate = useNavigate();
  const [showNotifs, setShowNotifs] = useState(false);

  // Fetch real streak from dashboard API on mount
  useEffect(() => {
    api.get('/dashboard')
      .then(res => {
        if (res.data?.streak) setStreak(res.data.streak);
      })
      .catch(() => {});
  }, [setStreak]);

  const handleLogout = async () => {
    try {
      const refreshToken = null; // stored in memory only
      await api.post('/auth/logout', { refreshToken });
    } catch {}
    logout();
    navigate('/auth/login');
  };

  const recentNotifs = notifications.slice(0, 6);

  return (
    <>
      <aside className={`sidebar ${collapsed ? 'sidebar--collapsed' : ''}`}>
        <div className="sidebar-top">
          {/* Logo */}
          <div className="sidebar-logo">
            {!collapsed && <span className="logo-mark">◈</span>}
            {!collapsed && <span className="logo-text">MindSpace</span>}
            {collapsed && <span className="logo-mark" style={{ fontSize: 22 }}>◈</span>}
            <button className="sidebar-toggle" onClick={onToggle} title="Toggle sidebar">
              {collapsed ? <MdChevronRight size={16} /> : <MdChevronLeft size={16} />}
            </button>
          </div>

          {/* Streak */}
          {!collapsed && streak > 0 && (
            <div className="sidebar-streak">
              <MdWhatshot size={18} style={{ color: '#f97316' }} />
              <span className="streak-count">{streak} day streak</span>
            </div>
          )}

          {/* Nav */}
          <nav className="sidebar-nav">
            {NAV_ITEMS.map(({ to, label, Icon, badge }) => (
              <NavLink
                key={to}
                to={to}
                className={({ isActive }) => `nav-item ${isActive ? 'nav-item--active' : ''}`}
                title={collapsed ? label : ''}
              >
                <span className="nav-icon"><Icon size={20} /></span>
                {!collapsed && <span className="nav-label">{label}</span>}
                {!collapsed && badge && <span className="nav-badge">{badge}</span>}
              </NavLink>
            ))}
          </nav>
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          {/* Theme toggle */}
          <div className="sidebar-theme-row">
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              title={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              style={{ width: 34, height: 34 }}
            >
              {isDark ? <MdSunny size={18} /> : <MdNightlight size={18} />}
            </button>
            {!collapsed && (
              <span style={{ fontSize: 13, fontWeight: 500 }}>
                {isDark ? 'Light mode' : 'Dark mode'}
              </span>
            )}
          </div>

          {/* Notifications */}
          <div className="notif-wrap">
            <button
              className={`notif-btn ${showNotifs ? 'notif-btn--active' : ''}`}
              onClick={() => {
                setShowNotifs(s => !s);
                if (!showNotifs) markAllRead();
              }}
              title="Notifications"
            >
              <span className="notif-icon"><MdNotifications size={20} /></span>
              {!collapsed && <span className="notif-text">Notifications</span>}
              {unreadCount > 0 && <span className="notif-count">{unreadCount}</span>}
            </button>

            {showNotifs && (
              <div className="notif-dropdown">
                <div className="notif-header">
                  <span>Notifications</span>
                  <button className="notif-clear" onClick={() => setShowNotifs(false)}>✕</button>
                </div>
                <div className="notif-list">
                  {recentNotifs.length === 0 ? (
                    <p style={{ textAlign: 'center', padding: '16px', color: 'var(--color-text-muted)', fontSize: 13 }}>
                      No notifications
                    </p>
                  ) : recentNotifs.map(n => (
                    <div key={n.id} className={`notif-item ${!n.read ? 'notif-item--unread' : ''}`}>
                      <span className="notif-item-icon">{n.icon}</span>
                      <div className="notif-item-body">
                        <p className="notif-item-text">{n.text}</p>
                        <span className="notif-item-time">{n.time}</span>
                      </div>
                      {!n.read && <span className="notif-unread-dot" />}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* User card */}
          <div className="sidebar-user-card">
            <div
              className="user-avatar avatar avatar-sm"
              style={{ background: 'linear-gradient(135deg, var(--teal-700), var(--teal-500))' }}
            >
              {user?.avatar || user?.name?.[0]?.toUpperCase() || 'U'}
            </div>
            {!collapsed && (
              <div className="user-info">
                <div className="user-name">{user?.name || user?.username || 'User'}</div>
                <div className="user-handle">{user?.handle || `@${user?.username || 'anonymous'}`}</div>
              </div>
            )}
            {!collapsed && (
              <button className="logout-btn" onClick={handleLogout} title="Sign out">
                <MdLogout size={18} />
              </button>
            )}
          </div>
        </div>
      </aside>

      {showNotifs && (
        <div className="notif-backdrop" onClick={() => setShowNotifs(false)} />
      )}
    </>
  );
}
