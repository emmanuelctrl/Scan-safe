// Excel / CSV inventory import.
//
// The owner picks a spreadsheet; the moment it's uploaded the backend parses
// it and turns it into this account's inventory. "Replace existing inventory"
// makes the spreadsheet the single source of truth (existing items are wiped
// first); otherwise rows are merged by barcode.
import { useRef, useState } from 'react';
import { uploadFile } from '../../api/client.js';
import { useLang } from '../../context/LanguageContext.jsx';

export default function ImportPanel({ onImported }) {
  const { t } = useLang();
  const fileRef = useRef(null);
  const [file, setFile] = useState(null);
  const [replace, setReplace] = useState(false);
  const [busy, setBusy] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState(null);

  async function handleUpload() {
    if (!file) return;
    setBusy(true);
    setError(null);
    setResult(null);
    try {
      const data = await uploadFile('/api/owner/items/import', file, {
        replace: String(replace),
      });
      setResult(data);
      setFile(null);
      if (fileRef.current) fileRef.current.value = '';
      onImported?.(); // Refresh dashboard + inventory tables.
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className="card import">
      <div className="card__head">
        <h3>📥 {t('importTitle')}</h3>
      </div>
      <p className="muted">
        {t('importIntro1')} <code>barcode</code>, <code>name</code>.{' '}
        {t('importIntro2')}
        <code> price</code>, <code>quantity</code>, <code>low_stock_at</code>,
        <code> sku</code>.
      </p>

      <div className="import__controls">
        <input
          ref={fileRef}
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => { setFile(e.target.files?.[0] || null); setResult(null); setError(null); }}
        />
        <label className="checkbox">
          <input
            type="checkbox"
            checked={replace}
            onChange={(e) => setReplace(e.target.checked)}
          />
          <span>{t('replaceExisting')}</span>
        </label>
        <button
          className="btn btn--primary"
          onClick={handleUpload}
          disabled={!file || busy}
        >
          {busy ? t('importing') : t('uploadImport')}
        </button>
      </div>

      {error && <p className="status status--error">{error}</p>}

      {result && (
        <div className="status status--success">
          <p>{result.message}</p>
          {result.skipped?.length > 0 && (
            <details className="import__skipped">
              <summary>{t('rowsSkipped', { n: result.skipped.length })}</summary>
              <ul>
                {result.skipped.map((s) => (
                  <li key={s.row}>{t('rowLabel', { row: s.row, message: s.message })}</li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}
    </section>
  );
}
