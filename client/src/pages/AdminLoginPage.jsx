// Password gate for the app-wide Super Admin panel. Independent of the
// regular email/password login and of any store's Owner PIN.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, tokenStore } from '../api/client.js';
import { useTheme } from '../context/ThemeContext.jsx';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [password, setPassword] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { adminToken } = await api('/api/admin/login', {
        method: 'POST',
        body: { password },
      });
      tokenStore.setAdmin(adminToken);
      navigate('/admin');
    } catch (err) {
      setError(err.message);
      setPassword('');
    } finally {
      setBusy(false);
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
          <span className="auth__logo">🛡️</span>
          <h1>Super Admin</h1>
          <p className="muted">Enter the admin password to view all stores.</p>
        </div>

        <form onSubmit={handleSubmit} className="form">
          <label className="field">
            <span>Admin password</span>
            <input
              type="password"
              required
              autoFocus
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••"
              autoComplete="current-password"
            />
          </label>

          {error && <p className="form__error">{error}</p>}

          <button className="btn btn--primary btn--block" disabled={busy || !password}>
            {busy ? 'Checking…' : 'Enter admin panel'}
          </button>
        </form>
      </div>
    </div>
  );
}
