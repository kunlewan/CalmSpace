import React, { useState, useEffect } from 'react';
import { useApp } from '../contexts/AppContext';
import api from '../api.js';
import {
  MdAutoAwesome, MdFavorite, MdFavoriteBorder, MdExpandMore, MdExpandLess,
  MdAir, MdPsychology, MdSelfImprovement, MdChecklist, MdPeople, MdBolt,
  MdBed, MdFitnessCenter, MdSentimentSatisfied, MdLightbulb, MdFilterList,
  MdTrendingUp, MdAccessTime, MdRefresh, MdBookmark, MdArrowForward, MdStar,
  MdMovie, MdMusicNote, MdRocketLaunch, MdCheckCircle, MdTag, MdHeadphones,
  MdLocalMovies,
} from 'react-icons/md';
import './Recommendations.css';

const CATEGORY_META = {
  Breathing:    { Icon: MdAir,               color: '#06b6d4' },
  CBT:          { Icon: MdPsychology,         color: '#8b5cf6' },
  Wellness:     { Icon: MdSentimentSatisfied, color: '#10b981' },
  Mindfulness:  { Icon: MdSelfImprovement,    color: '#10b981' },
  Habit:        { Icon: MdChecklist,          color: '#f59e0b' },
  Social:       { Icon: MdPeople,             color: '#3b82f6' },
  Productivity: { Icon: MdBolt,               color: '#f97316' },
  Sleep:        { Icon: MdBed,               color: '#6366f1' },
  Movement:     { Icon: MdFitnessCenter,      color: '#ec4899' },
  Gratitude:    { Icon: MdFavorite,           color: '#ef4444' },
  Default:      { Icon: MdLightbulb,          color: '#14b8a6' },
};

const DIFFICULTY_COLOR = { Easy: '#10b981', Moderate: '#f59e0b', Challenging: '#ef4444' };
const WELLNESS_CATEGORIES = ['All', 'Breathing', 'CBT', 'Mindfulness', 'Wellness', 'Habit', 'Social', 'Productivity', 'Sleep'];

function getCategoryMeta(category) {
  return CATEGORY_META[category] || CATEGORY_META.Default;
}

/* ── Movie Card (horizontal row layout) ─────────────────────────── */
function MovieCard({ movie, index }) {
  return (
    <div className="movie-card">
      <div className="movie-rank">
        <MdLocalMovies size={20} className="movie-rank-icon" />
        <span className="movie-rank-num">#{index + 1}</span>
      </div>
      <div className="movie-info">
        <div className="movie-title">{movie.title}</div>
        <div className="movie-meta-row">
          <span className="movie-year">{movie.year}</span>
          <span className="movie-stars">
            <MdStar size={12} style={{ color: '#BA7517', flexShrink: 0 }} />
            {movie.rating}
          </span>
          <span className="movie-rating-denom">/ 10</span>
        </div>
        <p className="movie-why">{movie.why}</p>
      </div>
      <span className="movie-interest-tag">{movie.basedOn}</span>
    </div>
  );
}

/* ── Music Card (grid card layout) ─────────────────────────────── */
function MusicCard({ track }) {
  return (
    <div className="music-card">
      <div className="music-card-top">
        <div className="music-icon-wrap">
          <MdHeadphones size={18} className="music-icon" />
        </div>
        <div className="music-artist-block">
          <div className="music-artist">{track.artist}</div>
          <div className="music-album">{track.album}</div>
        </div>
      </div>
      <span className="music-genre-badge">{track.genre}</span>
      <p className="music-why">{track.why}</p>
      <div className="music-based-on">
        <MdTag size={12} style={{ flexShrink: 0 }} />
        Based on: {track.basedOn}
      </div>
    </div>
  );
}

