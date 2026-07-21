// Worker portal: scan a barcode/QR with the camera, preview the item, and
// confirm a checkout. Each successful checkout emails the store owner.
import { useCallback, useState } from 'react';
import Navbar from '../components/Navbar.jsx';
import BarcodeScanner from '../components/BarcodeScanner.jsx';
import { api } from '../api/client.js';
import { useLang } from '../context/LanguageContext.jsx';

export default function WorkerPortal() {
  const { t } = useLang();
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [status, setStatus] = useState(null); // { type, message }
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);

  // Send a barcode to the backend to record a checkout.
  const processBarcode = useCallback(async (barcode, action = 'checkout') => {
    if (!barcode || busy) return;
    setBusy(true);
    setStatus({ type: 'info', message: t('processing', { code: barcode }) });
    try {
      const data = await api('/api/scan', {
        method: 'POST',
        body: { barcode, action, quantity: 1 },
      });
      setStatus({ type: 'success', message: data.message });
      setHistory((h) => [
        {
          id: Date.now(),
          name: data.item.name,
          barcode: data.item.barcode,
          remaining: data.item.quantity,
          notified: data.notification?.delivered || data.notification?.simulated,
          at: new Date().toLocaleTimeString(),
        },
        ...h,
      ].slice(0, 20));
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  }, [busy, t]);

  const handleDetected = useCallback(
    (text) => { processBarcode(text); },
    [processBarcode]
  );

  function handleManualSubmit(e) {
    e.preventDefault();
    const code = manualCode.trim();
    if (code) {
      processBarcode(code);
      setManualCode('');
    }
  }

  return (
    <div className="page">
      <Navbar />
      <main className="container">
        <section className="hero">
          <div className="hero__text">
            <h2 className="hero__title">{t('heroTitle')}</h2>
            <p className="hero__sub">{t('heroSub')}</p>
            <button
              className="btn hero__cta"
              onClick={() => setScanning(true)}
              disabled={scanning}
            >
              {t('heroCta')}
            </button>
          </div>
          <div className="hero__art" aria-hidden="true">🛍️</div>
        </section>

        <div className="grid grid--2">
          <section className="card">
            <div className="card__head">
              <h2>{t('scanner')}</h2>
              <button
                className={`btn ${scanning ? 'btn--danger' : 'btn--primary'}`}
                onClick={() => setScanning((s) => !s)}
              >
                {scanning ? t('stopCamera') : t('startCamera')}
              </button>
            </div>

            {scanning ? (
              <BarcodeScanner active={scanning} onDetected={handleDetected} />
            ) : (
              <div className="scanner__placeholder">
                <span className="scanner__placeholder-icon">📷</span>
                <p className="muted">{t('pressStart')}</p>
              </div>
            )}

            <form onSubmit={handleManualSubmit} className="manual">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder={t('manualPlaceholder')}
                aria-label={t('manualAria')}
              />
              <button className="btn btn--secondary" disabled={busy}>
                {t('checkOut')}
              </button>
            </form>

            {status && (
              <p className={`status status--${status.type}`}>{status.message}</p>
            )}
          </section>

          <section className="card">
            <div className="card__head">
              <h2>{t('recentScans')}</h2>
            </div>
            {history.length === 0 ? (
              <p className="muted">{t('noScans')}</p>
            ) : (
              <ul className="feed">
                {history.map((h) => (
                  <li key={h.id} className="feed__item">
                    <div>
                      <strong>{h.name}</strong>
                      <span className="muted"> · {h.barcode}</span>
                    </div>
                    <div className="feed__meta">
                      <span>{t('leftCount', { n: h.remaining })}</span>
                      <span className="muted">{h.at}</span>
                      <span title={t('ownerNotified')}>{h.notified ? '✉️' : '⚠️'}</span>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
