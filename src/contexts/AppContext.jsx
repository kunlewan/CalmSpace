import React, { createContext, useContext, useState, useCallback } from 'react';
import api, { setAccessToken, clearTokens } from '../api';

const AppContext = createContext(null);

export const MOOD_COLORS = {
  great: '#10b981', good: '#6366f1', okay: '#f59e0b', bad: '#f97316', awful: '#ef4444',
};

export const MOOD_LABELS = {
  5: { key: 'great', label: 'Great',  emoji: '😄' },
  4: { key: 'good',  label: 'Good',   emoji: '🙂' },
  3: { key: 'okay',  label: 'Okay',   emoji: '😐' },
  2: { key: 'bad',   label: 'Low',    emoji: '😕' },
  1: { key: 'awful', label: 'Rough',  emoji: '😞' },
};

export const INTEREST_OPTIONS = [
  'Mindfulness', 'Reading', 'Creative Arts', 'Fitness', 'Music',
  'Nature', 'Technology', 'Writing', 'Cooking', 'Gaming',
  'Photography', 'Problem-solving', 'Travel', 'Volunteering', 'Goal-setting',
  'Dance', 'Strength Training', 'Science', 'Theatre', 'Gardening',
];

export const GOAL_OPTIONS = [
  'Reduce anxiety', 'Better sleep', 'Increase productivity', 'Build connections',
  'Build healthy habits', 'Mental clarity', 'Financial wellness', 'Career growth',
  'Improve relationships', 'Self-confidence', 'Work-life balance', 'More energy',
];

