import { io } from 'socket.io-client';
import { getAccessToken } from './api';   // ← Import this

const API_BASE_URL = 'https://calmspacebackend.onrender.com';

const socket = io(`${API_BASE_URL}/chat`, {
  auth: {
    token: getAccessToken(),        // Use token from memory
  },
  transports: ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000,
  timeout: 15000,
  autoConnect: false,               // Better to connect manually after login
});

// Function to update socket token (call this after login/signup)
export const updateSocketToken = () => {
  const token = getAccessToken();
  
  if (token) {
    socket.auth.token = token;
    
    if (socket.connected) {
      socket.disconnect().connect();
    } else {
      socket.connect();
    }
  }
};

// Connect function (recommended to call after successful login)
export const connectSocket = () => {
  const token = getAccessToken();
  if (token) {
    socket.auth.token = token;
    socket.connect();
  }
};

export const disconnectSocket = () => {
  socket.disconnect();
};

// Debug logs
socket.on('connect', () => {
  console.log('✅ Socket.IO connected successfully with token');
});

socket.on('connect_error', (err) => {
  console.error('❌ Socket connection error:', err.message);
  if (err.message?.includes('401') || err.message?.includes('auth')) {
    console.warn('⚠️ Socket authentication failed - Token might be invalid or missing');
  }
});

socket.on('disconnect', (reason) => {
  console.warn('⚠️ Socket disconnected:', reason);
});

export { socket };