/* ── Goal Action Plan Card ──────────────────────────────────────── */
function GoalPlanCard({ plan }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <div className="goal-plan-card card">
      <div className="goal-plan-header" onClick={() => setExpanded(e => !e)}>
        <span className="goal-plan-icon">{plan.icon}</span>
        <div className="goal-plan-info">
          <h4 className="goal-plan-title">{plan.goal}</h4>
          <span className="goal-plan-milestone">{plan.milestone}</span>
        </div>
        <button className="goal-plan-toggle">
          {expanded ? <MdExpandLess size={20} /> : <MdExpandMore size={20} />}
        </button>
      </div>

      {expanded && (
        <div className="goal-plan-body animate-fade-in">
          <div className="goal-plan-section">
            <h5 className="gps-label">⚡ Quick Wins (Do Today)</h5>
            <ul className="gps-list">
              {plan.quickWins.map((w, i) => (
                <li key={i} className="gps-item">
                  <MdCheckCircle size={14} style={{ color: '#10b981', flexShrink: 0 }} />
                  <span>{w}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="goal-plan-section">
            <h5 className="gps-label">📅 Weekly Goals</h5>
            <ul className="gps-list">
              {plan.weeklyGoals.map((g, i) => (
                <li key={i} className="gps-item">
                  <MdArrowForward size={14} style={{ color: '#6366f1', flexShrink: 0 }} />
                  <span>{g}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="goal-plan-section">
            <h5 className="gps-label">📚 Recommended Resources</h5>
            <ul className="gps-list">
              {plan.resources.map((r, i) => (
                <li key={i} className="gps-item">
                  <MdStar size={14} style={{ color: '#f59e0b', flexShrink: 0 }} />
                  <span>{r}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="goal-plan-milestone-box">
            <MdRocketLaunch size={14} style={{ color: '#0d9488' }} />
            <span><strong>30-day milestone:</strong> {plan.milestone}</span>
          </div>
        </div>
      )}
    </div>
  );
}

/* ── Main ───────────────────────────────────────────────────────── */
export default function Recommendations() {
  const { userGoals, userInterests } = useApp();

  const [activeTab, setActiveTab]           = useState('wellness');
  const [activeCategory, setActiveCategory] = useState('All');
  const [expanded, setExpanded]             = useState(null);
  const [saved, setSaved]                   = useState([]);
  const [recs, setRecs]                     = useState([]);
  const [mediaRecs, setMediaRecs]           = useState({ movies: [], music: [] });
  const [goalPlans, setGoalPlans]           = useState([]);
  const [loading, setLoading]               = useState(true);
  const [narrative, setNarrative]           = useState('');
  const [insight, setInsight]               = useState('');
  const [nextCheckIn, setNextCheckIn]       = useState('');
  const [source, setSource]                 = useState('');
  const [meta, setMeta]                     = useState(null);
  const [quickTip, setQuickTip]             = useState(null);
  const [showTip, setShowTip]               = useState(true);
  const [mediaFilter, setMediaFilter]       = useState('all'); // 'all' | 'movies' | 'music'

  const fetchRecs = () => {
    setLoading(true);
    api.get('/recommendations')
      .then(res => {
        const d = res.data;
        setRecs(d.recommendations || []);
        setNarrative(d.narrative || '');
        setInsight(d.insight || '');
        setNextCheckIn(d.nextCheckIn || '');
        setSource(d.source || '');
        setMeta(d.meta || null);
        setMediaRecs(d.mediaRecommendations || { movies: [], music: [] });
        setGoalPlans(d.goalActionPlans || []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));

    api.get('/recommendations/quick-tip')
      .then(res => setQuickTip(res.data.tip))
      .catch(() => {});
  };

  useEffect(() => {
    fetchRecs();
    api.get('/recommendations/saved')
      .then(res => setSaved(res.data.savedIds || []))
      .catch(() => {});
  }, []);

  const filtered = activeCategory === 'All' ? recs : recs.filter(r => r.category === activeCategory);

  const toggleSave = async (id) => {
    const isSaved = saved.includes(id);
    setSaved(prev => isSaved ? prev.filter(i => i !== id) : [...prev, id]);
    try {
      if (isSaved) await api.delete(`/recommendations/${id}/save`);
      else         await api.post(`/recommendations/${id}/save`);
    } catch {
      setSaved(prev => isSaved ? [...prev, id] : prev.filter(i => i !== id));
    }
  };

  const hasMedia = mediaRecs.movies.length > 0 || mediaRecs.music.length > 0;
  const hasGoals = goalPlans.length > 0;

  const displayedMovies = mediaFilter === 'music'  ? [] : mediaRecs.movies;
  const displayedMusic  = mediaFilter === 'movies' ? [] : mediaRecs.music;

  const movieInterests = [...new Set(displayedMovies.map(m => m.basedOn))].join(', ');
  const musicInterests = [...new Set(displayedMusic.map(m => m.basedOn))].join(', ');

  return (
    <div className="recommendations animate-fade-in">

      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">Recommendations</h1>
          <p className="page-subtitle">
            Personalised wellness, media, and goal plans — all based on what you picked during onboarding.
          </p>
        </div>
        <button className="reco-refresh-btn" onClick={fetchRecs} title="Refresh" disabled={loading}>
          <MdRefresh size={18} style={{ transform: loading ? 'rotate(180deg)' : 'none', transition: 'transform 0.6s' }} />
        </button>
      </div>

      {/* Quick Tip */}
      {quickTip && showTip && (
        <div className="reco-quick-tip">
          <span className="reco-tip-emoji">{quickTip.emoji}</span>
          <div className="reco-tip-body">
            <p className="reco-tip-text">{quickTip.tip}</p>
            <p className="reco-tip-action"><MdArrowForward size={13} /> {quickTip.action}</p>
          </div>
          <button className="reco-tip-close" onClick={() => setShowTip(false)}>✕</button>
        </div>
      )}

      {/* AI Banner */}
      <div className="reco-ai-banner">
        <div className="reco-ai-banner-section reco-ai-banner-main">
          <div className="reco-ai-icon"><MdAutoAwesome size={22} style={{ color: '#fbbf24' }} /></div>
          <div>
            <h3>{source === 'ai' ? 'Your AI-personalised feed' : 'Your personalised feed'}</h3>
            <p>{narrative || `Recommendations powered by your ${userInterests.length} interests and ${userGoals.length} goals.`}</p>
          </div>
        </div>
        <div className="reco-ai-stats">
          <div className="reco-ai-stat"><strong>{recs.length}</strong><span>Wellness</span></div>
          <div className="reco-ai-stat"><strong>{mediaRecs.movies.length}</strong><span>Movies</span></div>
          <div className="reco-ai-stat"><strong>{mediaRecs.music.length}</strong><span>Albums</span></div>
          <div className="reco-ai-stat"><strong>{goalPlans.length}</strong><span>Goal Plans</span></div>
        </div>
      </div>

      {insight && (
        <div className="reco-insight-block">
          <MdTrendingUp size={18} style={{ color: 'var(--teal-500)', flexShrink: 0 }} />
          <div>
            <p className="reco-insight-label">Pattern insight</p>
            <p className="reco-insight-text">{insight}</p>
          </div>
        </div>
      )}

      {nextCheckIn && (
        <div className="reco-next-checkin">
          <MdAccessTime size={15} />
          <span><strong>Next step:</strong> {nextCheckIn}</span>
        </div>
      )}

      {/* Tab navigation */}
      <div className="reco-tab-row">
        <button className={`reco-tab ${activeTab === 'wellness' ? 'reco-tab--active' : ''}`} onClick={() => setActiveTab('wellness')}>
          <MdAutoAwesome size={15} /> Wellness Practices
          {recs.length > 0 && <span className="reco-tab-count">{recs.length}</span>}
        </button>
        {hasMedia && (
          <button className={`reco-tab ${activeTab === 'media' ? 'reco-tab--active' : ''}`} onClick={() => setActiveTab('media')}>
            <MdMovie size={15} /> Movies &amp; Music
            {(mediaRecs.movies.length + mediaRecs.music.length) > 0 && (
              <span className="reco-tab-count">{mediaRecs.movies.length + mediaRecs.music.length}</span>
            )}
          </button>
        )}
        {hasGoals && (
          <button className={`reco-tab ${activeTab === 'goals' ? 'reco-tab--active' : ''}`} onClick={() => setActiveTab('goals')}>
            <MdRocketLaunch size={15} /> Goal Action Plans
            <span className="reco-tab-count">{goalPlans.length}</span>
          </button>
        )}
      </div>

      {loading && (
        <div className="reco-loading">
          <div className="reco-loading-spinner" />
          <p>Generating your personalised recommendations…</p>
        </div>
      )}

      {/* ── WELLNESS TAB ───────────────────────────────────────────── */}
      {!loading && activeTab === 'wellness' && (
        <>
          <div className="reco-categories">
            {WELLNESS_CATEGORIES.map(cat => {
              const count = recs.filter(r => r.category === cat).length;
              const { Icon } = getCategoryMeta(cat);
              return (
                <button key={cat}
                  className={`reco-cat-btn ${activeCategory === cat ? 'reco-cat-btn--active' : ''}`}
                  onClick={() => setActiveCategory(cat)}>
                  {cat !== 'All' && <Icon size={13} />}
                  {cat}
                  {cat !== 'All' && count > 0 && <span className="reco-cat-count">{count}</span>}
                </button>
              );
            })}
            <button
              className={`reco-cat-btn ${activeCategory === 'Saved' ? 'reco-cat-btn--active' : ''}`}
              onClick={() => setActiveCategory('Saved')}>
              <MdBookmark size={13} /> Saved
              {saved.length > 0 && <span className="reco-cat-count">{saved.length}</span>}
            </button>
          </div>

          <div className="reco-grid stagger">
            {(activeCategory === 'Saved' ? recs.filter(r => saved.includes(r.id)) : filtered).map(rec => {
              const isOpen  = expanded === rec.id;
              const isSaved = saved.includes(rec.id);
              const { Icon, color } = getCategoryMeta(rec.category);
              const match = rec.matchScore ?? rec.match ?? 0;

              return (
                <div key={rec.id} className={`reco-card card ${isOpen ? 'reco-card--expanded' : ''}`}>
                  <div className="reco-card-header">
                    <div className="reco-card-icon-wrap" style={{ background: color + '18', border: `1.5px solid ${color}30` }}>
                      <Icon size={20} style={{ color }} />
                    </div>
                    <div className="reco-card-meta">
                      <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                        <span className="reco-category-tag">{rec.category}</span>
                        {rec.difficulty && (
                          <span className="reco-difficulty-tag"
                            style={{ color: DIFFICULTY_COLOR[rec.difficulty] || '#6b7280', borderColor: (DIFFICULTY_COLOR[rec.difficulty] || '#6b7280') + '40' }}>
                            {rec.difficulty}
                          </span>
                        )}
                      </div>
                      <div className="reco-match">
                        <div className="reco-match-bar">
                          <div className="reco-match-fill" style={{ width: `${match}%` }} />
                        </div>
                        <span>{match}% match</span>
                      </div>
                    </div>
                    <button className={`reco-save-btn ${isSaved ? 'reco-save-btn--saved' : ''}`}
                      onClick={() => toggleSave(rec.id)} title={isSaved ? 'Unsave' : 'Save'}>
                      {isSaved ? <MdFavorite size={18} /> : <MdFavoriteBorder size={18} />}
                    </button>
                  </div>

                  <h3 className="reco-title">{rec.icon} {rec.title}</h3>
                  <p className="reco-summary">{rec.summary}</p>

                  {rec.whyForYou && (
                    <div className="reco-why">
                      <MdStar size={13} style={{ color: '#fbbf24', flexShrink: 0 }} />
                      <span>{rec.whyForYou}</span>
                    </div>
                  )}

                  {rec.estimatedTime && (
                    <div className="reco-time-tag"><MdAccessTime size={13} /> {rec.estimatedTime}</div>
                  )}

                  <button className="reco-expand-btn" onClick={() => setExpanded(isOpen ? null : rec.id)}>
                    {isOpen ? <><MdExpandLess size={16} /> Hide steps</> : <><MdExpandMore size={16} /> View steps</>}
                  </button>

                  {isOpen && (
                    <div className="reco-steps animate-fade-in">
                      <h4 className="reco-steps-heading">Step-by-step guide</h4>
                      {rec.steps?.map((step, i) => (
                        <div key={i} className="reco-step">
                          <span className="reco-step-num">{i + 1}</span>
                          <span className="reco-step-text">{step}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}

            {filtered.length === 0 && !loading && (
              <div className="reco-empty">
                <MdFilterList size={32} style={{ opacity: 0.3 }} />
                <p>No recommendations in this category yet.</p>
              </div>
            )}
          </div>
        </>
      )}

      {/* ── MEDIA TAB ──────────────────────────────────────────────── */}
      {!loading && activeTab === 'media' && (
        <div className="media-tab-content">
          {!hasMedia ? (
            <div className="reco-empty">
              <MdMovie size={32} style={{ opacity: 0.3 }} />
              <p>Select interests during onboarding to get movie and music recommendations.</p>
            </div>
          ) : (
            <>
              {/* Filter row */}
              <div className="media-filter-row">
                <span className="media-filter-label">Show:</span>
                {['all', 'movies', 'music'].map(f => (
                  <button key={f}
                    className={`media-filter-btn ${mediaFilter === f ? 'media-filter-btn--active' : ''}`}
                    onClick={() => setMediaFilter(f)}>
                    {f === 'all' ? 'All' : f === 'movies' ? '🎬 Movies' : '🎵 Music'}
                  </button>
                ))}
              </div>

              {/* Movies section */}
              {displayedMovies.length > 0 && (
                <div className="media-section">
                  <div className="media-section-header">
                    <MdMovie size={18} className="media-section-icon" />
                    <h3 className="media-section-title">Movies for you</h3>
                  </div>
                  {movieInterests && (
                    <p className="media-section-sub">
                      Highly rated picks based on your interests: {movieInterests}
                    </p>
                  )}
                  <div className="movies-list">
                    {displayedMovies.map((movie, i) => (
                      <MovieCard key={i} movie={movie} index={i} />
                    ))}
                  </div>
                </div>
              )}

              {/* Divider between sections when showing both */}
              {displayedMovies.length > 0 && displayedMusic.length > 0 && (
                <div className="media-section-divider" />
              )}

              {/* Music section */}
              {displayedMusic.length > 0 && (
                <div className="media-section">
                  <div className="media-section-header">
                    <MdMusicNote size={18} className="media-section-icon" />
                    <h3 className="media-section-title">Music for you</h3>
                  </div>
                  {musicInterests && (
                    <p className="media-section-sub">
                      Albums and artists matched to your interests: {musicInterests}
                    </p>
                  )}
                  <div className="music-grid">
                    {displayedMusic.map((track, i) => (
                      <MusicCard key={i} track={track} />
                    ))}
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* ── GOAL PLANS TAB ─────────────────────────────────────────── */}
      {!loading && activeTab === 'goals' && (
        <div className="goals-tab-content">
          {!hasGoals ? (
            <div className="reco-empty">
              <MdRocketLaunch size={32} style={{ opacity: 0.3 }} />
              <p>Set goals during onboarding to get personalised action plans.</p>
            </div>
          ) : (
            <>
              <div className="goals-tab-header">
                <p className="goals-tab-desc">
                  Your personalised action plans with quick wins, weekly goals, resources, and 30-day milestones — one for each goal you set.
                </p>
              </div>
              <div className="goals-list">
                {goalPlans.map((plan, i) => <GoalPlanCard key={i} plan={plan} />)}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}