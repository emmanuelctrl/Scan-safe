// Owner settings: change the 6-digit PIN, change the notification email,
// toggle light/dark theme (persisted to the account on the server), and
// switch the UI language (English / Amharic, stored locally).
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useTheme } from '../../context/ThemeContext.jsx';
import { useLang } from '../../context/LanguageContext.jsx';

export default function SettingsTab() {
  const { theme, setTheme } = useTheme();
  const { lang, setLang, t } = useLang();
  const [settings, setSettings] = useState(null);

  const [pinForm, setPinForm] = useState({ currentPin: '', newPin: '', confirmPin: '' });
  const [emailForm, setEmailForm] = useState({ email: '' });
  const [smtpForm, setSmtpForm] = useState({ smtpUser: '', smtpPass: '' });
  const [pinMsg, setPinMsg] = useState(null);
  const [emailMsg, setEmailMsg] = useState(null);
  const [smtpMsg, setSmtpMsg] = useState(null);

  useEffect(() => {
    api('/api/owner/settings', { owner: true })
      .then((d) => {
        setSettings(d.settings);
        setEmailForm({ email: d.settings.notification_email });
        setSmtpForm({ smtpUser: d.settings.smtp_user || '', smtpPass: '' });
        // Keep the UI theme in sync with the stored account preference.
        if (d.settings.theme && d.settings.theme !== theme) setTheme(d.settings.theme);
      })
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function changePin(e) {
    e.preventDefault();
    setPinMsg(null);
    if (pinForm.newPin !== pinForm.confirmPin) {
      setPinMsg({ type: 'error', message: t('pinMismatch') });
      return;
    }
    try {
      await api('/api/owner/settings/pin', {
        method: 'PUT',
        owner: true,
        body: { currentPin: pinForm.currentPin, newPin: pinForm.newPin },
      });
      setPinMsg({ type: 'success', message: t('pinUpdated') });
      setPinForm({ currentPin: '', newPin: '', confirmPin: '' });
    } catch (err) {
      setPinMsg({ type: 'error', message: err.message });
    }
  }

  async function changeEmail(e) {
    e.preventDefault();
    setEmailMsg(null);
    try {
      const d = await api('/api/owner/settings/notification-email', {
        method: 'PUT',
        owner: true,
        body: { email: emailForm.email },
      });
      setSettings(d.settings);
      setEmailMsg({ type: 'success', message: t('emailUpdated') });
    } catch (err) {
      setEmailMsg({ type: 'error', message: err.message });
    }
  }

  async function saveSmtp(e) {
    e.preventDefault();
    setSmtpMsg(null);
    try {
      const d = await api('/api/owner/settings/smtp', {
        method: 'PUT',
        owner: true,
        body: { smtpUser: smtpForm.smtpUser.trim(), smtpPass: smtpForm.smtpPass.trim() },
      });
      setSettings(d.settings);
      setSmtpForm({ smtpUser: d.settings.smtp_user || '', smtpPass: '' });
      setSmtpMsg({ type: 'success', message: t('notifSaved') });
    } catch (err) {
      setSmtpMsg({ type: 'error', message: err.message });
    }
  }

  async function removeSmtp() {
    setSmtpMsg(null);
    try {
      const d = await api('/api/owner/settings/smtp', { method: 'DELETE', owner: true });
      setSettings(d.settings);
      setSmtpForm({ smtpUser: '', smtpPass: '' });
      setSmtpMsg({ type: 'success', message: t('notifRemoved') });
    } catch (err) {
      setSmtpMsg({ type: 'error', message: err.message });
    }
  }

  async function applyTheme(next) {
    setTheme(next); // Instant UI feedback.
    try {
      await api('/api/owner/settings/theme', {
        method: 'PUT',
        owner: true,
        body: { theme: next },
      });
    } catch {
      /* Non-critical: local theme already applied. */
    }
  }

  const onlyDigits = (v) => v.replace(/\D/g, '').slice(0, 6);

  return (
    <div className="settings">
      <div className="grid grid--2">
        {/* Change PIN */}
        <section className="card">
          <div className="card__head"><h3>🔑 {t('changePin')}</h3></div>
          <form onSubmit={changePin} className="form">
            <label className="field">
              <span>{t('currentPin')}</span>
              <input inputMode="numeric" maxLength={6} value={pinForm.currentPin}
                onChange={(e) => setPinForm({ ...pinForm, currentPin: onlyDigits(e.target.value) })}
                placeholder="••••••" />
            </label>
            <label className="field">
              <span>{t('newPin')}</span>
              <input inputMode="numeric" maxLength={6} value={pinForm.newPin}
                onChange={(e) => setPinForm({ ...pinForm, newPin: onlyDigits(e.target.value) })}
                placeholder={t('sixDigits')} />
            </label>
            <label className="field">
              <span>{t('confirmPin')}</span>
              <input inputMode="numeric" maxLength={6} value={pinForm.confirmPin}
                onChange={(e) => setPinForm({ ...pinForm, confirmPin: onlyDigits(e.target.value) })}
                placeholder={t('sixDigits')} />
            </label>
            {pinMsg && <p className={`status status--${pinMsg.type}`}>{pinMsg.message}</p>}
            <button className="btn btn--primary">{t('updatePin')}</button>
          </form>
        </section>

        {/* Notification email */}
        <section className="card">
          <div className="card__head"><h3>✉️ {t('notifEmail')}</h3></div>
          <p className="muted">{t('notifEmailDesc')}</p>
          <form onSubmit={changeEmail} className="form">
            <label className="field">
              <span>{t('emailAddress')}</span>
              <input type="email" required value={emailForm.email}
                onChange={(e) => setEmailForm({ email: e.target.value })}
                placeholder="owner@store.com" />
            </label>
            {emailMsg && <p className={`status status--${emailMsg.type}`}>{emailMsg.message}</p>}
            <button className="btn btn--primary">{t('saveEmail')}</button>
          </form>
        </section>
      </div>

      {/* Gmail checkout notifications */}
      <section className="card">
        <div className="card__head">
          <h3>🔔 {t('notifSetupTitle')}</h3>
          {settings?.smtp_configured && (
            <span className="badge badge--success">{t('notifOn')}</span>
          )}
        </div>
        <p className="muted">
          {t('notifSetupHelp')}{' '}
          <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noreferrer">
            {t('notifSetupLink')}
          </a>
        </p>
        <form onSubmit={saveSmtp} className="form">
          <label className="field">
            <span>{t('gmailAddress')}</span>
            <input type="email" required value={smtpForm.smtpUser}
              onChange={(e) => setSmtpForm({ ...smtpForm, smtpUser: e.target.value })}
              placeholder="you@gmail.com" autoComplete="off" />
          </label>
          <label className="field">
            <span>{t('gmailAppPassword')}</span>
            <input type="password" required value={smtpForm.smtpPass}
              onChange={(e) => setSmtpForm({ ...smtpForm, smtpPass: e.target.value })}
              placeholder={settings?.smtp_configured ? '•••• •••• •••• ••••' : 'abcd efgh ijkl mnop'}
              autoComplete="off" />
          </label>
          {smtpMsg && <p className={`status status--${smtpMsg.type}`}>{smtpMsg.message}</p>}
          <div className="row-actions">
            <button className="btn btn--primary">{t('notifSave')}</button>
            {settings?.smtp_configured && (
              <button type="button" className="btn btn--ghost" onClick={removeSmtp}>
                {t('notifRemove')}
              </button>
            )}
          </div>
        </form>
      </section>

      {/* Theme */}
      <section className="card">
        <div className="card__head"><h3>🎨 {t('appearance')}</h3></div>
        <p className="muted">{t('chooseTheme')}</p>
        <div className="theme-toggle">
          <button
            className={`theme-option ${theme === 'light' ? 'is-active' : ''}`}
            onClick={() => applyTheme('light')}
          >
            ☀️ {t('light')}
          </button>
          <button
            className={`theme-option ${theme === 'dark' ? 'is-active' : ''}`}
            onClick={() => applyTheme('dark')}
          >
            🌙 {t('dark')}
          </button>
        </div>
      </section>

      {/* Language */}
      <section className="card">
        <div className="card__head"><h3>🌐 {t('language')}</h3></div>
        <p className="muted">{t('chooseLanguage')}</p>
        <div className="theme-toggle">
          <button
            className={`theme-option ${lang === 'en' ? 'is-active' : ''}`}
            onClick={() => setLang('en')}
          >
            English
          </button>
          <button
            className={`theme-option ${lang === 'am' ? 'is-active' : ''}`}
            onClick={() => setLang('am')}
          >
            አማርኛ
          </button>
        </div>
      </section>

      {settings && (
        <p className="muted settings__meta">
          {t('lastUpdated', { date: new Date(settings.updated_at + 'Z').toLocaleString() })}
        </p>
      )}
    </div>
  );
}
