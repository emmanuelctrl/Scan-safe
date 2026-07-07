// Authentication context: tracks the logged-in user and exposes
// login / register / logout actions used across the app.
import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { api, tokenStore } from '../api/client.js';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    const raw = localStorage.getItem('it_user');
    return raw ? JSON.parse(raw) : null;
  });
  const [loading, setLoading] = useState(false);

  // Keep the cached user in sync with localStorage.
  useEffect(() => {
    if (user) localStorage.setItem('it_user', JSON.stringify(user));
    else localStorage.removeItem('it_user');
  }, [user]);

  async function login(email, password) {
    setLoading(true);
    try {
      // Clear any previous account's tokens before logging in.
      tokenStore.clear();
      tokenStore.clearOwner();
      const { token, user: u } = await api('/api/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      tokenStore.set(token);
      setUser(u);
      return u;
    } finally {
      setLoading(false);
    }
  }

  async function register(payload) {
    setLoading(true);
    try {
      // Clear any previous account's tokens before registering.
      tokenStore.clear();
      tokenStore.clearOwner();
      // Registration doesn't sign in — the account must first be activated
      // with the 6-digit code emailed to the user.
      return await api('/api/auth/register', { method: 'POST', body: payload });
    } finally {
      setLoading(false);
    }
  }

  /** Confirm the emailed 6-digit code; on success the user is signed in. */
  async function verifyEmail(email, code) {
    setLoading(true);
    try {
      const { token, user: u } = await api('/api/auth/verify', {
        method: 'POST',
        body: { email, code },
      });
      tokenStore.set(token);
      setUser(u);
      return u;
    } finally {
      setLoading(false);
    }
  }

  /** Ask the server to email a fresh verification code. */
  function resendVerification(email) {
    return api('/api/auth/resend-verification', { method: 'POST', body: { email } });
  }

  function logout() {
    tokenStore.clear();
    tokenStore.clearOwner();
    setUser(null);
  }

  const value = useMemo(
    () => ({
      user,
      loading,
      login,
      register,
      verifyEmail,
      resendVerification,
      logout,
      isAuthenticated: !!user,
    }),
    [user, loading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within an AuthProvider');
  return ctx;
}
