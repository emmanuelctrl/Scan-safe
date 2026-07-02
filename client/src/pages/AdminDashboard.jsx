// Super Admin panel: a read-only, cross-account view of every store —
// separate from any individual store's Owner Portal.
import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { api, tokenStore } from '../api/client.js';
import { useTheme } from '../context/ThemeContext.jsx';
import { useTelegramBackButton } from '../lib/telegram.js';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const [overview, setOverview] = useState(null);
  const [stores, setStores] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useTelegramBackButton(true, useCallback(() => navigate('/login'), [navigate]));

  useEffect(() => {
    let cancelled = false;
    Promise.all([
      api('/api/admin/overview', { admin: true }),
      api('/api/admin/stores', { admin: true }),
    ])
      .then(([o, s]) => {
        if (cancelled) return;
        setOverview(o.overview);
        setStores(s.stores);
      })
      .catch((e) => {
        if (cancelled) return;
        setError(e.message);
      })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, []);

  function logout() {
    tokenStore.clearAdmin();
    navigate('/admin/login');
  }

  return (
    <div className="page">
      <header className="navbar">
        <div className="navbar__brand">
          <span className="navbar__logo">🛡️</span>
          <span>Super Admin</span>
        </div>
        <div className="navbar__actions">
          <button className="icon-btn" title="Toggle light / dark theme" onClick={toggleTheme}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button className="btn btn--ghost" onClick={logout}>Log out</button>
        </div>
      </header>

      <main className="container">
        <div className="page__head">
          <h1>All stores</h1>
          <p className="muted">Every registered account across the whole app.</p>
        </div>

        {loading && <p className="muted">Loading…</p>}
        {error && <p className="status status--error">{error}</p>}

        {!loading && !error && (
          <>
            <div className="stats">
              <div className="stat stat--indigo">
                <span className="stat__label">Total stores</span>
                <span className="stat__value">{overview?.storeCount ?? 0}</span>
              </div>
              <div className="stat stat--blue">
                <span className="stat__label">Total items (all stores)</span>
                <span className="stat__value">{overview?.itemCount ?? 0}</span>
              </div>
              <div className="stat stat--amber">
                <span className="stat__label">Sales revenue today</span>
                <span className="stat__value">{money(overview?.salesTodayRevenue)}</span>
              </div>
            </div>

            <section className="card">
              <div className="card__head">
                <h3>Stores <span className="badge">{stores?.length ?? 0}</span></h3>
              </div>
              {!stores || stores.length === 0 ? (
                <p className="muted">No stores registered yet.</p>
              ) : (
                <div className="table-wrap">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>Email</th>
                        <th>Name</th>
                        <th>Created</th>
                        <th>Items</th>
                        <th>Units</th>
                        <th>Inventory value</th>
                        <th>Sales today</th>
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
