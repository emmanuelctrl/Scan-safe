// PIN entry screen for the Owner Portal. On success it stores the returned
// owner token and notifies the parent to reveal the portal.
import { useState } from 'react';
import { api, tokenStore } from '../../api/client.js';

export default function PinGate({ onUnlocked }) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      const { ownerToken } = await api('/api/owner/unlock', {
        method: 'POST',
        body: { pin },
      });
      tokenStore.setOwner(ownerToken);
      onUnlocked();
    } catch (err) {
      setError(err.message);
      setPin('');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="pin">
      <div className="pin__card card">
        <span className="pin__icon">🔒</span>
        <h2>Owner Portal</h2>
        <p className="muted">Enter your 6-digit PIN to continue.</p>

        <form onSubmit={handleSubmit} className="pin__form">
          <input
            className="pin__input"
            inputMode="numeric"
            autoComplete="off"
            pattern="\d{6}"
            maxLength={6}
            placeholder="••••••"
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
            autoFocus
          />
          {error && <p className="form__error">{error}</p>}
          <button
            className="btn btn--primary btn--block"
            disabled={busy || pin.length !== 6}
          >
            {busy ? 'Checking…' : 'Unlock'}
          </button>
        </form>
        <p className="muted pin__hint">Default PIN is 123456 — change it in Settings.</p>
      </div>
    </div>
  );
}
