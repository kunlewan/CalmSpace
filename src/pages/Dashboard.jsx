import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip,
  CartesianGrid, ResponsiveContainer,
} from 'recharts';
import { useApp } from '../contexts/AppContext';
import { useTheme } from '../contexts/ThemeContext';
import api from '../api.js';
import './Dashboard.css';

const TIER_META = {
  Minimal:  { bg: 'rgba(16,185,129,0.12)',  text: '#059669', bar: '#10b981' },
  Mild:     { bg: 'rgba(245,158,11,0.12)',  text: '#d97706', bar: '#f59e0b' },
  Moderate: { bg: 'rgba(239,68,68,0.12)',   text: '#dc2626', bar: '#ef4444' },
  High:     { bg: 'rgba(244,63,94,0.12)',   text: '#be123c', bar: '#f43f5e' },
};
const TIER_META_DARK = {
  Minimal:  { bg: 'rgba(16,185,129,0.15)',  text: '#6ee7b7', bar: '#10b981' },
  Mild:     { bg: 'rgba(245,158,11,0.15)',  text: '#fcd34d', bar: '#f59e0b' },
  Moderate: { bg: 'rgba(239,68,68,0.15)',   text: '#fca5a5', bar: '#ef4444' },
  High:     { bg: 'rgba(244,63,94,0.15)',   text: '#fda4af', bar: '#f43f5e' },
};

const MOOD_MAP = {
  5: { key: 'great', label: 'Great',  emoji: '😄' },
  4: { key: 'good',  label: 'Good',   emoji: '🙂' },
  3: { key: 'okay',  label: 'Okay',   emoji: '😐' },
  2: { key: 'bad',   label: 'Low',    emoji: '😕' },
  1: { key: 'awful', label: 'Rough',  emoji: '😞' },
};

function greeting() {
  const h = new Date().getHours();
  if (h < 12) return 'Good morning';
  if (h < 17) return 'Good afternoon';
  return 'Good evening';
}

function CustomTooltip({ active, payload }) {
  if (!active || !payload?.length) return null;
  const m = MOOD_MAP[payload[0].value];
  return (
    <div className="chart-tooltip">
      <div className="tooltip-val">{m ? `${m.emoji} ${m.label}` : payload[0].value}</div>
    </div>
  );
}

