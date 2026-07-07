// Super Admin panel: a read-only, cross-account view of every store —
// separate from any individual store's Owner Portal.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, tokenStore } from '../api/client.js';
import { useTheme } from '../context/ThemeContext.jsx';
import { useLang } from '../context/LanguageContext.jsx';
import { useTelegramBackButton } from '../lib/telegram.js';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useLang();
  const [overview, setOverview] = useState(null);
  const [stores, setStores] = useState(null);
  const [error, setError] = useState(null);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [deletingId, setDeletingId] = useState(null);

  useTelegramBackButton(true, useCallback(() => navigate('/login'), [navigate]));

  const load = useCallback(() => {
    setLoading(true);
    setError(null);
    Promise.all([
      api('/api/admin/overview', { admin: true }),
      api('/api/admin/stores', { admin: true }),
    ])
      .then(([o, s]) => {
        setOverview(o.overview);
        setStores(s.stores);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  useEffect(load, [load]);

  async function removeStore(store) {
    if (!window.confirm(`${store.email}\n\n${t('confirmDeleteStore')}`)) return;
    setDeletingId(store.id);
    setNotice(null);
    try {
      await api(`/api/admin/stores/${store.id}`, { method: 'DELETE', admin: true });
      setNotice({ type: 'success', message: t('storeDeleted') });
      load();
    } catch (err) {
      setNotice({ type: 'error', message: err.message });
    } finally {
      setDeletingId(null);
    }
  }

  function logout() {
    tokenStore.clearAdmin();
    navigate('/admin/login');
  }

  return (
    <div className="page">
      <header className="navbar">
        <div className="navbar__brand">
          <span className="navbar__logo">🛡️</span>
          <span>{t('superAdmin')}</span>
        </div>
        <div className="navbar__actions">
          <button className="icon-btn icon-btn--lang" title={t('changeLanguage')} onClick={toggleLang}>
            {lang === 'en' ? 'አማ' : 'EN'}
          </button>
          <button className="icon-btn" title={t('toggleTheme')} onClick={toggleTheme}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button className="btn btn--ghost" onClick={logout}>{t('logout')}</button>
        </div>
      </header>

      <main className="container">
        <div className="page__head">
          <h1>{t('allStores')}</h1>
          <p className="muted">{t('allStoresDesc')}</p>
        </div>

        {loading && <p className="muted">{t('loading')}</p>}
        {error && <p className="status status--error">{error}</p>}
        {notice && <p className={`status status--${notice.type}`}>{notice.message}</p>}

        {!loading && !error && (
          <>
            <div className="stats">
              <div className="stat stat--indigo">
                <span className="stat__label">{t('totalStores')}</span>
                <span className="stat__value">{overview?.storeCount ?? 0}</span>
              </div>
              <div className="stat stat--blue">
                <span className="stat__label">{t('totalItemsAll')}</span>
                <span className="stat__value">{overview?.itemCount ?? 0}</span>
              </div>
              <div className="stat stat--amber">
                <span className="stat__label">{t('salesRevenueToday')}</span>
                <span className="stat__value">{money(overview?.salesTodayRevenue)}</span>
              </div>
            </div>

            <section className="card">
              <div className="card__head">
                <h3>{t('stores')} <span className="badge">{stores?.length ?? 0}</span></h3>
              </div>
              {!stores || stores.length === 0 ? (
                <p className="muted">{t('noStores')}</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>{t('thEmail')}</th>
                        <th>{t('thName')}</th>
                        <th>{t('thCreated')}</th>
                        <th>{t('thItems')}</th>
                        <th>{t('thUnits')}</th>
                        <th>{t('thInvValue')}</th>
                        <th>{t('thSalesToday')}</th>
                        <th>{t('thActions')}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stores.map((s) => (
                        <tr key={s.id}>
                          <td>{s.email}</td>
                          <td className="muted">{s.name || '—'}</td>
                          <td className="muted">{new Date(s.created_at + 'Z').toLocaleDateString()}</td>
                          <td>{s.itemCount}</td>
                          <td>{s.totalUnits}</td>
                          <td>{money(s.inventoryValue)}</td>
                          <td>{s.salesTodayCount} · {money(s.salesTodayRevenue)}</td>
                          <td className="row-actions">
                            <button
                              className="btn btn--small btn--danger"
                              disabled={deletingId === s.id}
                              onClick={() => removeStore(s)}
                            >
                              {t('delete')}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}
