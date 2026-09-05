import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useApp } from '../contexts/AppContext';
import api from '../api';
import { SPIN_QUESTIONS } from '../data/spinQuestions';
import { INTEREST_OPTIONS, GOAL_OPTIONS } from '../contexts/AppContext';
import {
  MdCheckCircle, MdEmail, MdPsychology, MdAccountCircle,
  MdFavorite, MdRocketLaunch, MdVerified, MdLightMode, MdDarkMode,
  MdSettingsSuggest, MdAutoAwesome, MdArrowForward, MdArrowBack,
  MdRefresh, MdTaskAlt, MdTune, MdStar,
} from 'react-icons/md';
import './Onboarding.css';

const ALL_STEPS = [
  { id: 1, label: 'Account',      Icon: MdCheckCircle,  desc: 'Authenticated' },
  { id: 2, label: 'Verify Email', Icon: MdEmail,         desc: 'Confirm identity' },
  { id: 3, label: 'Assessment',   Icon: MdPsychology,    desc: 'Personalise experience' },
  { id: 4, label: 'Profile Setup',Icon: MdAccountCircle, desc: 'Your space' },
  { id: 5, label: 'Interests',    Icon: MdFavorite,      desc: 'Goals & preferences' },
  { id: 6, label: 'Dashboard',    Icon: MdRocketLaunch,  desc: 'You\'re ready' },
];

