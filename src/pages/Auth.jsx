import React, { useState, useEffect, useRef } from "react";
import { useNavigate, Link, Navigate } from "react-router-dom";
import { useApp } from "../contexts/AppContext";
import api, { setAccessToken } from "../api.js";
import "./Auth.css";

const QUOTES = [
  { text: "Your quiet space for mental clarity.", author: "MindSpace" },
  { text: "Almost everything will work again if you unplug it for a few minutes.", author: "Anne Lamott" },
  { text: "You don't have to control your thoughts. You just have to stop letting them control you.", author: "Dan Millman" },
  { text: "Within you, there is a stillness and a sanctuary to which you can retreat.", author: "Hermann Hesse" },
  { text: "Breathe. You are going to be okay.", author: "Unknown" },
];

const TICKER_ITEMS = ["Private", "Anonymous", "Secure", "Free forever", "No ads", "Your space"];

function LeftPanel({ mode, onModeChange }) {
  const [current, setCurrent] = useState(0);
  const timerRef = useRef(null);

  const goTo = (n) => {
    setCurrent(n);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => setCurrent((c) => (c + 1) % QUOTES.length), 4000);
  };

  useEffect(() => {
    timerRef.current = setInterval(() => setCurrent((c) => (c + 1) % QUOTES.length), 4000);
    return () => clearInterval(timerRef.current);
  }, []);

  const doubled = [...TICKER_ITEMS, ...TICKER_ITEMS];

  return (
    <div className="auth-left">
      <div className="auth-left-inner">
        <div className="auth-tab-switch">
          <button className={`auth-tab-btn${mode === "login" ? " active" : ""}`} onClick={() => onModeChange("login")}>Sign in</button>
          <button className={`auth-tab-btn${mode === "signup" ? " active" : ""}`} onClick={() => onModeChange("signup")}>New account</button>
        </div>

        <div className="quotes-container">
          {QUOTES.map((q, i) => (
            <div key={i} className={`quote-slide${i === current ? " active" : ""}`}>
              <div className="auth-quote-mark">"</div>
              <h1 className="auth-tagline">{q.text}</h1>
              <p className="auth-quote-author">— {q.author}</p>
            </div>
          ))}
        </div>

        <div className="auth-dots">
          {QUOTES.map((_, i) => (
            <button key={i} className={`dot${i === current ? " dot--active" : ""}`} onClick={() => goTo(i)} aria-label={`Quote ${i + 1}`} />
          ))}
        </div>

        <div className="ticker-bar">
          <div className="ticker-track">
            {doubled.map((item, idx) => (
              <span key={idx} className="ticker-item"><span className="ticker-dot" />{item}</span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export function LoginPage() {
  const { user, login, onboardingStep } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({ email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  if (user) {
    return <Navigate to={user.onboardingCompleted ? "/dashboard" : "/onboarding"} replace />;
  }

  const handleModeChange = (m) => { if (m === "signup") navigate("/auth/signup"); };

 const handleSubmit = async (e) => {
  e.preventDefault();
  if (submitting) return;
  if (!form.email || !form.password) { setError("Please fill in all fields."); return; }

  setSubmitting(true);
  setLoading(true);
  setError("");

  try {
    const email = form.email.trim().toLowerCase();
    const response = await api.post("/auth/login", { email, password: form.password });
    const { accessToken, user: userData } = response.data;

    if (accessToken) setAccessToken(accessToken);
    login(userData, accessToken);

    // Use the API response directly — onboardingStep state update is async so
    // reading it here would give the stale value (0). Use userData instead.
    if (userData.onboardingCompleted) {
      navigate("/dashboard", { replace: true });
    } else {
      navigate("/onboarding", { replace: true });
    }

  } catch (err) {
    // ── Email not verified ──────────────────────────────────────
    if (err.response?.status === 403 && err.response?.data?.needsVerification) {
      navigate("/auth/verify-email", { 
        state: { email: form.email.trim().toLowerCase() } 
      });
      return;
    }
    // ── Other errors ────────────────────────────────────────────
    if (err.response?.status === 429) {
      setError("Too many login attempts. Please wait a few minutes before trying again.");
    } else if (err.message?.includes("Network Error") || err.code === "ERR_NETWORK") {
      setError("Cannot connect to server. Please check your connection or try again later.");
    } else {
      setError(err.response?.data?.message || err.message || "Invalid email or password");
    }
  } finally {
    setLoading(false);
    setSubmitting(false);
  }
};

  return (
    <div className="auth-split">
      <LeftPanel mode="login" onModeChange={handleModeChange} />
      <div className="auth-right">
        <div className="auth-form-wrapper animate-fade-in">
          <div className="auth-brand">
            <span className="auth-brand-mark">◈</span>
            <span className="auth-brand-name">MindSpace</span>
          </div>
          <h2 className="auth-title">Welcome back</h2>
          <p className="auth-desc">Sign in to your private wellness space.</p>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">Email address</label>
              <input className="text-input" type="email" placeholder="you@example.com"
                value={form.email}
                onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); setError(""); }} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="text-input" type="password" placeholder="••••••••"
                value={form.password}
                onChange={(e) => { setForm((f) => ({ ...f, password: e.target.value })); setError(""); }} />
            </div>
            <button className="btn-primary auth-submit" type="submit" disabled={loading || submitting}>
              {loading ? <span className="loading-spinner" /> : "Sign in →"}
            </button>
          </form>

          <p className="auth-switch">Don't have an account?{" "}<Link to="/auth/signup" className="auth-link">Create one</Link></p>
        </div>
      </div>
    </div>
  );
}

export function SignupPage() {
  const { user, login } = useApp();
  const navigate = useNavigate();
  const [form, setForm] = useState({ fullname: "", username: "", email: "", password: "" });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  if (user) return <Navigate to="/onboarding" replace />;

  const handleModeChange = (m) => { if (m === "login") navigate("/auth/login"); };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.fullname || !form.username || !form.email || !form.password) {
      setError("Please fill in all fields."); return;
    }
    if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }

    setLoading(true);
    setError("");

    try {
      const response = await api.post("/auth/register", {
        fullname: form.fullname.trim(),
        username: form.username.trim(),
        email: form.email.trim().toLowerCase(),
        password: form.password,
      });

      const { accessToken, user: userData } = response.data;

      // ── IMPORTANT: set token FIRST, then login() ──
      if (accessToken) setAccessToken(accessToken);

      login(userData, accessToken);


      navigate("/onboarding", { replace: true });
    } catch (err) {
      console.error(err);
      if (err.code === "ECONNABORTED" || err.message?.includes("timeout")) {
        setError("Request timed out. Server might be slow. Try again.");
      } else {
        setError(err.message || "Failed to create account");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-split">
      <LeftPanel mode="signup" onModeChange={handleModeChange} />
      <div className="auth-right">
        <div className="auth-form-wrapper animate-fade-in">
          <div className="auth-brand">
            <span className="auth-brand-mark">◈</span>
            <span className="auth-brand-name">MindSpace</span>
          </div>
          <h2 className="auth-title">Create your account</h2>
          <p className="auth-desc">Free, private, and always anonymous.</p>

          {error && <div className="auth-error">{error}</div>}

          <form onSubmit={handleSubmit} className="auth-form">
            <div className="form-group">
              <label className="form-label">Full name</label>
              <input className="text-input" type="text" placeholder="What is your full name?"
                value={form.fullname}
                onChange={(e) => { setForm((f) => ({ ...f, fullname: e.target.value })); setError(""); }} />
            </div>
            <div className="form-group">
              <label className="form-label">Display name</label>
              <input className="text-input" type="text" placeholder="How should we call you?"
                value={form.username}
                onChange={(e) => { setForm((f) => ({ ...f, username: e.target.value })); setError(""); }} />
            </div>
            <div className="form-group">
              <label className="form-label">Email address</label>
              <input className="text-input" type="email" placeholder="you@example.com"
                value={form.email}
                onChange={(e) => { setForm((f) => ({ ...f, email: e.target.value })); setError(""); }} />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input className="text-input" type="password" placeholder="At least 6 characters"
                value={form.password}
                onChange={(e) => { setForm((f) => ({ ...f, password: e.target.value })); setError(""); }} />
            </div>
            <button className="btn-primary auth-submit" type="submit" disabled={loading}>
              {loading ? <span className="loading-spinner" /> : "Create account →"}
            </button>
          </form>

          <p className="auth-switch">Already have an account?{" "}<Link to="/auth/login" className="auth-link">Sign in</Link></p>
        </div>
      </div>
    </div>
  );
}