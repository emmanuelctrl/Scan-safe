// Login / Sign-up page. Toggles between signing in and creating an account.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

export default function LoginPage() {
  const { login, register, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [error, setError] = useState(null);

  const update = (field) => (e) =>
    setForm((f) => ({ ...f, [field]: e.target.value }));

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    try {
      if (mode === 'login') {
        await login(form.email, form.password);
      } else {
        await register({
          email: form.email,
          password: form.password,
          name: form.name || undefined,
        });
      }
      navigate('/worker');
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="auth">
      <button
        className="icon-btn auth__theme"
        onClick={toggleTheme}
        title="Toggle theme"
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>

      <div className="auth__card card">
        <div className="auth__brand">
          <span className="auth__logo">🛍️</span>
          <h1>Inventory Tracker</h1>
          <p className="muted">Inventory management &amp; theft prevention for boutiques</p>
        </div>

        <div className="auth__tabs">
          <button
            className={`auth__tab ${mode === 'login' ? 'is-active' : ''}`}
            onClick={() => { setMode('login'); setError(null); }}
            type="button"
          >
            Sign in
          </button>
          <button
            className={`auth__tab ${mode === 'register' ? 'is-active' : ''}`}
            onClick={() => { setMode('register'); setError(null); }}
            type="button"
          >
            Create account
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form">
          {mode === 'register' && (
            <label className="field">
              <span>Name <span className="muted">(optional)</span></span>
              <input
                type="text"
                value={form.name}
                onChange={update('name')}
                placeholder="Jane Doe"
                autoComplete="name"
              />
            </label>
          )}

          <label className="field">
            <span>Email</span>
            <input
              type="email"
              required
              value={form.email}
              onChange={update('email')}
              placeholder="you@store.com"
              autoComplete="email"
            />
          </label>

          <label className="field">
            <span>Password</span>
            <input
              type="password"
              required
              minLength={mode === 'register' ? 8 : undefined}
              value={form.password}
              onChange={update('password')}
              placeholder={mode === 'register' ? 'At least 8 characters' : '••••••••'}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
          </label>

          {error && <p className="form__error">{error}</p>}

          <button className="btn btn--primary btn--block" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="auth__switch muted">
          {mode === 'login' ? "Don't have an account? " : 'Already registered? '}
          <button
            className="link"
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
          >
            {mode === 'login' ? 'Create one' : 'Sign in'}
          </button>
        </p>

        <p className="auth__switch muted">
          <button className="link" type="button" onClick={() => navigate('/admin/login')}>
            🛡️ Admin login
          </button>
        </p>
      </div>
    </div>
  );
}
