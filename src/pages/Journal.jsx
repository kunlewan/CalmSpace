import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import api from '../api.js';
import './Journal.css';

const EMOTION_TAGS = [
  'calm','anxious','grateful','overwhelmed','motivated',
  'tired','happy','sad','focused','restless','content','irritable',
];
const PRODUCTIVITY_LABELS = { 1:'Very Low', 2:'Low', 3:'Moderate', 4:'High', 5:'Very High' };
const ENERGY_LABELS       = { 1:'Drained',  2:'Low', 3:'Okay',     4:'Good', 5:'Energised' };
const MOOD_COLORS = {
  great: '#0d9488', good: '#6366f1', okay: '#f59e0b', bad: '#f97316', awful: '#ef4444',
};

/* ── Insight Panel ─────────────────────────────────────────────────── */
function InsightPanel({ moodHistory, form }) {
  if (moodHistory.length < 3) return (
    <div className="insight-panel insight-panel--empty">
      <div className="ip-empty-icon">✨</div>
      <p className="ip-empty-title">Insights coming soon</p>
      <p className="ip-empty-sub">Log at least 3 entries to unlock mood insights.</p>
    </div>
  );

  const avg    = (moodHistory.reduce((s,e) => s + e.score, 0) / moodHistory.length).toFixed(1);
  const recent = moodHistory.slice(-3).reduce((s,e) => s + e.score, 0) / 3;
  const overall= moodHistory.reduce((s,e) => s + e.score, 0) / moodHistory.length;
  const trend  = recent > overall ? 'up' : recent < overall ? 'down' : 'stable';
  const topTags = {};
  moodHistory.forEach(e => (e.tags||[]).forEach(t => { topTags[t] = (topTags[t]||0)+1; }));
  const sortedTags = Object.entries(topTags).sort((a,b)=>b[1]-a[1]).slice(0,4).map(([t])=>t);
  const recentDays = moodHistory.slice(-7);

  return (
    <div className="insight-panel">
      <div className="ip-header">
        <span className="ip-eyebrow">✨ Insights</span>
        <span className="ip-badge">{moodHistory.length} entries</span>
      </div>
      <div className="ip-trend-block">
        <div className="ip-avg-ring" style={{ '--ring-color': trend === 'up' ? '#0d9488' : trend === 'down' ? '#ef4444' : '#6366f1' }}>
          <span className="ip-avg-num">{avg}</span>
          <span className="ip-avg-sub">/ 5</span>
        </div>
        <div className="ip-trend-info">
          <div className={`ip-trend-badge ip-trend-badge--${trend}`}>
            {trend === 'up' ? '↑ Improving' : trend === 'down' ? '↓ Declining' : '→ Stable'}
          </div>
          <p className="ip-trend-label">7-day trend vs overall</p>
        </div>
      </div>
      <div className="ip-section">
        <p className="ip-section-label">Last 7 days</p>
        <div className="ip-sparkline">
          {recentDays.map((e, i) => (
            <div key={i} className="ip-spark-col">
              <div className="ip-spark-bar-wrap">
                <div className="ip-spark-bar" style={{ height: `${(e.score/5)*100}%`, background: '#0d9488' }} />
              </div>
              <span className="ip-spark-day">{new Date(e.date).toLocaleDateString('en-US',{weekday:'narrow'})}</span>
            </div>
          ))}
        </div>
      </div>
      {sortedTags.length > 0 && (
        <div className="ip-section">
          <p className="ip-section-label">Frequent emotions</p>
          <div className="ip-tags">{sortedTags.map(t => <span key={t} className="ip-tag">{t}</span>)}</div>
        </div>
      )}
      {form.score && (
        <div className="ip-section">
          <p className="ip-section-label">Today's entry preview</p>
          <div className="ip-preview">
            <span className="ip-preview-emoji">
              {form.score === 5 ? '😄' : form.score === 4 ? '🙂' : form.score === 3 ? '😐' : form.score === 2 ? '😕' : '😞'}
            </span>
            <div className="ip-preview-body">
              <div className="ip-preview-scores">
                <span>⚡ {PRODUCTIVITY_LABELS[form.productivity]}</span>
                <span>🔋 {ENERGY_LABELS[form.energy]}</span>
              </div>
              {form.tags.length > 0 && (
                <div className="ip-preview-tags">
                  {form.tags.slice(0,3).map(t => <span key={t}>{t}</span>)}
                  {form.tags.length > 3 && <span>+{form.tags.length-3}</span>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
      <div className="ip-streak">
        <span className="ip-streak-icon">🔥</span>
        <div>
          <div className="ip-streak-val">{moodHistory.length} entries logged</div>
          <div className="ip-streak-sub">Keep showing up</div>
        </div>
      </div>
    </div>
  );
}

/* ── Already Logged Card ─────────────────────────────────────────── */
function AlreadyLoggedCard({ todayLog, nextAvailableAt, MOOD_LABELS }) {
  const mood = MOOD_LABELS?.[todayLog?.score];
  const nextTime = nextAvailableAt ? new Date(nextAvailableAt) : null;

  const hoursUntil = nextTime
    ? Math.max(0, Math.round((nextTime - Date.now()) / (1000 * 60 * 60)))
    : 0;

  return (
    <div className="journal-locked card">
      <div className="locked-icon">✅</div>
      <h3 className="locked-title">Mood logged for today!</h3>
      <p className="locked-sub">
        You logged <strong>{mood?.emoji} {mood?.label}</strong> earlier today.
        Come back tomorrow to log your next entry.
      </p>
      {hoursUntil > 0 && (
        <div className="locked-timer">
          <span className="locked-timer-icon">🕐</span>
          <span>Next entry available in <strong>{hoursUntil}h</strong></span>
        </div>
      )}
    </div>
  );
}

/* ── History Card ──────────────────────────────────────────────────── */
function HistoryCard({ entry, MOOD_LABELS }) {
  const mood = MOOD_LABELS?.[entry.score] || { emoji: '❓', label: 'Unknown', key: 'okay' };
  const color = MOOD_COLORS[mood.key] || '#94a3b8';
  const date  = new Date(entry.date || entry.createdAt);

  return (
    <div className="hcard">
      <div className="hcard-accent" style={{ background: color }} />
      <div className="hcard-date">
        <span className="hcard-day">{date.toLocaleDateString('en-US',{day:'numeric'})}</span>
        <span className="hcard-month">{date.toLocaleDateString('en-US',{month:'short'})}</span>
        <span className="hcard-weekday">{date.toLocaleDateString('en-US',{weekday:'short'})}</span>
      </div>
      <div className="hcard-emoji-wrap" style={{ background: color + '18' }}>
        <span className="hcard-emoji">{mood.emoji}</span>
      </div>
      <div className="hcard-body">
        <div className="hcard-top">
          <span className="hcard-mood-label" style={{ color }}>{mood.label}</span>
          <div className="hcard-badges">
            {entry.productivity && <span className="hcard-badge">⚡ {PRODUCTIVITY_LABELS[entry.productivity]}</span>}
            {entry.energy && <span className="hcard-badge">🔋 {ENERGY_LABELS[entry.energy]}</span>}
          </div>
        </div>
        {entry.note && <p className="hcard-note">{entry.note}</p>}
        {entry.tags?.length > 0 && (
          <div className="hcard-tags">{entry.tags.map(t => <span key={t} className="hcard-tag">{t}</span>)}</div>
        )}
        {entry.gratitude && <p className="hcard-note" style={{fontStyle:'italic', opacity:0.8}}>🙏 {entry.gratitude}</p>}
      </div>
      <div className="hcard-score" style={{ color, background: color + '15' }}>{entry.score}/5</div>
    </div>
  );
}

/* ── Main ──────────────────────────────────────────────────────────── */
export default function Journal() {
  const { moodHistory, setMoodHistory, logMood, MOOD_LABELS } = useApp();

  const [view, setView]     = useState('log');
  const [logs, setLogs]     = useState([]);
  const [loading, setLoading] = useState(true);
  const [saved, setSaved]   = useState(false);
  const [filterMood, setFilterMood] = useState(null);

  // Daily lock state
  const [loggedToday, setLoggedToday] = useState(false);
  const [todayLog, setTodayLog]       = useState(null);
  const [nextAvailableAt, setNextAvailableAt] = useState(null);

  const [form, setForm] = useState({
    score: null, note: '', productivity: 3, energy: 3,
    tags: [], gratitude: '', intentions: '',
  });

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const [historyRes, statusRes] = await Promise.all([
          api.get('/mood?limit=50'),
          api.get('/mood/status'),
        ]);
        if (historyRes.data.success) {
          const fetched = historyRes.data.moodHistory || [];
          setLogs(fetched);
          setMoodHistory(fetched);
        }
        if (statusRes.data.success) {
          setLoggedToday(statusRes.data.loggedToday);
          setTodayLog(statusRes.data.todayLog);
          setNextAvailableAt(statusRes.data.nextAvailableAt);
        }
      } catch {
        setLogs(moodHistory);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [setMoodHistory]);

  const toggleTag = (tag) => setForm(f => ({
    ...f,
    tags: f.tags.includes(tag) ? f.tags.filter(t => t !== tag) : [...f.tags, tag],
  }));

  const handleSave = async () => {
    if (!form.score) return;
    try {
      const res = await api.post('/mood', {
        score: form.score, note: form.note, productivity: form.productivity,
        energy: form.energy, tags: form.tags, gratitude: form.gratitude, intentions: form.intentions,
      });
      if (res.data.alreadyLogged) {
        setLoggedToday(true);
        setTodayLog(res.data.existingLog);
        return;
      }
      setLoggedToday(true);
      setTodayLog(res.data.log);
    } catch (err) {
      if (err.response?.data?.alreadyLogged) {
        setLoggedToday(true);
        setTodayLog(err.response.data.existingLog);
        return;
      }
    }
    logMood(form.score, form.note, { productivity: form.productivity, energy: form.energy, tags: form.tags });
    setSaved(true);
    setTimeout(() => {
      setSaved(false);
      setForm({ score: null, note: '', productivity: 3, energy: 3, tags: [], gratitude: '', intentions: '' });
    }, 2400);
  };

  const allEntries = [...(logs.length > 0 ? logs : moodHistory)].reverse();
  const filtered   = filterMood ? allEntries.filter(e => e.score === filterMood) : allEntries;

  if (loading) {
    return (
      <div className="journal animate-fade-in">
        <div style={{ padding: 40, textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Loading your journal…
        </div>
      </div>
    );
  }

  return (
    <div className="journal animate-fade-in">
      <div className="journal-page-header">
        <div>
          <h1 className="journal-title">Mood Journal</h1>
          <p className="journal-subtitle">Track your emotions, thoughts, and daily reflections.</p>
        </div>
        <div className="journal-toggle">
          <button className={`jtog-btn ${view === 'log' ? 'jtog-btn--on' : ''}`} onClick={() => setView('log')}>
            ◉ {loggedToday ? 'Today\'s Log' : 'New Entry'}
          </button>
          <button className={`jtog-btn ${view === 'history' ? 'jtog-btn--on' : ''}`} onClick={() => setView('history')}>
            ◇ History <span className="jtog-count">{allEntries.length}</span>
          </button>
        </div>
      </div>

      {/* LOG VIEW */}
      {view === 'log' && (
        <div className="journal-log-layout">
          <div className="jlog-form-col">
            {/* Already logged today */}
            {loggedToday ? (
              <AlreadyLoggedCard
                todayLog={todayLog}
                nextAvailableAt={nextAvailableAt}
                MOOD_LABELS={MOOD_LABELS}
              />
            ) : saved ? (
              <div className="journal-saved card">
                <div className="saved-ring">✦</div>
                <h3 className="saved-title">Entry saved!</h3>
                <p className="saved-sub">Your reflection has been recorded. Keep showing up for yourself 🌿</p>
              </div>
            ) : (
              <>
                {/* Mood picker */}
                <div className="jform-card card">
                  <h3 className="jform-heading">How are you feeling?</h3>
                  <div className="mood-picker-row">
                    {Object.entries(MOOD_LABELS || {}).reverse().map(([score, { emoji, label }]) => (
                      <button key={score}
                        className={`mpick-btn ${form.score === Number(score) ? 'mpick-btn--on' : ''}`}
                        onClick={() => setForm(f => ({ ...f, score: Number(score) }))}>
                        <span className="mpick-emoji">{emoji}</span>
                        <span className="mpick-label">{label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Emotions */}
                <div className="jform-card card">
                  <h3 className="jform-heading">Emotions present today</h3>
                  <div className="etag-grid">
                    {EMOTION_TAGS.map(tag => (
                      <button key={tag}
                        className={`etag ${form.tags.includes(tag) ? 'etag--on' : ''}`}
                        onClick={() => toggleTag(tag)}>
                        {tag}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sliders */}
                <div className="jform-card card jform-sliders">
                  <div className="jslider-group">
                    <div className="jslider-head">
                      <span className="jslider-label">⚡ Productivity</span>
                      <span className="jslider-val">{PRODUCTIVITY_LABELS[form.productivity]}</span>
                    </div>
                    <input type="range" min={1} max={5} step={1} value={form.productivity}
                      className="jslider" onChange={e => setForm(f => ({ ...f, productivity: Number(e.target.value) }))} />
                    <div className="jslider-dots">
                      {[1,2,3,4,5].map(n => <span key={n} className={n <= form.productivity ? 'dot--on' : ''} />)}
                    </div>
                  </div>
                  <div className="jslider-group">
                    <div className="jslider-head">
                      <span className="jslider-label">🔋 Energy</span>
                      <span className="jslider-val">{ENERGY_LABELS[form.energy]}</span>
                    </div>
                    <input type="range" min={1} max={5} step={1} value={form.energy}
                      className="jslider" onChange={e => setForm(f => ({ ...f, energy: Number(e.target.value) }))} />
                    <div className="jslider-dots">
                      {[1,2,3,4,5].map(n => <span key={n} className={n <= form.energy ? 'dot--on' : ''} />)}
                    </div>
                  </div>
                </div>

                {/* Reflections */}
                <div className="jform-card card">
                  <h3 className="jform-heading">Thoughts & Reflections</h3>
                  <textarea className="jtext" rows={4}
                    placeholder="What's on your mind today? Write freely — this is your safe space..."
                    value={form.note} onChange={e => setForm(f => ({ ...f, note: e.target.value }))} />
                </div>

                <div className="jform-two-col">
                  <div className="jform-card card">
                    <h3 className="jform-heading">Gratitude</h3>
                    <textarea className="jtext" rows={3}
                      placeholder="Three things I'm grateful for today..."
                      value={form.gratitude} onChange={e => setForm(f => ({ ...f, gratitude: e.target.value }))} />
                  </div>
                  <div className="jform-card card">
                    <h3 className="jform-heading">Tomorrow's intentions</h3>
                    <textarea className="jtext" rows={3}
                      placeholder="What do I want to focus on tomorrow?"
                      value={form.intentions} onChange={e => setForm(f => ({ ...f, intentions: e.target.value }))} />
                  </div>
                </div>

                <button className="jsave-btn btn-primary" onClick={handleSave} disabled={!form.score}>
                  Save Journal Entry →
                </button>
              </>
            )}
          </div>

          <div className="jlog-insight-col">
            <InsightPanel moodHistory={allEntries} form={form} />
          </div>
        </div>
      )}

      {/* HISTORY VIEW */}
      {view === 'history' && (
        <div className="journal-history-layout">
          <div className="history-filter-bar">
            <span className="hfb-label">Filter by mood:</span>
            <div className="hfb-pills">
              <button className={`hfb-pill ${!filterMood ? 'hfb-pill--on' : ''}`} onClick={() => setFilterMood(null)}>All</button>
              {Object.entries(MOOD_LABELS || {}).reverse().map(([score, { emoji, label }]) => (
                <button key={score}
                  className={`hfb-pill ${filterMood === Number(score) ? 'hfb-pill--on' : ''}`}
                  onClick={() => setFilterMood(Number(score))}>
                  {emoji} {label}
                </button>
              ))}
            </div>
            <span className="hfb-count">{filtered.length} entries</span>
          </div>

          {filtered.length === 0 ? (
            <div className="history-empty">
              <div className="history-empty-icon">◉</div>
              <h3>No entries yet</h3>
              <p>Start your journaling journey today.</p>
            </div>
          ) : (
            <div className="history-list">
              {filtered.map((entry, i) => {
                const date = new Date(entry.date || entry.createdAt);
                const prevDate = i > 0 ? new Date(filtered[i-1].date || filtered[i-1].createdAt) : null;
                const showMonth = !prevDate || date.getMonth() !== prevDate.getMonth() || date.getFullYear() !== prevDate.getFullYear();
                return (
                  <React.Fragment key={entry.id || entry._id || i}>
                    {showMonth && (
                      <div className="history-month-divider">
                        {date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })}
                      </div>
                    )}
                    <HistoryCard entry={entry} MOOD_LABELS={MOOD_LABELS} />
                  </React.Fragment>
                );
              })}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
