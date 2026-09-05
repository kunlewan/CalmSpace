// src/api.js
import axios from 'axios';

const BASE_URL = 'http://localhost:5000/api';

const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true,
  timeout: 20000,
  headers: {
    'Content-Type': 'application/json',
  },
});

let accessToken = null;

export const setAccessToken = (token) => {
  accessToken = token;
};

export const getAccessToken = () => accessToken;

export const clearTokens = () => {
  accessToken = null;
};

// Request Interceptor
api.interceptors.request.use(
  (config) => {
    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }
    return config;
  },
  (error) => Promise.reject(error)
);

// Response Interceptor with Refresh Token Logic
api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        const res = await axios.post(
          `${BASE_URL}/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const newAccessToken = res.data.accessToken;
        if (newAccessToken) {
          setAccessToken(newAccessToken);
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`;
          return api(originalRequest);
        }
      } catch (refreshError) {
        clearTokens();
        window.location.href = '/auth/login';
        return Promise.reject(refreshError);
      }
    }

    const message = error.response?.data?.message || error.message || 'Something went wrong';
    return Promise.reject(new Error(message));
  }
);

// ─────────────────────────────────────────────────────────────────────────────
// SPIN / Social Anxiety Model helpers
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Fetch the 17 SPIN question items from the backend
 * (which proxies the Python model's /items endpoint).
 * Falls back gracefully when the model is offline.
 */
export const fetchSpinItems = () => api.get('/assessments/spin/items');

/**
 * Submit 17 SPIN answers (0-4 each).
 * Returns { score, severity, scoring, recommendation } when model is online,
 * or { score, severity } when model is offline.
 */
export const submitSpin = (answers) =>
  api.post('/assessments/spin', { answers });

/**
 * Get the latest SPIN assessment for the current user.
 */
export const getLatestSpin = () => api.get('/assessments/spin/latest');

/**
 * Check whether the Python model is reachable.
 * Returns { online: true } or { online: false }.
 */
export const checkModelHealth = () =>
  api.get('/assessments/model/health').then((r) => r.data).catch(() => ({ online: false }));

export default api;