export default function Onboarding() {
  const {
    user, onboardingStep, setOnboardingStep, emailVerified, setEmailVerified,
    setUserInterests, setUserGoals, completeOnboarding,
  } = useApp();

  const navigate = useNavigate();

  const [verifyCode, setVerifyCode]   = useState('');
  const [verifyError, setVerifyError] = useState('');
  const [verifying, setVerifying]     = useState(false);
  const [otpTimer, setOtpTimer]       = useState(60);
  const [canResend, setCanResend]     = useState(false);
  const [resending, setResending]     = useState(false);

  const [spinStep, setSpinStep]             = useState(0);
  const [spinAnswers, setSpinAnswers]       = useState(Array(17).fill(null));
  const [submittingAssessment, setSubmittingAssessment] = useState(false);
  const [assessmentError, setAssessmentError] = useState('');

  const [spinModelResult, setSpinModelResult] = useState(null);
  const [spinShowResult, setSpinShowResult]   = useState(false);

  const [profileData, setProfileData] = useState({
    username: user?.username || user?.name || '',
    bio: user?.bio || '',
    theme: user?.theme || 'auto',
  });

  const [selectedInterests, setSelectedInterests] = useState([]);
  const [selectedGoals, setSelectedGoals]         = useState([]);
  const [transitioning, setTransitioning]         = useState(false);

  const currentStep = onboardingStep || 2;
  const MAX_INTERESTS = 8;
  const MAX_GOALS = 5;

  // Visible steps — hide email step if already verified
  const visibleSteps = emailVerified
    ? ALL_STEPS.filter(s => s.id !== 2)
    : ALL_STEPS;

  const goToStep = (step) => {
    setTransitioning(true);
    setTimeout(() => {
      setOnboardingStep(step);
      setTransitioning(false);
    }, 280);
  };

  // OTP countdown
  useEffect(() => {
    if (currentStep !== 2 || emailVerified) return;
    setOtpTimer(60);
    setCanResend(false);
    const interval = setInterval(() => {
      setOtpTimer(prev => {
        if (prev <= 1) { clearInterval(interval); setCanResend(true); return 0; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
  }, [currentStep, emailVerified]);

  // If email already verified, jump to step 3
  useEffect(() => {
    if (emailVerified && currentStep === 2) goToStep(3);
  }, [emailVerified]);

  const handleOtpChange = (e, index) => {
    const value = e.target.value.replace(/[^0-9]/g, '');
    if (!value) return;
    const newCode = verifyCode.split('');
    newCode[index] = value[0];
    const updatedCode = newCode.join('');
    setVerifyCode(updatedCode);
    setVerifyError('');
    if (value && index < 5) document.getElementById(`otp-${index + 1}`)?.focus();
    if (updatedCode.length === 6) setTimeout(() => handleVerify(updatedCode), 300);
  };

  const handleOtpKeyDown = (e, index) => {
    if (e.key === 'Backspace') {
      const newCode = verifyCode.split('');
      newCode[index] = '';
      setVerifyCode(newCode.join(''));
      if (index > 0) document.getElementById(`otp-${index - 1}`)?.focus();
    }
  };

  const handleVerify = async (code = verifyCode) => {
    if (code.length !== 6) return;
    setVerifying(true);
    setVerifyError('');
    try {
      await api.post('/auth/verify-email', { email: user?.email, code });
      setEmailVerified(true);
      goToStep(3);
    } catch (err) {
      setVerifyError(err.response?.data?.message || 'Invalid or expired code. Please try again.');
    } finally {
      setVerifying(false);
    }
  };

  const handleResendOtp = async () => {
    setResending(true);
    setVerifyError('');
    try {
      await api.post('/auth/resend-verification', { email: user?.email });
      setVerifyCode('');
      setOtpTimer(60);
      setCanResend(false);
    } catch (err) {
      setVerifyError(err.response?.data?.message || 'Failed to resend code.');
    } finally {
      setResending(false);
    }
  };

  const handleSpinAnswer = (index, value) => {
    const newAnswers = [...spinAnswers];
    newAnswers[index] = Number(value);
    setSpinAnswers(newAnswers);
  };

  const handleSpinNext = async () => {
    if (spinStep < SPIN_QUESTIONS.length - 1) {
      setSpinStep(prev => prev + 1);
    } else {
      setSubmittingAssessment(true);
      setAssessmentError('');
      try {
        const res = await api.post('/assessments/spin', { answers: spinAnswers.map(Number) });
        // Capture model result if available
        if (res.data.modelAnalysis) {
          setSpinModelResult(res.data.modelAnalysis);
          setSpinShowResult(true); // show brief result before moving on
        } else {
          goToStep(4);
        }
      } catch (err) {
        setAssessmentError(err.response?.data?.message || 'Failed to submit assessment.');
      } finally {
        setSubmittingAssessment(false);
      }
    }
  };

  const handleProfileNext = async () => {
    try {
      await api.put('/auth/profile', { bio: profileData.bio, theme: profileData.theme, username: profileData.username });
    } catch (err) {
      console.error('Profile save failed', err);
    }
    goToStep(5);
  };

  const toggleInterest = (item) => {
    setSelectedInterests(prev => {
      if (prev.includes(item)) return prev.filter(i => i !== item);
      if (prev.length < MAX_INTERESTS) return [...prev, item];
      return prev;
    });
  };

  const toggleGoal = (item) => {
    setSelectedGoals(prev => {
      if (prev.includes(item)) return prev.filter(i => i !== item);
      if (prev.length < MAX_GOALS) return [...prev, item];
      return prev;
    });
  };

  const handleInterestsNext = async () => {
    try {
      await api.put('/auth/preferences', { interests: selectedInterests, goals: selectedGoals });
      setUserInterests(selectedInterests);
      setUserGoals(selectedGoals);
      completeOnboarding();
      goToStep(6);
    } catch (err) {
      console.error('Failed to save interests and goals:', err);
      alert('Failed to save your preferences. Please try again.');
    }
  };

  const handleComplete = () => {
    completeOnboarding();
    navigate('/dashboard');
  };

  return (
    <div className="onboarding-root">
      {/* Sidebar */}
      <div className="onboarding-sidebar">
        <div className="onboard-brand">
          <MdAutoAwesome size={22} style={{ color: 'var(--teal-500)' }} />
          <span className="onboard-brand-name">MindSpace</span>
        </div>

        <div className="onboard-progress-steps">
          {visibleSteps.map((step) => {
            const isComplete = currentStep > step.id || (step.id === 2 && emailVerified);
            const isActive   = currentStep === step.id;
            const { Icon }   = step;
            return (
              <div
                key={step.id}
                className={`ob-step ${isActive ? 'ob-step--active' : ''} ${isComplete ? 'ob-step--done' : ''}`}
              >
                <div className="ob-step-connector" />
                <div className="ob-step-circle">
                  {isComplete ? <MdCheckCircle size={16} /> : <Icon size={16} />}
                </div>
                <div className="ob-step-info">
                  <div className="ob-step-label">{step.label}</div>
                  <div className="ob-step-desc">{step.desc}</div>
                </div>
              </div>
            );
          })}
        </div>

        <div className="onboard-sidebar-footer">
          <p className="onboard-tagline">Your journey to clarity begins here.</p>
        </div>
      </div>

      {/* Content */}
      <div className="onboarding-content">
        <div className={`ob-content-inner ${transitioning ? 'ob-transitioning' : 'animate-fade-in'}`}>

          {/* Step 2: Email Verification — only shown if not verified */}
          {currentStep === 2 && !emailVerified && (
            <div className="ob-step-panel">
              <div className="ob-step-icon-big">
                <MdEmail size={40} style={{ color: 'var(--teal-500)' }} />
              </div>
              <h2 className="ob-step-title">Verify your email</h2>
              <p className="ob-step-subtitle">
                We sent a 6-digit code to <strong>{user?.email}</strong>.<br />
                Enter it below to confirm your identity.
              </p>

              <div className="ob-verify-inputs">
                <div className="otp-container">
                  {Array.from({ length: 6 }).map((_, index) => (
                    <input
                      key={index}
                      id={`otp-${index}`}
                      type="text"
                      maxLength="1"
                      className="otp-input"
                      value={verifyCode[index] || ''}
                      onChange={e => handleOtpChange(e, index)}
                      onKeyDown={e => handleOtpKeyDown(e, index)}
                      autoComplete="off"
                    />
                  ))}
                </div>

                <div className="ob-otp-footer">
                  {canResend ? (
                    <button className="ob-resend-btn" onClick={handleResendOtp} disabled={resending}>
                      {resending ? <span className="loading-spinner" /> : <><MdRefresh size={15} /> Resend code</>}
                    </button>
                  ) : (
                    <div className="ob-otp-timer">
                      <span className="ob-timer-ring">
                        <svg viewBox="0 0 36 36" className="ob-timer-svg">
                          <circle cx="18" cy="18" r="15" fill="none" stroke="var(--color-border)" strokeWidth="2.5"/>
                          <circle cx="18" cy="18" r="15" fill="none" stroke="var(--teal-500)" strokeWidth="2.5"
                            strokeDasharray={`${(otpTimer / 60) * 94.2} 94.2`}
                            strokeLinecap="round" transform="rotate(-90 18 18)"
                            style={{ transition: 'stroke-dasharray 1s linear' }}
                          />
                        </svg>
                        <span className="ob-timer-num">
                          {String(Math.floor(otpTimer / 60)).padStart(2, '0')}:
                          {String(otpTimer % 60).padStart(2, '0')}
                        </span>
                      </span>
                      <span className="ob-timer-label">Resend in {otpTimer}s</span>
                    </div>
                  )}
                </div>

                {verifyError && <p className="ob-error">{verifyError}</p>}
              </div>

              <button
                className="btn-primary ob-next-btn"
                onClick={() => handleVerify()}
                disabled={verifyCode.length < 6 || verifying}
              >
                {verifying ? <span className="loading-spinner" /> : <><MdVerified size={17} /> Verify & Continue</>}
              </button>
            </div>
          )}

          {/* Step 3: SPIN Assessment */}
          {currentStep === 3 && (
            <div className="ob-step-panel">

              {/* ── Mini result screen shown after submission if model returned data ── */}
              {spinShowResult && spinModelResult ? (
                <div className="ob-spin-result animate-fade-in">
                  <div className="ob-step-icon-big">
                    <MdPsychology size={40} style={{ color: 'var(--teal-500)' }} />
                  </div>
                  <h2 className="ob-step-title">Assessment Complete 🎉</h2>
                  <p className="ob-step-subtitle">
                    Here's a quick snapshot of your social anxiety profile. Full details are on the Assessment page.
                  </p>

                  {/* Score summary */}
                  <div className="ob-spin-snapshot">
                    <div className="ob-snap-item">
                      <span className="ob-snap-val">{spinModelResult.scoring?.overall?.raw_total ?? '—'}<span className="ob-snap-max">/68</span></span>
                      <span className="ob-snap-label">Total Score</span>
                    </div>
                    <div className="ob-snap-item">
                      <span className="ob-snap-val" style={{ fontSize: '1.1rem' }}>
                        {spinModelResult.scoring?.overall?.severity?.replace(/_/g, ' ') ?? '—'}
                      </span>
                      <span className="ob-snap-label">Severity</span>
                    </div>
                    <div className="ob-snap-item">
                      <span className="ob-snap-val">{spinModelResult.scoring?.overall?.anxiety_index != null ? `${spinModelResult.scoring.overall.anxiety_index.toFixed(0)}%` : '—'}</span>
                      <span className="ob-snap-label">Anxiety Index</span>
                    </div>
                  </div>

                  {/* CBT exercise count */}
                  {spinModelResult.recommendation?.exercises?.length > 0 && (
                    <div className="ob-spin-exercises-note">
                      <MdTaskAlt size={16} style={{ color: 'var(--teal-500)', flexShrink: 0 }} />
                      <span>
                        <strong>{spinModelResult.recommendation.exercises.length} personalised CBT exercises</strong> have been unlocked for you — available on the Assessment &amp; Recommendations pages.
                      </span>
                    </div>
                  )}

                  {/* Referral notice */}
                  {spinModelResult.recommendation?.clinical_summary?.requires_professional_referral && (
                    <div className="ob-spin-referral">
                      ⚠️ Based on your score, connecting with a mental health professional could be very helpful. You'll find more guidance in your recommendations.
                    </div>
                  )}

                  <button className="btn-primary ob-next-btn" onClick={() => goToStep(4)}>
                    Continue to Profile Setup <MdArrowForward size={16} />
                  </button>
                </div>
              ) : (
                <>
                  {/* ── Quiz ── */}
                  <div className="ob-assess-header">
                    <div>
                      <div className="ob-step-icon-big">
                        <MdPsychology size={40} style={{ color: 'var(--teal-500)' }} />
                      </div>
                      <h2 className="ob-step-title">Social Phobia Inventory (SPIN)</h2>
                      <p className="ob-step-subtitle">Answer based on how you've felt in the past week.</p>
                    </div>
                    <div className="ob-assess-progress-wrap">
                      <div className="ob-assess-progress-text">Question {spinStep + 1} of {SPIN_QUESTIONS.length}</div>
                      <div className="progress-bar">
                        <div className="progress-fill" style={{ width: `${((spinStep + 1) / SPIN_QUESTIONS.length) * 100}%` }} />
                      </div>
                    </div>
                  </div>

                  <div className="ob-question-card">
                    <div className="ob-question-category">SOCIAL ANXIETY</div>
                    <h3 className="ob-question-text">{SPIN_QUESTIONS[spinStep].text}</h3>
                    <div className="ob-options">
                      {SPIN_QUESTIONS[spinStep].options.map((option, i) => (
                        <button
                          key={i}
                          className={`ob-option ${spinAnswers[spinStep] === i ? 'ob-option--selected' : ''}`}
                          onClick={() => handleSpinAnswer(spinStep, i)}
                        >
                          <span className="ob-option-radio" />
                          <span>{option}</span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {assessmentError && <p className="ob-error text-center">{assessmentError}</p>}

                  <div className="ob-assess-nav">
                    {spinStep > 0 && (
                      <button className="btn-ghost" onClick={() => setSpinStep(s => s - 1)}>
                        <MdArrowBack size={16} /> Back
                      </button>
                    )}
                    <button
                      className="btn-primary"
                      onClick={handleSpinNext}
                      disabled={submittingAssessment || spinAnswers[spinStep] == null}
                    >
                      {submittingAssessment
                        ? <span className="loading-spinner" />
                        : spinStep < SPIN_QUESTIONS.length - 1
                          ? <><span>Next Question</span> <MdArrowForward size={16} /></>
                          : <><MdTaskAlt size={16} /> Complete Assessment</>
                      }
                    </button>
                  </div>
                </>
              )}
            </div>
          )}

          {/* Step 4: Profile Setup */}
          {currentStep === 4 && (
            <div className="ob-step-panel">
              <div className="ob-step-icon-big">
                <MdAccountCircle size={40} style={{ color: 'var(--teal-500)' }} />
              </div>
              <h2 className="ob-step-title">Set up your space</h2>
              <p className="ob-step-subtitle">Personalise how MindSpace feels and looks for you.</p>

              <div className="ob-profile-form">
                <div className="ob-form-group">
                  <label className="ob-form-label">Display Name</label>
                  <input
                    className="text-input"
                    value={profileData.username}
                    onChange={e => setProfileData(p => ({ ...p, username: e.target.value }))}
                    placeholder="How should we call you?"
                  />
                </div>
                <div className="ob-form-group">
                  <label className="ob-form-label">Short bio <span className="ob-optional">(optional)</span></label>
                  <textarea
                    className="text-input" rows={3}
                    value={profileData.bio}
                    onChange={e => setProfileData(p => ({ ...p, bio: e.target.value }))}
                    placeholder="A sentence about yourself..."
                    style={{ resize: 'none' }}
                  />
                </div>
                <div className="ob-form-group">
                  <label className="ob-form-label">Preferred Theme</label>
                  <div className="ob-theme-options">
                    {[
                      { key: 'light', label: 'Light', Icon: MdLightMode },
                      { key: 'dark',  label: 'Dark',  Icon: MdDarkMode },
                      { key: 'auto',  label: 'Auto',  Icon: MdSettingsSuggest },
                    ].map(({ key, label, Icon }) => (
                      <button key={key}
                        className={`ob-theme-btn ${profileData.theme === key ? 'ob-theme-btn--active' : ''}`}
                        onClick={() => {
                          setProfileData(p => ({ ...p, theme: key }));
                          const t = key === 'auto' ? (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light') : key;
                          document.documentElement.setAttribute('data-theme', t);
                          try { localStorage.setItem('ms-theme', t); } catch {}
                        }}
                      >
                        <Icon size={15} /> {label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              <button className="btn-primary ob-next-btn" onClick={handleProfileNext}>
                Continue <MdArrowForward size={16} />
              </button>
            </div>
          )}

          {/* Step 5: Interests & Goals */}
          {currentStep === 5 && (
            <div className="ob-step-panel ob-step-panel--wide">
              <div className="ob-step-icon-big">
                <MdTune size={40} style={{ color: 'var(--teal-500)' }} />
              </div>
              <h2 className="ob-step-title">Interests, Goals & Preferences</h2>
              <p className="ob-step-subtitle">
                Select what resonates with you. This powers your AI recommendations, movie suggestions, music picks, and goal plans.
              </p>

              <div className="ob-interests-section">
                <div className="ob-section-header">
                  <h4 className="ob-section-label">
                    <MdStar size={14} style={{ color: '#fbbf24' }} /> Interests & Hobbies
                  </h4>
                  <span className="ob-limit-counter">{selectedInterests.length} / {MAX_INTERESTS}</span>
                </div>
                <div className="ob-chips-grid">
                  {INTEREST_OPTIONS.map(item => {
                    const isSelected = selectedInterests.includes(item);
                    const isDisabled = !isSelected && selectedInterests.length >= MAX_INTERESTS;
                    return (
                      <button key={item}
                        className={`chip ${isSelected ? 'chip--active' : ''} ${isDisabled ? 'chip--disabled' : ''}`}
                        onClick={() => toggleInterest(item)} disabled={isDisabled}>
                        {item}
                      </button>
                    );
                  })}
                </div>
                {selectedInterests.length >= MAX_INTERESTS && <p className="ob-limit-reached">Maximum 8 interests reached</p>}
              </div>

              <div className="ob-interests-section">
                <div className="ob-section-header">
                  <h4 className="ob-section-label">
                    <MdRocketLaunch size={14} style={{ color: 'var(--teal-500)' }} /> Goals & Priorities
                  </h4>
                  <span className="ob-limit-counter">{selectedGoals.length} / {MAX_GOALS}</span>
                </div>
                <div className="ob-chips-grid">
                  {GOAL_OPTIONS.map(item => {
                    const isSelected = selectedGoals.includes(item);
                    const isDisabled = !isSelected && selectedGoals.length >= MAX_GOALS;
                    return (
                      <button key={item}
                        className={`chip ${isSelected ? 'chip--active' : ''} ${isDisabled ? 'chip--disabled' : ''}`}
                        onClick={() => toggleGoal(item)} disabled={isDisabled}>
                        {item}
                      </button>
                    );
                  })}
                </div>
                {selectedGoals.length >= MAX_GOALS && <p className="ob-limit-reached">Maximum 5 goals reached</p>}
              </div>

              <div className="ob-selection-summary">
                {selectedInterests.length > 0 && <span className="ob-summary-chip">{selectedInterests.length} interests selected</span>}
                {selectedGoals.length > 0 && <span className="ob-summary-chip">{selectedGoals.length} goals selected</span>}
              </div>

              <button
                className="btn-primary ob-next-btn"
                onClick={handleInterestsNext}
                disabled={selectedInterests.length === 0 && selectedGoals.length === 0}
              >
                Continue to Dashboard <MdArrowForward size={16} />
              </button>
            </div>
          )}

          {/* Step 6: Done */}
          {currentStep === 6 && (
            <div className="ob-step-panel ob-step-panel--center">
              <div className="ob-done-animation">
                <div className="ob-done-circle animate-bounce-in">
                  <MdAutoAwesome size={36} style={{ color: '#fbbf24' }} />
                </div>
                <div className="ob-done-sparkles">
                  <span className="sp sp1"><MdStar size={14} /></span>
                  <span className="sp sp2"><MdAutoAwesome size={12} /></span>
                  <span className="sp sp3"><MdStar size={14} /></span>
                  <span className="sp sp4"><MdFavorite size={12} /></span>
                </div>
              </div>
              <h2 className="ob-step-title ob-done-title">
                You're all set, {user?.name?.split(' ')[0] || 'there'}!
              </h2>
              <p className="ob-step-subtitle">
                Your personalised MindSpace is ready. Movies, music, and goal action plans tailored to your interests and goals await you.
              </p>
              <div className="ob-done-stats">
                <div className="ob-done-stat">
                  <div className="ob-done-stat-val">17</div>
                  <div className="ob-done-stat-label">Questions answered</div>
                </div>
                <div className="ob-done-stat">
                  <div className="ob-done-stat-val">{selectedInterests.length || '—'}</div>
                  <div className="ob-done-stat-label">Interests mapped</div>
                </div>
                <div className="ob-done-stat">
                  <div className="ob-done-stat-val">{selectedGoals.length || '—'}</div>
                  <div className="ob-done-stat-label">Goals set</div>
                </div>
              </div>
              <button className="btn-primary ob-enter-btn animate-float" onClick={handleComplete}>
                <MdRocketLaunch size={18} /> Enter MindSpace
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}