export function AppProvider({ children }) {
  const [user, setUser] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [isLoading, setIsLoading] = useState(true);

  const [onboardingStep, setOnboardingStep] = useState(0);
  const [emailVerified, setEmailVerified] = useState(false);
  const [moodHistory, setMoodHistory] = useState([]);
  const [assessmentResult, setAssessmentResult] = useState(null);
  const [lastAssessmentDate, setLastAssessmentDate] = useState(null);

  // Real DM/room state
  const [dmConversations, setDmConversations] = useState([]);
  const [activeDM, setActiveDM] = useState(null);

  // Notifications from API only
  const [notifications, setNotifications] = useState([]);

  const [userInterests, setUserInterests] = useState([]);
  const [userGoals, setUserGoals] = useState([]);
  const [onboardingCompleted, setOnboardingCompleted] = useState(false);
  const [streak, setStreak] = useState(0);

  const login = useCallback((userData, token) => {
    if (!userData) return;

    const resolvedToken =
      token ?? userData.token ?? userData.accessToken ?? userData.jwt ?? null;

    if (resolvedToken) setAuthToken(resolvedToken);

    const name = userData.name || userData.fullname || userData.email?.split('@')[0] || 'User';
    const safeName = String(name).trim();
    const handle = userData.username ? `@${userData.username}` : `@${safeName.toLowerCase().replace(/\s/g, '_')}`;

    const newUser = {
      ...userData,
      name: safeName,
      handle,
      avatar: safeName[0]?.toUpperCase() || 'U',
    };

    setUser(newUser);
    setEmailVerified(userData.isEmailVerified || false);
    setOnboardingCompleted(userData.onboardingCompleted || false);

    if (userData.interests?.length) setUserInterests(userData.interests);
    if (userData.goals?.length) setUserGoals(userData.goals);

    if (userData.onboardingCompleted) {
      setOnboardingStep(6);
    } else if (userData.isEmailVerified) {
      setOnboardingStep(3);
    } else {
      setOnboardingStep(2);
    }
  }, []);

  const completeOnboarding = useCallback(() => {
    setOnboardingStep(6);
    setOnboardingCompleted(true);
    setUser(prev => prev ? { ...prev, onboardingCompleted: true } : null);
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    setAuthToken(null);
    setOnboardingStep(0);
    setEmailVerified(false);
    setAssessmentResult(null);
    setMoodHistory([]);
    setDmConversations([]);
    setNotifications([]);
    setUserInterests([]);
    setUserGoals([]);
    setStreak(0);
  }, []);

  const logMood = useCallback((score, note, extras = {}) => {
    const entry = {
      id: `mood-${Date.now()}`,
      date: new Date().toISOString(),
      score,
      mood: MOOD_LABELS[score],
      note,
      productivity: extras.productivity || 3,
      energy: extras.energy || 3,
      tags: extras.tags || [],
    };
    setMoodHistory(prev => {
      const updated = [...prev];
      const todayIdx = updated.findIndex(e =>
        new Date(e.date).toDateString() === new Date().toDateString()
      );
      if (todayIdx >= 0) updated[todayIdx] = entry;
      else updated.push(entry);
      return updated.slice(-30);
    });
    setStreak(s => s + 1);
  }, []);

  // ── Improved DM Functions (Bug Fix Applied) ───────────────────────────────

  const addDMConversation = useCallback((incoming) => {
    setDmConversations(prev => {
      const idx = prev.findIndex(c => c.id === incoming.id);
      if (idx === -1) {
        return [...prev, {
          id:       incoming.id,
          userId:   incoming.userId   ?? incoming.id?.replace('dm-', ''),
          name:     incoming.name     ?? incoming.userId ?? 'Unknown',
          status:   incoming.status   ?? 'offline',
          dmStatus: incoming.dmStatus ?? 'pending',
          messages: incoming.messages ?? [],
        }];
      }

      const existing = prev[idx];
      const merged = { ...existing };

      if (incoming.name     != null) merged.name     = incoming.name;
      if (incoming.userId   != null) merged.userId   = incoming.userId;
      if (incoming.status   != null) merged.status   = incoming.status;
      if (incoming.dmStatus != null) merged.dmStatus = incoming.dmStatus;
      if (incoming.messages != null) merged.messages = incoming.messages;

      const next = [...prev];
      next[idx] = merged;
      return next;
    });
  }, []);

  const sendDM = useCallback((convId, text) => {
    setDmConversations(prev => {
      const idx = prev.findIndex(c => c.id === convId);
      if (idx === -1) return prev;

      const msg = {
        id:        `temp-${Date.now()}`,
        from:      'me',
        text,
        content:   text,
        time:      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date().toISOString(),
      };

      const next = [...prev];
      next[idx] = { ...prev[idx], messages: [...(prev[idx].messages || []), msg] };
      return next;
    });
  }, []);

  const receiveDM = useCallback((fromId, fromName, content) => {
    const convId = `dm-${fromId}`;
    setDmConversations(prev => {
      const idx = prev.findIndex(c => c.id === convId);
      const msg = {
        id:        `recv-${Date.now()}`,
        from:      fromId,
        text:      content,
        content,
        time:      new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        createdAt: new Date().toISOString(),
      };

      if (idx === -1) {
        return [...prev, {
          id:       convId,
          userId:   fromId,
          name:     fromName,
          status:   'online',
          dmStatus: 'accepted',
          messages: [msg],
        }];
      }

      const next = [...prev];
      next[idx] = {
        ...prev[idx],
        messages: [...(prev[idx].messages || []), msg],
        ...(prev[idx].name === fromId ? { name: fromName } : {}),
      };
      return next;
    });
  }, []);

  const markAllRead = useCallback(() => {
    setNotifications(prev => prev.map(n => ({ ...n, read: true })));
  }, []);

  const addNotification = useCallback((notif) => {
    setNotifications(prev => [notif, ...prev].slice(0, 20));
  }, []);

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <AppContext.Provider value={{
      user, login, logout, setUser,
      authToken,
      onboardingStep, setOnboardingStep, completeOnboarding,
      emailVerified, setEmailVerified,
      onboardingCompleted,
      moodHistory, logMood, setMoodHistory,
      assessmentResult, setAssessmentResult,
      lastAssessmentDate, setLastAssessmentDate,
      dmConversations, setDmConversations, 
      sendDM, receiveDM, addDMConversation, 
      activeDM, setActiveDM,
      notifications, markAllRead, addNotification, unreadCount,
      userInterests, setUserInterests,
      userGoals, setUserGoals,
      streak, setStreak,
      MOOD_LABELS, MOOD_COLORS,
      INTEREST_OPTIONS, GOAL_OPTIONS,
    }}>
      {children}
    </AppContext.Provider>
  );
}

export const useApp = () => useContext(AppContext);