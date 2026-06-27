// Camera-based barcode / QR scanner built on the html5-qrcode library.
//
// It opens the device camera, continuously decodes frames, and calls
// onDetected(decodedText) for each successful read. A short cooldown prevents
// the same code from firing dozens of times per second.
import { useEffect, useRef, useState } from 'react';
import { Html5Qrcode } from 'html5-qrcode';

export default function BarcodeScanner({ onDetected, active }) {
  const containerId = 'barcode-scanner-region';
  const scannerRef = useRef(null);
  const lastScanRef = useRef({ text: null, at: 0 });
  const [error, setError] = useState(null);
  const [running, setRunning] = useState(false);

  useEffect(() => {
    if (!active) return undefined;

    const scanner = new Html5Qrcode(containerId, { verbose: false });
    scannerRef.current = scanner;

    const handleSuccess = (decodedText) => {
      const now = Date.now();
      // Debounce: ignore the same code within 2.5s.
      if (
        lastScanRef.current.text === decodedText &&
        now - lastScanRef.current.at < 2500
      ) {
        return;
      }
      lastScanRef.current = { text: decodedText, at: now };
      onDetected(decodedText);
    };

    scanner
      .start(
        { facingMode: 'environment' }, // Prefer the rear camera.
        { fps: 10, qrbox: { width: 250, height: 250 } },
        handleSuccess,
        () => {} // Ignore per-frame "not found" errors.
      )
      .then(() => setRunning(true))
      .catch((err) => {
        setError(
          err?.message ||
            'Unable to access the camera. Grant camera permission and use HTTPS or localhost.'
        );
      });

    // Cleanup: stop and release the camera when unmounting / deactivating.
    return () => {
      const s = scannerRef.current;
      if (s && s.isScanning) {
        s.stop()
          .then(() => s.clear())
          .catch(() => {});
      }
      setRunning(false);
    };
  }, [active, onDetected]);

  return (
    <div className="scanner">
      <div id={containerId} className="scanner__viewport" />
      {!running && !error && active && (
        <p className="scanner__hint">Starting camera…</p>
      )}
      {error && <p className="scanner__error">{error}</p>}
    </div>
  );
}
