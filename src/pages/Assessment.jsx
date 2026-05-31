import React, { useEffect, useState } from 'react';
import { useApp } from '../contexts/AppContext';
import api from '../api.js';
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

function daysUntil(isoDate) {
  if (!isoDate) return 0;
  return Math.max(0, Math.ceil((new Date(isoDate) - Date.now()) / (1000 * 60 * 60 * 24)));
}

export default function Assessment() {
  const { assessmentResult, setAssessmentResult, lastAssessmentDate, setLastAssessmentDate } = useApp();

  const [step, setStep]           = useState('intro'); // 'intro' | 'quiz' | 'result' | 'locked'
  const [current, setCurrent]     = useState(0);
  const [answers, setAnswers]     = useState(Array(8).fill(null));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError]         = useState('');
  const [lockStatus, setLockStatus] = useState(null); // { isLocked, nextAvailableAt, lastAssessment }
  const [loadingStatus, setLoadingStatus] = useState(true);

  // Fetch lock status on mount
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
      .catch(() => {
        // If API unavailable, rely on local state
        if (assessmentResult) setStep('result');
      })
      .finally(() => setLoadingStatus(false));
  }, []);

  const handleAnswer = (value) => {
    const newAnswers = [...answers];
    newAnswers[current] = value;
    setAnswers(newAnswers);
  };

  const handleNext = () => {
    if (current < ASSESSMENT_QUESTIONS.length - 1) {
      setCurrent(c => c + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (current > 0) setCurrent(c => c - 1);
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setError('');
    try {
      const res = await api.post('/assessments/wellbeing', { answers });
      const result = res.data.result;
      setAssessmentResult(result);
      setLastAssessmentDate(result.date);
      setStep('result');
    } catch (err) {
      if (err.response?.data?.isLocked) {
        setLockStatus(err.response.data);
        setStep('locked');
      } else {
        setError(err.response?.data?.message || 'Failed to submit. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  };

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

  return (
    <div className="assessment animate-fade-in">

      {/* ── INTRO ──────────────────────────────────────────────────── */}
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

      {/* ── QUIZ ───────────────────────────────────────────────────── */}
      {step === 'quiz' && (
        <div className="assess-quiz">
          {/* Progress */}
          <div className="assess-progress-wrap card">
            <div className="assess-progress-header">
              <span className="assess-progress-label">Question {current + 1} of {ASSESSMENT_QUESTIONS.length}</span>
              <span className="assess-category-badge">{ASSESSMENT_QUESTIONS[current].category}</span>
            </div>
            <div className="progress-bar">
              <div className="progress-fill" style={{ width: `${((current + 1) / ASSESSMENT_QUESTIONS.length) * 100}%` }} />
            </div>
          </div>

          {/* Question card */}
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
              {current > 0 && (
                <button className="btn-ghost" onClick={handleBack}>← Back</button>
              )}
              <button
                className="btn-primary"
                onClick={handleNext}
                disabled={answers[current] === null || submitting}
              >
                {submitting
                  ? <span className="loading-spinner" />
                  : current < ASSESSMENT_QUESTIONS.length - 1
                    ? 'Next →'
                    : '✓ Complete Assessment'
                }
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── RESULT ─────────────────────────────────────────────────── */}
      {step === 'result' && assessmentResult && (
        <div className="assess-result">
          <div className="assess-result-card card animate-fade-in">
            <div className="assess-result-tier" style={{ background: tierBg, borderColor: tierColor + '40' }}>
              <div className="assess-tier-ring" style={{ '--tier-color': tierColor }}>
                <span className="assess-tier-label" style={{ color: tierColor }}>
                  {assessmentResult.tier}
                </span>
                <span className="assess-tier-sub">Wellbeing</span>
              </div>
            </div>

            <h2 className="assess-result-title">Your Assessment Results</h2>
            <p className="assess-result-desc">{assessmentResult.description}</p>

            {assessmentResult.score != null && (
              <div className="assess-score-bar">
                <div className="assess-score-track">
                  <div
                    className="assess-score-fill"
                    style={{ width: `${(assessmentResult.score / (assessmentResult.maxScore || 24)) * 100}%`, background: tierColor }}
                  />
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
            </div>
          </div>
        </div>
      )}

      {/* ── LOCKED ─────────────────────────────────────────────────── */}
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
                  <span className="alr-date">
                    {new Date(assessmentResult.date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                  </span>
                )}
              </div>
            )}

            <div className="assess-locked-actions">
              <button className="btn-primary" onClick={() => window.location.href = '/recommendations'}>
                View My Recommendations →
              </button>
              <button className="btn-ghost" onClick={() => window.location.href = '/journal'}>
                Log Mood Instead
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
