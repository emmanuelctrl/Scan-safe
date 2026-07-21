// Worker portal: scan a barcode/QR with the camera (or pick an item from a
// category), review the sale — adjust price and quantity — then confirm the
// checkout. Each successful checkout emails the store owner.
import { useCallback, useEffect, useState } from 'react';
import Navbar from '../components/Navbar.jsx';
import BarcodeScanner from '../components/BarcodeScanner.jsx';
import { api } from '../api/client.js';
import { useLang } from '../context/LanguageContext.jsx';

// How much the +/- price buttons move the sale price per tap.
const PRICE_STEP = 500;

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function WorkerPortal() {
  const { t } = useLang();
  const [scanning, setScanning] = useState(false);
  const [manualCode, setManualCode] = useState('');
  const [status, setStatus] = useState(null); // { type, message }
  const [busy, setBusy] = useState(false);
  const [history, setHistory] = useState([]);

  // A sale being reviewed before confirmation: { item, price, quantity }.
  const [pending, setPending] = useState(null);

  // Category browsing.
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState(null);
  const [categoryItems, setCategoryItems] = useState([]);
  const [loadingItems, setLoadingItems] = useState(false);

  useEffect(() => {
    api('/api/scan/categories')
      .then((d) => setCategories(d.categories))
      .catch(() => {}); // Non-fatal: worker can still scan without categories.
  }, []);

  // Look up a scanned/typed barcode and open the confirmation panel.
  const startCheckout = useCallback(async (barcode) => {
    if (!barcode || busy) return;
    setBusy(true);
    setStatus({ type: 'info', message: t('processing', { code: barcode }) });
    try {
      const { item } = await api(`/api/scan/lookup/${encodeURIComponent(barcode)}`);
      setPending({ item, price: Number(item.price) || 0, quantity: 1 });
      setStatus(null);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  }, [busy, t]);

  // Open the confirmation panel for an item tapped in the category list.
  function pickItem(item) {
    if (busy || pending) return;
    setStatus(null);
    setPending({ item, price: Number(item.price) || 0, quantity: 1 });
  }

  const handleDetected = useCallback(
    (text) => {
      // Ignore new detections while a sale is being reviewed.
      if (!pending) startCheckout(text);
    },
    [pending, startCheckout]
  );

  function handleManualSubmit(e) {
    e.preventDefault();
    const code = manualCode.trim();
    if (code && !pending) {
      startCheckout(code);
      setManualCode('');
    }
  }

  function adjustPrice(delta) {
    setPending((p) => p && { ...p, price: Math.max(0, p.price + delta) });
  }

  function setPrice(value) {
    const price = Math.max(0, Number(value) || 0);
    setPending((p) => p && { ...p, price });
  }

  function adjustQuantity(delta) {
    setPending((p) => {
      if (!p) return p;
      const max = Math.max(1, p.item.quantity);
      return { ...p, quantity: Math.min(max, Math.max(1, p.quantity + delta)) };
    });
  }

  function setQuantity(value) {
    setPending((p) => {
      if (!p) return p;
      const max = Math.max(1, p.item.quantity);
      const quantity = Math.min(max, Math.max(1, Math.floor(Number(value)) || 1));
      return { ...p, quantity };
    });
  }

  // Send the reviewed sale to the backend.
  async function confirmSale() {
    if (!pending || busy) return;
    const { item, price, quantity } = pending;
    setBusy(true);
    setStatus(null);
    try {
      const data = await api('/api/scan', {
        method: 'POST',
        body: { barcode: item.barcode, action: 'checkout', quantity, price },
      });
      setStatus({ type: 'success', message: data.message });
      setPending(null);
      setHistory((h) => [
        {
          id: Date.now(),
          name: data.item.name,
          barcode: data.item.barcode,
          quantity: data.sale?.quantity ?? quantity,
          total: data.sale?.total ?? price * quantity,
          remaining: data.item.quantity,
          notified: data.notification?.delivered || data.notification?.simulated,
          at: new Date().toLocaleTimeString(),
        },
        ...h,
      ].slice(0, 20));
      // Refresh the open category list so stock counts stay accurate.
      if (activeCategory !== null) loadCategoryItems(activeCategory);
    } catch (err) {
      setStatus({ type: 'error', message: err.message });
    } finally {
      setBusy(false);
    }
  }

  function loadCategoryItems(category) {
    setActiveCategory(category);
    setLoadingItems(true);
    const query = category ? `?category=${encodeURIComponent(category)}` : '';
    api(`/api/scan/items${query}`)
      .then((d) => setCategoryItems(d.items))
      .catch((e) => setStatus({ type: 'error', message: e.message }))
      .finally(() => setLoadingItems(false));
  }

  function toggleCategory(category) {
    if (activeCategory === category) {
      setActiveCategory(null);
      setCategoryItems([]);
    } else {
      loadCategoryItems(category);
    }
  }

  const priceAdjusted = pending && pending.price !== Number(pending.item.price);

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
              <button className="btn btn--secondary" disabled={busy || !!pending}>
                {t('checkOut')}
              </button>
            </form>

            {/* Browse by category: tap an item to sell without scanning. */}
            {categories.length > 0 && (
              <div className="catalog">
                <p className="catalog__title">{t('browseCategories')}</p>
                <div className="chips">
                  {categories.map((c) => (
                    <button
                      key={c}
                      type="button"
                      className={`chip ${activeCategory === c ? 'chip--active' : ''}`}
                      onClick={() => toggleCategory(c)}
                    >
                      {c}
                    </button>
                  ))}
                </div>
                {activeCategory !== null && (
                  loadingItems ? (
                    <p className="muted">{t('loading')}</p>
                  ) : categoryItems.length === 0 ? (
                    <p className="muted">{t('noCategoryItems')}</p>
                  ) : (
                    <ul className="pick-list">
                      {categoryItems.map((item) => (
                        <li key={item.id}>
                          <button
                            type="button"
                            className="pick-list__item"
                            disabled={item.quantity === 0 || busy || !!pending}
                            onClick={() => pickItem(item)}
                          >
                            <span className="pick-list__name">{item.name}</span>
                            <span className="pick-list__meta">
                              {money(item.price)} ·{' '}
                              {item.quantity === 0
                                ? t('outBadge')
                                : t('inStockCount', { n: item.quantity })}
                            </span>
                          </button>
                        </li>
                      ))}
                    </ul>
                  )
                )}
              </div>
            )}

            {status && (
              <p className={`status status--${status.type}`}>{status.message}</p>
            )}
          </section>

          <section className="card">
            {pending ? (
              /* ── Confirm sale: adjust price & quantity before recording ── */
              <div className="checkout">
                <div className="card__head">
                  <h2>{t('confirmSaleTitle')}</h2>
                </div>
                <div className="checkout__item">
                  <strong>{pending.item.name}</strong>
                  <span className="muted">
                    {' '}· {pending.item.barcode}
                    {pending.item.category ? ` · ${pending.item.category}` : ''}
                  </span>
                  <p className="muted">{t('leftCount', { n: pending.item.quantity })}</p>
                </div>

                <div className="checkout__row">
                  <label>{t('unitPrice')}</label>
                  <div className="stepper">
                    <button
                      type="button"
                      className="stepper__btn stepper__btn--wide"
                      onClick={() => adjustPrice(-PRICE_STEP)}
                      disabled={pending.price <= 0}
                      title={t('decreasePrice', { n: PRICE_STEP })}
                    >
                      −{PRICE_STEP}
                    </button>
                    <input
                      type="number"
                      min="0"
                      step="any"
                      className="checkout__price-input"
                      value={pending.price}
                      onChange={(e) => setPrice(e.target.value)}
                      aria-label={t('unitPrice')}
                    />
                    <button
                      type="button"
                      className="stepper__btn stepper__btn--wide"
                      onClick={() => adjustPrice(PRICE_STEP)}
                      title={t('increasePrice', { n: PRICE_STEP })}
                    >
                      +{PRICE_STEP}
                    </button>
                  </div>
                  {priceAdjusted && (
                    <p className="muted checkout__hint">
                      {t('originalPrice', { price: money(pending.item.price) })}
                    </p>
                  )}
                </div>

                <div className="checkout__row">
                  <label>{t('quantityLabel')}</label>
                  <div className="stepper">
                    <button
                      type="button"
                      className="stepper__btn"
                      onClick={() => adjustQuantity(-1)}
                      disabled={pending.quantity <= 1}
                      title={t('decreaseQty')}
                    >
                      −
                    </button>
                    <input
                      type="number"
                      min="1"
                      max={pending.item.quantity}
                      className="checkout__qty-input"
                      value={pending.quantity}
                      onChange={(e) => setQuantity(e.target.value)}
                      aria-label={t('quantityLabel')}
                    />
                    <button
                      type="button"
                      className="stepper__btn"
                      onClick={() => adjustQuantity(1)}
                      disabled={pending.quantity >= pending.item.quantity}
                      title={t('increaseQty')}
                    >
                      +
                    </button>
                  </div>
                </div>

                <div className="checkout__total">
                  <span>{t('saleTotal')}</span>
                  <strong>{money(pending.price * pending.quantity)}</strong>
                </div>

                <div className="checkout__actions">
                  <button
                    className="btn btn--primary"
                    onClick={confirmSale}
                    disabled={busy}
                  >
                    {busy ? t('pleaseWait') : t('confirmSale')}
                  </button>
                  <button
                    className="btn btn--ghost"
                    onClick={() => { setPending(null); setStatus(null); }}
                    disabled={busy}
                  >
                    {t('cancel')}
                  </button>
                </div>
              </div>
            ) : (
              /* ── Recent scans feed ─────────────────────────────────────── */
              <>
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
                          {h.quantity > 1 && <span> ×{h.quantity}</span>}
                          <span className="muted"> · {money(h.total)}</span>
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
              </>
            )}
          </section>
        </div>
      </main>
    </div>
  );
}
