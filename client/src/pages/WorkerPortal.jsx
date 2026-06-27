// Worker portal: scan a barcode/QR with the camera, preview the item, and
// confirm a checkout. Each successful checkout emails the store owner.
import { useCallback, useState } from 'react';
import Navbar from '../components/Navbar.jsx';
import BarcodeScanner from '../components/BarcodeScanner.jsx';
import { api } from '../api/client.js';

export default function WorkerPortal() {
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [status, setStatus] = useState(null); // { type, message }
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);

  // Send a barcode to the backend to record a checkout.
  const processBarcode = useCallback(async (barcode, action = 'checkout') => {
    if (!barcode || busy) return;
    setBusy(true);
    setStatus({ type: 'info', message: `Processing ${barcode}…` });
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
  }, [busy]);

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
        <div className="page__head">
          <h1>Worker Portal</h1>
          <p className="muted">
            Scan an item's barcode or QR code to check it out. The owner is
            notified automatically.
          </p>
        </div>

        <div className="grid grid--2">
          <section className="card">
            <div className="card__head">
              <h2>Scanner</h2>
              <button
                className={`btn ${scanning ? 'btn--danger' : 'btn--primary'}`}
                onClick={() => setScanning((s) => !s)}
              >
                {scanning ? 'Stop camera' : 'Start camera'}
              </button>
            </div>

            {scanning ? (
              <BarcodeScanner active={scanning} onDetected={handleDetected} />
            ) : (
              <div className="scanner__placeholder">
                <span className="scanner__placeholder-icon">📷</span>
                <p className="muted">Press “Start camera” to begin scanning.</p>
              </div>
            )}

            <form onSubmit={handleManualSubmit} className="manual">
              <input
                type="text"
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="…or type a barcode manually"
                aria-label="Enter barcode manually"
              />
              <button className="btn btn--secondary" disabled={busy}>
                Check out
              </button>
            </form>

            {status && (
              <p className={`status status--${status.type}`}>{status.message}</p>
            )}
          </section>

          <section className="card">
            <div className="card__head">
              <h2>Recent scans</h2>
            </div>
            {history.length === 0 ? (
              <p className="muted">No scans yet this session.</p>
            ) : (
              <ul className="feed">
                {history.map((h) => (
                  <li key={h.id} className="feed__item">
                    <div>
                      <strong>{h.name}</strong>
                      <span className="muted"> · {h.barcode}</span>
                    </div>
                    <div className="feed__meta">
                      <span>{h.remaining} left</span>
                      <span className="muted">{h.at}</span>
                      <span title="Owner notified">{h.notified ? '✉️' : '⚠️'}</span>
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