export default function Dashboard() {
  const {
    user, moodHistory, logMood, setMoodHistory,
    assessmentResult, setAssessmentResult, setStreak,
  } = useApp();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [selScore, setSelScore] = useState(null);
  const [note, setNote]         = useState('');
  const [logged, setLogged]     = useState(false);
  const [loggedToday, setLoggedToday] = useState(false);
  const [loading, setLoading]   = useState(true);
  const [dashStreak, setDashStreak] = useState(0);
  const [quickTip, setQuickTip] = useState(null);
  const [assessmentLocked, setAssessmentLocked] = useState(false);
  const [nextAssessDate, setNextAssessDate] = useState(null);

  useEffect(() => {
    const fetchAll = async () => {
      try {
        setLoading(true);

        const [dashRes, moodStatusRes, assessStatusRes] = await Promise.all([
          api.get('/dashboard'),
          api.get('/mood/status'),
          api.get('/assessments/wellbeing/status'),
        ]);

        if (dashRes.data?.success) {
          if (dashRes.data.moodHistory) setMoodHistory(dashRes.data.moodHistory);
          if (dashRes.data.assessmentResult) setAssessmentResult(dashRes.data.assessmentResult);
          if (dashRes.data.streak) {
            setDashStreak(dashRes.data.streak);
            setStreak(dashRes.data.streak);
          }
        }

        if (moodStatusRes.data?.success) {
          setLoggedToday(moodStatusRes.data.loggedToday);
          if (moodStatusRes.data.loggedToday) setLogged(true);
        }

        if (assessStatusRes.data?.success) {
          setAssessmentLocked(assessStatusRes.data.isLocked);
          if (assessStatusRes.data.nextAvailableAt) {
            setNextAssessDate(new Date(assessStatusRes.data.nextAvailableAt));
          }
          if (assessStatusRes.data.lastAssessment && !assessmentResult) {
            setAssessmentResult(assessStatusRes.data.lastAssessment);
          }
        }

        // Fetch quick tip
        api.get('/recommendations/quick-tip')
          .then(res => setQuickTip(res.data.tip))
          .catch(() => {});

      } catch (err) {
        console.warn('Dashboard API unavailable:', err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchAll();
  }, [setMoodHistory, setAssessmentResult, setStreak]);

  const chartData = moodHistory.slice(-14).map(e => ({
    day: new Date(e.date).toLocaleDateString('en-US', { weekday: 'short' }),
    score: e.score,
  }));

  const avgScore = moodHistory.length
    ? (moodHistory.reduce((s, e) => s + e.score, 0) / moodHistory.length).toFixed(1)
    : '–';

  const latestMood    = moodHistory[moodHistory.length - 1];
  const tierData      = assessmentResult ? (isDark ? TIER_META_DARK : TIER_META)[assessmentResult.tier] : null;
  const recentEntries = [...moodHistory].reverse().slice(0, 6);

  const gridColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(15,23,42,0.05)';
  const tickColor = isDark ? 'rgba(255,255,255,0.3)' : '#94a3b8';
  const areaColor = '#14b8a6';

  const handleLog = async () => {
    if (!selScore || loggedToday) return;
    try {
      const res = await api.post('/mood', { score: selScore, note, productivity: 3, energy: 3, tags: [] });
      if (res.data.alreadyLogged) {
        setLoggedToday(true);
        setLogged(true);
        return;
      }
    } catch (err) {
      if (err.response?.data?.alreadyLogged) {
        setLoggedToday(true);
        setLogged(true);
        return;
      }
    }
    logMood(selScore, note);
    setLoggedToday(true);
    setLogged(true);
    setSelScore(null);
    setNote('');
  };

  if (loading) return <div className="loading-screen">Loading your MindSpace…</div>;

  return (
    <div className="dash">
      {/* Header */}
      <header className="dash-header">
        <div>
          <p className="dash-date">
            {new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
          </p>
          <h1 className="dash-greeting">
            {greeting()}, <span className="dash-name">{user?.name?.split(' ')[0] || 'User'}.</span>
          </h1>
        </div>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
          {!assessmentLocked && (
            <button className="btn-assess" onClick={() => navigate('/assessment')}>
              {assessmentResult ? 'Reassess →' : 'Take assessment →'}
            </button>
          )}
          {assessmentLocked && nextAssessDate && (
            <div className="assess-lock-badge">
              🔒 Next assessment: {nextAssessDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </div>
          )}
        </div>
      </header>

      {/* Quick tip banner */}
      {quickTip && (
        <div className="dash-quick-tip">
          <span className="dqt-emoji">{quickTip.emoji}</span>
          <div className="dqt-body">
            <p className="dqt-tip">{quickTip.tip}</p>
            <p className="dqt-action">→ {quickTip.action}</p>
          </div>
          <button className="dqt-link" onClick={() => navigate('/recommendations')}>
            All recs →
          </button>
        </div>
      )}

      {/* Stats */}
      <div className="stats-row">
        {[
          { label: 'Avg mood (14d)', value: avgScore, sub: 'out of 5' },
          { label: 'Entries logged', value: moodHistory.length, sub: 'total check-ins' },
          { label: 'Current streak', value: dashStreak || 0, sub: dashStreak === 1 ? 'day' : 'days' },
          { label: "Today's mood", value: latestMood?.mood?.emoji || '–', sub: latestMood?.mood?.label || 'not logged', emoji: true },
        ].map((s, i) => (
          <div key={i} className="stat-card" style={{ animationDelay: `${i * 55}ms` }}>
            <div className="stat-label">{s.label}</div>
            <div className={`stat-val${s.emoji ? ' stat-val--emoji' : ''}`}>{s.value}</div>
            <div className="stat-sub">{s.sub}</div>
          </div>
        ))}
      </div>

      {/* Row 1: Chart + Assessment */}
      <div className="dash-grid-main">
        <div className="panel">
          <div className="panel-hdr">
            <div>
              <div className="panel-title">Mood trends</div>
              <div className="panel-sub">Last 14 days</div>
            </div>
            <button className="panel-link" onClick={() => navigate('/journal')}>Full journal →</button>
          </div>
          <div className="chart-wrapper">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 4, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="moodGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor={areaColor} stopOpacity={0.25} />
                    <stop offset="95%" stopColor={areaColor} stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid stroke={gridColor} strokeDasharray="3 3" />
                <XAxis dataKey="day" tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <YAxis domain={[1, 5]} ticks={[1,2,3,4,5]} tick={{ fill: tickColor, fontSize: 11 }} axisLine={false} tickLine={false} />
                <Tooltip content={<CustomTooltip />} />
                <Area type="monotone" dataKey="score" stroke={areaColor} strokeWidth={2}
                  fill="url(#moodGrad)" dot={{ fill: areaColor, r: 3 }} activeDot={{ r: 5 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="panel">
          <div className="panel-title" style={{ marginBottom: 14 }}>Wellbeing assessment</div>
          {assessmentResult ? (
            <>
              <div className="anx-pill" style={{ background: tierData?.bg, color: tierData?.text }}>
                {assessmentResult.tier} Wellbeing
              </div>
              <p className="anx-desc">{assessmentResult.description}</p>
              <div className="score-bar">
                <div className="score-fill" style={{
                  width: `${assessmentResult.maxScore ? (assessmentResult.score / assessmentResult.maxScore) * 100 : 40}%`,
                  background: tierData?.bar || areaColor,
                }} />
              </div>
              <div className="score-row">
                <span>Score</span>
                <span>{assessmentResult.score} / {assessmentResult.maxScore ?? 24}</span>
              </div>
              {assessmentLocked && nextAssessDate && (
                <p className="anx-next">
                  🔒 Locked — next retake: {nextAssessDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                </p>
              )}
              {!assessmentLocked && (
                <button className="panel-link" style={{ marginTop: 14 }} onClick={() => navigate('/assessment')}>
                  Reassess now →
                </button>
              )}
            </>
          ) : (
            <div className="anx-empty">
              <div className="anx-empty-icon">◈</div>
              <p className="anx-empty-text">No assessment yet</p>
              <p className="anx-empty-sub">Complete a check-in to see your wellbeing tier and personalised insights.</p>
              <button className="btn-primary" style={{ marginTop: 16, fontSize: 13 }} onClick={() => navigate('/assessment')}>
                Start assessment →
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Row 2: History + Check-in */}
      <div className="dash-grid-secondary">
        <div className="panel">
          <div className="panel-hdr">
            <div className="panel-title">Recent entries</div>
            <button className="panel-link" onClick={() => navigate('/journal')}>All →</button>
          </div>
          <table className="hist-table">
            <thead>
              <tr><th>Day</th><th>Mood</th><th>Score</th></tr>
            </thead>
            <tbody>
              {recentEntries.map((e, i) => {
                const m = e.mood || MOOD_MAP[e.score];
                return (
                  <tr key={i}>
                    <td>{new Date(e.date).toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })}</td>
                    <td>
                      <span className={`mood-badge mood-badge--${m?.key || 'okay'}`}>
                        {m?.emoji} {m?.label}
                      </span>
                    </td>
                    <td className="score-num">{e.score}</td>
                  </tr>
                );
              })}
              {!recentEntries.length && (
                <tr><td colSpan={3} style={{ textAlign: 'center', color: 'var(--color-text-muted)', padding: '20px 0' }}>No entries yet</td></tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="panel">
          <div className="panel-title" style={{ marginBottom: 12 }}>Daily check-in</div>
          {logged || loggedToday ? (
            <div className="mood-ok">
              <div className="mood-ok-ring">{latestMood?.mood?.emoji || '✓'}</div>
              <p className="mood-ok-text">Mood logged for today</p>
              <p className="mood-ok-sub">Come back tomorrow for your next check-in.</p>
              <button className="panel-link" style={{ marginTop: 12 }} onClick={() => navigate('/journal')}>
                View full journal →
              </button>
            </div>
          ) : (
            <>
              <p className="mood-prompt">How are you feeling right now?</p>
              <div className="mood-picker">
                {Object.entries(MOOD_MAP).reverse().map(([score, { emoji, label }]) => (
                  <button
                    key={score}
                    className={`mood-chip${selScore === Number(score) ? ' mood-chip--selected' : ''}`}
                    onClick={() => setSelScore(Number(score))}
                  >
                    <span className="mood-em">{emoji}</span>
                    <span className="mood-lbl">{label}</span>
                  </button>
                ))}
              </div>
              <textarea
                className="mood-textarea"
                rows={2}
                placeholder="A brief note about your day… (optional)"
                value={note}
                onChange={e => setNote(e.target.value)}
              />
              <button className="btn-log" disabled={!selScore} onClick={handleLog}>
                Log mood
              </button>
            </>
          )}
        </div>
      </div>

      {/* Recommendations shortcut */}
      {/* <div className="panel reco-shortcut-panel">
        <div className="panel-hdr">
          <div>
            <div className="panel-title">✨ Your Recommendations</div>
            <div className="panel-sub">Movies, music, and goal plans based on your interests</div>
          </div>
          <button className="panel-link" onClick={() => navigate('/recommendations')}>
            View all →
          </button>
        </div>
        <div className="reco-shortcut-grid">
          {[
            { icon: '🧘', label: 'Wellness practices', desc: 'CBT, breathing, mindfulness', path: '/recommendations' },
            { icon: '🎬', label: 'Movie picks', desc: 'Curated by your interests', path: '/recommendations' },
            { icon: '🎵', label: 'Music for you', desc: 'Albums matched to your vibe', path: '/recommendations' },
            { icon: '🚀', label: 'Goal action plans', desc: 'Step-by-step to your goals', path: '/recommendations' },
          ].map((item, i) => (
            <button key={i} className="reco-shortcut-card" onClick={() => navigate(item.path)}>
              <span className="rsc-icon">{item.icon}</span>
              <div>
                <div className="rsc-label">{item.label}</div>
                <div className="rsc-desc">{item.desc}</div>
              </div>
            </button>
          ))}
        </div>
      </div> */}
    </div>
  );
}
