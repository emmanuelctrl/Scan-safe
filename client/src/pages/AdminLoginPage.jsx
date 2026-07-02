// Password gate for the app-wide Super Admin panel. Independent of the
// regular email/password login and of any store's Owner PIN.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, tokenStore } from '../api/client.js';
import { useTheme } from '../context/ThemeContext.jsx';
import { useLang } from '../context/LanguageContext.jsx';

export default function AdminLoginPage() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useLang();
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
        className="icon-btn icon-btn--lang auth__lang"
        onClick={toggleLang}
        title={t('changeLanguage')}
      >
        {lang === 'en' ? 'አማ' : 'EN'}
      </button>
      <button
        className="icon-btn auth__theme"
        onClick={toggleTheme}
        title={t('toggleTheme')}
      >
        {theme === 'light' ? '🌙' : '☀️'}
      </button>

      <div className="auth__card card">
        <div className="auth__brand">
          <span className="auth__logo">🛡️</span>
          <h1>{t('superAdmin')}</h1>
          <p className="muted">{t('adminPrompt')}</p>
        </div>

        <form onSubmit={handleSubmit} className="form">
          <label className="field">
            <span>{t('adminPassword')}</span>
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
            {busy ? t('checking') : t('enterAdmin')}
          </button>
        </form>
      </div>
    </div>
  );
}
