// Login / Sign-up page. Toggles between signing in and creating an account.
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useLang } from '../context/LanguageContext.jsx';

export default function LoginPage() {
  const { login, register, loading } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useLang();
  const navigate = useNavigate();

  const [mode, setMode] = useState('login'); // 'login' | 'register'
  const [form, setForm] = useState({
    name: '', email: '', password: '', smtpUser: '', smtpPass: '',
  });
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
        const smtpUser = form.smtpUser.trim();
        const smtpPass = form.smtpPass.trim();
        await register({
          email: form.email,
          password: form.password,
          name: form.name || undefined,
          // Only sent if the owner filled both fields in.
          smtpUser: smtpUser || undefined,
          smtpPass: smtpPass || undefined,
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
          <span className="auth__logo">🛍️</span>
          <h1>{t('appName')}</h1>
          <p className="muted">{t('loginTagline')}</p>
        </div>

        <div className="auth__tabs">
          <button
            className={`auth__tab ${mode === 'login' ? 'is-active' : ''}`}
            onClick={() => { setMode('login'); setError(null); }}
            type="button"
          >
            {t('signIn')}
          </button>
          <button
            className={`auth__tab ${mode === 'register' ? 'is-active' : ''}`}
            onClick={() => { setMode('register'); setError(null); }}
            type="button"
          >
            {t('createAccount')}
          </button>
        </div>

        <form onSubmit={handleSubmit} className="form">
          {mode === 'register' && (
            <label className="field">
              <span>{t('nameLabel')} <span className="muted">({t('optional')})</span></span>
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
            <span>{t('emailLabel')}</span>
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
            <span>{t('passwordLabel')}</span>
            <input
              type="password"
              required
              minLength={mode === 'register' ? 8 : undefined}
              value={form.password}
              onChange={update('password')}
              placeholder={mode === 'register' ? t('passwordMinPlaceholder') : '••••••••'}
              autoComplete={mode === 'register' ? 'new-password' : 'current-password'}
            />
          </label>

          {mode === 'register' && (
            <div className="auth__section">
              <div className="auth__section-head">
                <span>🔔 {t('notifSetupTitle')} <span className="muted">({t('optional')})</span></span>
              </div>
              <p className="muted auth__note">
                {t('notifSetupHelp')}{' '}
                <a
                  href="https://myaccount.google.com/apppasswords"
                  target="_blank"
                  rel="noreferrer"
                >
                  {t('notifSetupLink')}
                </a>
              </p>
              <label className="field">
                <span>{t('gmailAddress')}</span>
                <input
                  type="email"
                  value={form.smtpUser}
                  onChange={update('smtpUser')}
                  placeholder="you@gmail.com"
                  autoComplete="off"
                />
              </label>
              <label className="field">
                <span>{t('gmailAppPassword')}</span>
                <input
                  type="password"
                  value={form.smtpPass}
                  onChange={update('smtpPass')}
                  placeholder="abcd efgh ijkl mnop"
                  autoComplete="off"
                />
              </label>
            </div>
          )}

          {error && <p className="form__error">{error}</p>}

          <button className="btn btn--primary btn--block" disabled={loading}>
            {loading ? t('pleaseWait') : mode === 'login' ? t('signIn') : t('createAccount')}
          </button>
        </form>

        <p className="auth__switch muted">
          {mode === 'login' ? t('noAccount') : t('alreadyRegistered')}
          <button
            className="link"
            type="button"
            onClick={() => { setMode(mode === 'login' ? 'register' : 'login'); setError(null); }}
          >
            {mode === 'login' ? t('createOne') : t('signIn')}
          </button>
        </p>

        <p className="auth__switch muted">
          <button className="link" type="button" onClick={() => navigate('/admin/login')}>
            🛡️ {t('adminLogin')}
          </button>
        </p>
      </div>
    </div>
  );
}
