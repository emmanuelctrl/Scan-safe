// Owner settings: change the 6-digit PIN, change the notification email, and
// toggle light/dark theme (persisted to the account on the server).
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useTheme } from '../../context/ThemeContext.jsx';

export default function SettingsTab() {
  const { theme, setTheme } = useTheme();
  const [settings, setSettings] = useState(null);

  const [pinForm, setPinForm] = useState({ currentPin: '', newPin: '', confirmPin: '' });
  const [emailForm, setEmailForm] = useState({ email: '' });
  const [pinMsg, setPinMsg] = useState(null);
  const [emailMsg, setEmailMsg] = useState(null);

  useEffect(() => {
    api('/api/owner/settings', { owner: true })
      .then((d) => {
        setSettings(d.settings);
        setEmailForm({ email: d.settings.notification_email });
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
      setPinMsg({ type: 'error', message: 'New PIN and confirmation do not match.' });
      return;
    }
    try {
      await api('/api/owner/settings/pin', {
        method: 'PUT',
        owner: true,
        body: { currentPin: pinForm.currentPin, newPin: pinForm.newPin },
      });
      setPinMsg({ type: 'success', message: 'PIN updated successfully.' });
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
      setEmailMsg({ type: 'success', message: 'Notification email updated.' });
    } catch (err) {
      setEmailMsg({ type: 'error', message: err.message });
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
          <div className="card__head"><h3>🔑 Change owner PIN</h3></div>
          <form onSubmit={changePin} className="form">
            <label className="field">
              <span>Current PIN</span>
              <input inputMode="numeric" maxLength={6} value={pinForm.currentPin}
                onChange={(e) => setPinForm({ ...pinForm, currentPin: onlyDigits(e.target.value) })}
                placeholder="••••••" />
            </label>
            <label className="field">
              <span>New PIN</span>
              <input inputMode="numeric" maxLength={6} value={pinForm.newPin}
                onChange={(e) => setPinForm({ ...pinForm, newPin: onlyDigits(e.target.value) })}
                placeholder="6 digits" />
            </label>
            <label className="field">
              <span>Confirm new PIN</span>
              <input inputMode="numeric" maxLength={6} value={pinForm.confirmPin}
                onChange={(e) => setPinForm({ ...pinForm, confirmPin: onlyDigits(e.target.value) })}
                placeholder="6 digits" />
            </label>
            {pinMsg && <p className={`status status--${pinMsg.type}`}>{pinMsg.message}</p>}
            <button className="btn btn--primary">Update PIN</button>
          </form>
        </section>

        {/* Notification email */}
        <section className="card">
          <div className="card__head"><h3>✉️ Notification email</h3></div>
          <p className="muted">Scan/checkout alerts are sent to this address.</p>
          <form onSubmit={changeEmail} className="form">
            <label className="field">
              <span>Email address</span>
              <input type="email" required value={emailForm.email}
                onChange={(e) => setEmailForm({ email: e.target.value })}
                placeholder="owner@store.com" />
            </label>
            {emailMsg && <p className={`status status--${emailMsg.type}`}>{emailMsg.message}</p>}
            <button className="btn btn--primary">Save email</button>
          </form>
        </section>
      </div>

      {/* Theme */}
      <section className="card">
        <div className="card__head"><h3>🎨 Appearance</h3></div>
        <p className="muted">Choose your portal theme.</p>
        <div className="theme-toggle">
          <button
            className={`theme-option ${theme === 'light' ? 'is-active' : ''}`}
            onClick={() => applyTheme('light')}
          >
            ☀️ Light
          </button>
          <button
            className={`theme-option ${theme === 'dark' ? 'is-active' : ''}`}
            onClick={() => applyTheme('dark')}
          >
            🌙 Dark
          </button>
        </div>
      </section>

      {settings && (
        <p className="muted settings__meta">
          Last updated: {new Date(settings.updated_at + 'Z').toLocaleString()}
        </p>
      )}
    </div>
  );
}
