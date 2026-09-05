import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import api from '../api.js';
import { SPIN_QUESTIONS } from '../data/spinQuestions';
import './Assessment.css';

const ASSESSMENT_QUESTIONS = [
  { id: 1, category: 'Anxiety',      question: 'How often have you felt nervous, anxious, or on edge in the past two weeks?',           options: ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'] },
  { id: 2, category: 'Anxiety',      question: 'How often have you been unable to stop or control worrying?',                            options: ['Not at all', 'Several days', 'More than half the days', 'Nearly every day'] },
  { id: 3, category: 'Mood',         question: 'How would you describe your general energy levels recently?',                            options: ['Very low – I feel drained most of the time', 'Somewhat low – I often feel tired', 'Moderate – some good and bad days', 'High – I feel energised and motivated'] },
  { id: 4, category: 'Sleep',        question: 'How would you rate your sleep quality over the past two weeks?',                         options: ['Very poor – frequent disruptions', 'Poor – often wake up tired', 'Fair – okay most nights', 'Good – rested and refreshed'] },
  { id: 5, category: 'Productivity', question: 'How well are you managing your daily tasks and responsibilities?',                       options: ['Struggling – things are piling up', 'Somewhat – getting by but not thriving', 'Well – staying on top of things', 'Very well – highly organised and focused'] },
  { id: 6, category: 'Social',       question: 'How connected do you feel to the people around you?',                                   options: ['Very isolated – I feel alone most of the time', 'Somewhat isolated – limited meaningful connections', 'Moderately connected – some good relationships', 'Well connected – strong support network'] },
  { id: 7, category: 'Coping',       question: 'When you face stress or challenges, how do you typically cope?',                        options: ['Avoid or suppress it', 'Struggle but push through', 'Use some healthy strategies', 'Handle it well with good tools'] },
  { id: 8, category: 'Goals',        question: 'How clear are your personal goals and direction in life right now?',                    options: ['No clear direction', 'Somewhat unclear', 'Somewhat clear', 'Very clear and purposeful'] },
];

const TIER_COLORS = { Minimal: '#10b981', Mild: '#f59e0b', Moderate: '#f97316', High: '#ef4444' };
const TIER_BG     = { Minimal: '#10b98115', Mild: '#f59e0b15', Moderate: '#f9731615', High: '#ef444415' };

const SEVERITY_COLOR = {
  none: '#10b981', mild: '#f59e0b', moderate: '#f97316', severe: '#ef4444', very_severe: '#dc2626',
};
const SEVERITY_LABEL = {
  none: 'No Social Anxiety', mild: 'Mild', moderate: 'Moderate', severe: 'Severe', very_severe: 'Very Severe',
};

function daysUntil(isoDate) {
  if (!isoDate) return 0;
  return Math.max(0, Math.ceil((new Date(isoDate) - Date.now()) / (1000 * 60 * 60 * 24)));
}

// ── Domain score bar ────────────────────────────────────────────────────────
function DomainBar({ label, score, max, color }) {
  const pct = Math.round((score / max) * 100);
  return (
    <div className="spin-domain-row">
      <span className="spin-domain-label">{label}</span>
      <div className="spin-domain-bar">
        <div className="spin-domain-fill" style={{ width: `${pct}%`, background: color }} />
      </div>
      <span className="spin-domain-pct" style={{ color }}>{score}/{max}</span>
    </div>
  );
}

// ── CBT Exercise card ────────────────────────────────────────────────────────
function ExerciseCard({ ex }) {
  const [open, setOpen] = useState(false);
  const domainLabel = Array.isArray(ex.domain_targets) ? ex.domain_targets.join(', ') : (ex.domain || '');
  const duration = ex.duration_minutes ? `${ex.duration_minutes} min` : null;

  return (
    <div className="spin-exercise-card">
      <div className="spin-ex-header" onClick={() => setOpen(o => !o)}>
        <div>
          <span className="spin-ex-title">{ex.title}</span>
          <div className="spin-ex-meta">
            {domainLabel && <span className="spin-ex-domain">{domainLabel}</span>}
            {duration && <span className="spin-ex-dur">⏱ {duration}</span>}
            {ex.evidence_base && <span className="spin-ex-diff" title={ex.evidence_base}>📚 Evidence-based</span>}
          </div>
        </div>
        <button className="spin-ex-toggle">{open ? '▲' : '▼'}</button>
      </div>
      {open && (
        <div className="spin-ex-body animate-fade-in">
          <p className="spin-ex-desc">{ex.description}</p>
          {ex.steps && ex.steps.length > 0 && (
            <ol className="spin-ex-steps">
              {ex.steps.map((s, i) => <li key={i}>{s}</li>)}
            </ol>
          )}
          {ex.evidence_base && (
            <p className="spin-ex-rationale">📖 {ex.evidence_base}</p>
          )}
        </div>
      )}
    </div>
  );
}

export default function Assessment() {
  const { assessmentResult, setAssessmentResult, lastAssessmentDate, setLastAssessmentDate } = useApp();

  // Tab: 'wellbeing' | 'spin'
  const [activeTab, setActiveTab] = useState('wellbeing');

  // ── Wellbeing state ───────────────────────────────────────────────────────
  const [step, setStep]             = useState('intro');
  const [current, setCurrent]       = useState(0);
  const [answers, setAnswers]       = useState(Array(8).fill(null));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]           = useState('');
  const [lockStatus, setLockStatus] = useState(null);
  const [loadingStatus, setLoadingStatus] = useState(true);

  // ── SPIN state ────────────────────────────────────────────────────────────
  const [spinStep, setSpinStep]             = useState('intro'); // 'intro' | 'quiz' | 'result'
  const [spinCurrent, setSpinCurrent]       = useState(0);
  const [spinAnswers, setSpinAnswers]        = useState(Array(17).fill(null));
  const [spinSubmitting, setSpinSubmitting]  = useState(false);
  const [spinError, setSpinError]            = useState('');
  const [spinResult, setSpinResult]          = useState(null);      // { score, severity, modelAnalysis }
  const [loadingSpinLatest, setLoadingSpinLatest] = useState(false);

  // ── On mount: fetch wellbeing lock + latest SPIN ──────────────────────────
  useEffect(() => {
    api.get('/assessments/wellbeing/status')
      .then(res => {
        setLockStatus(res.data);
        if (res.data.isLocked) {
          setStep('locked');
          if (res.data.lastAssessment) {
            setAssessmentResult(res.data.lastAssessment);
            setLastAssessmentDate(res.data.lastAssessment.date);
          }
        } else if (assessmentResult) {
          setStep('result');
        }
      })
      .catch(() => { if (assessmentResult) setStep('result'); })
      .finally(() => setLoadingStatus(false));

    // Fetch latest SPIN
    setLoadingSpinLatest(true);
    api.get('/assessments/spin/latest')
      .then(res => {
        setSpinResult(res.data);
        setSpinStep('result');
      })
      .catch(() => { /* no previous SPIN — stay on intro */ })
      .finally(() => setLoadingSpinLatest(false));
  }, []);

  // ── Wellbeing handlers ────────────────────────────────────────────────────
  const handleAnswer = (value) => {
    const a = [...answers]; a[current] = value; setAnswers(a);
  };
  const handleNext = () => {
    if (current < ASSESSMENT_QUESTIONS.length - 1) setCurrent(c => c + 1);
    else handleSubmit();
  };
  const handleBack = () => { if (current > 0) setCurrent(c => c - 1); };

  const handleSubmit = async () => {
    setSubmitting(true); setError('');
    try {
      const res = await api.post('/assessments/wellbeing', { answers });
      const result = res.data.result;
      setAssessmentResult(result);
      setLastAssessmentDate(result.date);
      setStep('result');
    } catch (err) {
      if (err.response?.data?.isLocked) { setLockStatus(err.response.data); setStep('locked'); }
      else setError(err.response?.data?.message || 'Failed to submit. Please try again.');
    } finally { setSubmitting(false); }
  };

  // ── SPIN handlers ─────────────────────────────────────────────────────────
  const handleSpinAnswer = (value) => {
    const a = [...spinAnswers]; a[spinCurrent] = value; setSpinAnswers(a);
  };
  const handleSpinNext = () => {
    if (spinCurrent < SPIN_QUESTIONS.length - 1) setSpinCurrent(c => c + 1);
    else handleSpinSubmit();
  };
  const handleSpinBack = () => { if (spinCurrent > 0) setSpinCurrent(c => c - 1); };

  const handleSpinSubmit = async () => {
    setSpinSubmitting(true); setSpinError('');
    try {
      const res = await api.post('/assessments/spin', { answers: spinAnswers });
      setSpinResult(res.data);
      setSpinStep('result');
    } catch (err) {
      setSpinError(err.response?.data?.message || 'Failed to submit. Please try again.');
    } finally { setSpinSubmitting(false); }
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (loadingStatus) {
    return (
      <div className="assessment animate-fade-in">
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-muted)' }}>
          Loading assessment status…
        </div>
      </div>
    );
  }

  const tierColor = TIER_COLORS[assessmentResult?.tier] || '#10b981';
  const tierBg    = TIER_BG[assessmentResult?.tier]    || '#10b98115';

  // SPIN result helpers
  const spinSeverity  = spinResult?.severity || 'none';
  const spinScore     = spinResult?.score ?? 0;
  const spinModel     = spinResult?.modelAnalysis || null;
  const spinColor     = SEVERITY_COLOR[spinSeverity] || '#10b981';
  const spinLabel     = SEVERITY_LABEL[spinSeverity] || 'No Social Anxiety';

  const domainScores  = spinModel?.scoring?.domains || null;
  const anxietyIndex  = spinModel?.scoring?.overall?.anxiety_index ?? null;
  const exercises     = spinModel?.recommendation?.exercises || [];
  const referral      = spinModel?.recommendation?.clinical_summary?.requires_professional_referral ?? false;

  return (
    <div className="assessment animate-fade-in">

      {/* ── Tab switcher ─────────────────────────────────────────────────── */}
      <div className="assess-tab-row">
        <button
          className={`assess-tab-btn ${activeTab === 'wellbeing' ? 'assess-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('wellbeing')}
        >
          🧠 Wellbeing Check-in
        </button>
        <button
          className={`assess-tab-btn ${activeTab === 'spin' ? 'assess-tab-btn--active' : ''}`}
          onClick={() => setActiveTab('spin')}
        >
          🔬 Social Anxiety (SPIN)
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  WELLBEING TAB                                                    */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'wellbeing' && (
        <>
          {step === 'intro' && (
            <div className="assess-intro card">
              <div className="assess-intro-icon">🧠</div>
              <h1 className="assess-intro-title">Wellbeing Assessment</h1>
              <p className="assess-intro-desc">
                8 questions across anxiety, mood, sleep, productivity, social connection, coping, and goal clarity.
                This takes about 3 minutes and helps calibrate all your recommendations.
              </p>
              <div className="assess-intro-note">
                📅 This assessment can be taken <strong>once every 2 weeks</strong> for accurate tracking.
              </div>
              <div className="assess-intro-stats">
                <div className="ais-stat"><span className="ais-val">8</span><span className="ais-label">Questions</span></div>
                <div className="ais-stat"><span className="ais-val">~3</span><span className="ais-label">Minutes</span></div>
                <div className="ais-stat"><span className="ais-val">4</span><span className="ais-label">Wellness areas</span></div>
              </div>
              <button className="btn-primary assess-start-btn" onClick={() => setStep('quiz')}>
                Start Assessment →
              </button>
            </div>
          )}

          {step === 'quiz' && (
            <div className="assess-quiz">
              <div className="assess-progress-wrap card">
                <div className="assess-progress-header">
                  <span className="assess-progress-label">Question {current + 1} of {ASSESSMENT_QUESTIONS.length}</span>
                  <span className="assess-category-badge">{ASSESSMENT_QUESTIONS[current].category}</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${((current + 1) / ASSESSMENT_QUESTIONS.length) * 100}%` }} />
                </div>
              </div>

              <div className="assess-question-card card animate-fade-in" key={current}>
                <h2 className="assess-question-text">{ASSESSMENT_QUESTIONS[current].question}</h2>
                <div className="assess-options">
                  {ASSESSMENT_QUESTIONS[current].options.map((option, i) => (
                    <button
                      key={i}
                      className={`assess-option ${answers[current] === i ? 'assess-option--selected' : ''}`}
                      onClick={() => handleAnswer(i)}
                    >
                      <span className="assess-option-radio" />
                      <span>{option}</span>
                      <span className="assess-option-score">{i}</span>
                    </button>
                  ))}
                </div>
                {error && <p className="assess-error">{error}</p>}
                <div className="assess-nav">
                  {current > 0 && <button className="btn-ghost" onClick={handleBack}>← Back</button>}
                  <button className="btn-primary" onClick={handleNext} disabled={answers[current] === null || submitting}>
                    {submitting ? <span className="loading-spinner" /> : current < ASSESSMENT_QUESTIONS.length - 1 ? 'Next →' : '✓ Complete Assessment'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'result' && assessmentResult && (
            <div className="assess-result">
              <div className="assess-result-card card animate-fade-in">
                <div className="assess-result-tier" style={{ background: tierBg, borderColor: tierColor + '40' }}>
                  <div className="assess-tier-ring" style={{ '--tier-color': tierColor }}>
                    <span className="assess-tier-label" style={{ color: tierColor }}>{assessmentResult.tier}</span>
                    <span className="assess-tier-sub">Wellbeing</span>
                  </div>
                </div>
                <h2 className="assess-result-title">Your Assessment Results</h2>
                <p className="assess-result-desc">{assessmentResult.description}</p>
                {assessmentResult.score != null && (
                  <div className="assess-score-bar">
                    <div className="assess-score-track">
                      <div className="assess-score-fill" style={{ width: `${(assessmentResult.score / (assessmentResult.maxScore || 24)) * 100}%`, background: tierColor }} />
                    </div>
                    <span className="assess-score-label">{assessmentResult.score} / {assessmentResult.maxScore || 24}</span>
                  </div>
                )}
                <div className="assess-result-note">
                  <span className="assess-lock-icon">🔒</span>
                  <span>This assessment is now locked for <strong>2 weeks</strong> to ensure accurate longitudinal tracking.</span>
                </div>
                {assessmentResult.date && (
                  <p className="assess-date-taken">
                    Taken on {new Date(assessmentResult.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                )}
                <div className="assess-result-actions">
                  <button className="btn-primary" onClick={() => window.location.href = '/recommendations'}>
                    View Recommendations →
                  </button>
                  <button className="btn-ghost" onClick={() => setActiveTab('spin')}>
                    Take SPIN Assessment →
                  </button>
                </div>
              </div>
            </div>
          )}

          {step === 'locked' && (
            <div className="assess-locked">
              <div className="assess-locked-card card animate-fade-in">
                <div className="assess-locked-icon">🔒</div>
                <h2 className="assess-locked-title">Assessment Locked</h2>
                <p className="assess-locked-desc">
                  You've already completed your wellbeing assessment. To ensure accurate tracking and meaningful progress data,
                  this assessment is available once every <strong>2 weeks</strong>.
                </p>
                {lockStatus?.nextAvailableAt && (
                  <div className="assess-countdown">
                    <div className="assess-countdown-num">{daysUntil(lockStatus.nextAvailableAt)}</div>
                    <div className="assess-countdown-label">days until next assessment</div>
                    <div className="assess-countdown-date">
                      Available from {new Date(lockStatus.nextAvailableAt).toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                    </div>
                  </div>
                )}
                {assessmentResult && (
                  <div className="assess-last-result" style={{ background: tierBg, borderColor: tierColor + '40' }}>
                    <h4 className="alr-title">Your Last Result</h4>
                    <div className="alr-tier" style={{ color: tierColor }}>{assessmentResult.tier} Wellbeing</div>
                    <p className="alr-desc">{assessmentResult.description}</p>
                    {assessmentResult.date && (
                      <span className="alr-date">{new Date(assessmentResult.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}</span>
                    )}
                  </div>
                )}
                <div className="assess-locked-actions">
                  <button className="btn-primary" onClick={() => window.location.href = '/recommendations'}>
                    View My Recommendations →
                  </button>
                  <button className="btn-ghost" onClick={() => setActiveTab('spin')}>
                    Take SPIN Assessment →
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════════════════ */}
      {/*  SPIN TAB                                                         */}
      {/* ══════════════════════════════════════════════════════════════════ */}
      {activeTab === 'spin' && (
        <>
          {loadingSpinLatest && (
            <div style={{ padding: 60, textAlign: 'center', color: 'var(--color-text-muted)' }}>
              Loading SPIN results…
            </div>
          )}

          {!loadingSpinLatest && spinStep === 'intro' && (
            <div className="assess-intro card">
              <div className="assess-intro-icon">🔬</div>
              <h1 className="assess-intro-title">Social Phobia Inventory (SPIN)</h1>
              <p className="assess-intro-desc">
                The gold-standard 17-question clinical tool for measuring social anxiety. Powered by our AI pipeline,
                it gives you detailed domain scores (cognitive, behavioural, physiological) and personalised CBT exercises.
              </p>
              <div className="assess-intro-stats">
                <div className="ais-stat"><span className="ais-val">17</span><span className="ais-label">Questions</span></div>
                <div className="ais-stat"><span className="ais-val">~5</span><span className="ais-label">Minutes</span></div>
                <div className="ais-stat"><span className="ais-val">3</span><span className="ais-label">Domains</span></div>
              </div>
              <button className="btn-primary assess-start-btn" onClick={() => setSpinStep('quiz')}>
                Start SPIN Assessment →
              </button>
            </div>
          )}

          {!loadingSpinLatest && spinStep === 'quiz' && (
            <div className="assess-quiz">
              <div className="assess-progress-wrap card">
                <div className="assess-progress-header">
                  <span className="assess-progress-label">Question {spinCurrent + 1} of {SPIN_QUESTIONS.length}</span>
                  <span className="assess-category-badge">Social Anxiety</span>
                </div>
                <div className="progress-bar">
                  <div className="progress-fill" style={{ width: `${((spinCurrent + 1) / SPIN_QUESTIONS.length) * 100}%` }} />
                </div>
              </div>

              <div className="assess-question-card card animate-fade-in" key={spinCurrent}>
                <h2 className="assess-question-text">{SPIN_QUESTIONS[spinCurrent].text}</h2>
                <div className="assess-options">
                  {SPIN_QUESTIONS[spinCurrent].options.map((option, i) => (
                    <button
                      key={i}
                      className={`assess-option ${spinAnswers[spinCurrent] === i ? 'assess-option--selected' : ''}`}
                      onClick={() => handleSpinAnswer(i)}
                    >
                      <span className="assess-option-radio" />
                      <span>{option}</span>
                      <span className="assess-option-score">{i}</span>
                    </button>
                  ))}
                </div>
                {spinError && <p className="assess-error">{spinError}</p>}
                <div className="assess-nav">
                  {spinCurrent > 0 && <button className="btn-ghost" onClick={handleSpinBack}>← Back</button>}
                  <button className="btn-primary" onClick={handleSpinNext} disabled={spinAnswers[spinCurrent] === null || spinSubmitting}>
                    {spinSubmitting
                      ? <span className="loading-spinner" />
                      : spinCurrent < SPIN_QUESTIONS.length - 1 ? 'Next →' : '✓ Get My Analysis'}
                  </button>
                </div>
              </div>
            </div>
          )}

          {!loadingSpinLatest && spinStep === 'result' && spinResult && (
            <div className="assess-result">
              <div className="spin-result-card card animate-fade-in">

                {/* Score header */}
                <div className="spin-result-header" style={{ background: spinColor + '18', borderColor: spinColor + '40' }}>
                  <div className="spin-score-circle" style={{ borderColor: spinColor }}>
                    <span className="spin-score-num" style={{ color: spinColor }}>{spinScore}</span>
                    <span className="spin-score-max">/68</span>
                  </div>
                  <div className="spin-severity-info">
                    <h2 className="spin-severity-label" style={{ color: spinColor }}>{spinLabel}</h2>
                    <p className="spin-severity-sub">Social Anxiety Level</p>
                    {anxietyIndex !== null && (
                      <p className="spin-anxiety-index">Anxiety Index: <strong style={{ color: spinColor }}>{anxietyIndex.toFixed(1)}%</strong></p>
                    )}
                  </div>
                </div>

                {/* Referral flag */}
                {referral && (
                  <div className="spin-referral-flag">
                    ⚠️ <strong>Professional support recommended.</strong> Based on your score, speaking with a mental health professional could be very beneficial.
                  </div>
                )}

                {/* Domain scores */}
                {domainScores && (
                  <div className="spin-domains card">
                    <h3 className="spin-section-title">Domain Breakdown</h3>
                    <DomainBar label="Cognitive (Fear of evaluation)" score={domainScores.cognitive?.raw_score ?? 0} max={domainScores.cognitive?.max_score ?? 32} color="#8b5cf6" />
                    <DomainBar label="Behavioural (Avoidance)"        score={domainScores.behavioral?.raw_score ?? 0} max={domainScores.behavioral?.max_score ?? 20} color="#3b82f6" />
                    <DomainBar label="Physiological (Somatic)"        score={domainScores.physiological?.raw_score ?? 0} max={domainScores.physiological?.max_score ?? 16} color="#ec4899" />
                  </div>
                )}

                {/* CBT Exercises */}
                {exercises.length > 0 && (
                  <div className="spin-exercises">
                    <h3 className="spin-section-title">Your Personalised CBT Exercises</h3>
                    <p className="spin-exercises-sub">Tailored to your severity level and domain scores.</p>
                    {exercises.map((ex, i) => <ExerciseCard key={i} ex={ex} />)}
                  </div>
                )}

                {/* Retake */}
                <div className="spin-result-actions">
                  <button className="btn-ghost" onClick={() => {
                    setSpinAnswers(Array(17).fill(null));
                    setSpinCurrent(0);
                    setSpinStep('quiz');
                  }}>
                    Retake Assessment
                  </button>
                  <button className="btn-primary" onClick={() => window.location.href = '/recommendations'}>
                    View Recommendations →
                  </button>
                </div>

                {spinResult.date && (
                  <p className="assess-date-taken" style={{ marginTop: 12 }}>
                    Taken on {new Date(spinResult.date).toLocaleDateString('en-US', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
                  </p>
                )}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}