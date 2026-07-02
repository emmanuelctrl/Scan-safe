// Owner dashboard: inventory health, low/out-of-stock alerts, today's sales.
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useLang } from '../../context/LanguageContext.jsx';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function DashboardTab({ refreshKey }) {
  const { t } = useLang();
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    api('/api/owner/dashboard', { owner: true })
      .then((d) => { if (!cancelled) setData(d); })
      .catch((e) => { if (!cancelled) setError(e.message); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [refreshKey]);

  if (loading) return <p className="muted">{t('loadingDashboard')}</p>;
  if (error) return <p className="status status--error">{error}</p>;
  if (!data) return null;

  const { inventory, salesToday, stockToday } = data;

  return (
    <div className="dashboard">
      {/* Summary stat cards */}
      <div className="stats">
        <StatCard label={t('salesToday')} value={salesToday.count} sub={money(salesToday.revenue)} accent="indigo" />
        <StatCard label={t('unitsSoldToday')} value={salesToday.units} accent="green" />
        <StatCard label={t('stockAddedToday')} value={stockToday?.units ?? 0} sub={t('restockCount', { n: stockToday?.count ?? 0 })} accent="blue" />
        <StatCard label={t('totalItems')} value={inventory.totalItems} sub={t('unitsCount', { n: inventory.totalUnits })} accent="blue" />
        <StatCard label={t('inventoryValue')} value={money(inventory.inventoryValue)} accent="amber" />
      </div>

      <div className="grid grid--2">
        {/* Out of stock */}
        <section className="card">
          <div className="card__head">
            <h3>{t('outOfStock')} <span className="badge badge--danger">{inventory.outOfStock.length}</span></h3>
          </div>
          {inventory.outOfStock.length === 0 ? (
            <p className="muted">{t('nothingOut')}</p>
          ) : (
            <ul className="list">
              {inventory.outOfStock.map((i) => (
                <li key={i.id} className="list__row">
                  <span>{i.name}</span>
                  <span className="muted">{i.barcode}</span>
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* Low stock */}
        <section className="card">
          <div className="card__head">
            <h3>{t('lowStockAlerts')} <span className="badge badge--warning">{inventory.lowStock.length}</span></h3>
          </div>
          {inventory.lowStock.length === 0 ? (
            <p className="muted">{t('allHealthy')}</p>
          ) : (
            <ul className="list">
              {inventory.lowStock.map((i) => (
                <li key={i.id} className="list__row">
                  <span>{i.name}</span>
                  <span className="badge badge--warning">{t('leftCount', { n: i.quantity })}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Today's sales detail */}
      <section className="card">
        <div className="card__head">
          <h3>{t('todaysSales')}</h3>
          <span className="muted">{money(salesToday.revenue)} · {t('unitsCount', { n: salesToday.units })}</span>
        </div>
        {salesToday.items.length === 0 ? (
          <p className="muted">{t('noSalesYet')}</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>{t('thItem')}</th><th>{t('thBarcode')}</th><th>{t('thQty')}</th><th>{t('thPrice')}</th><th>{t('thTime')}</th></tr>
              </thead>
              <tbody>
                {salesToday.items.map((s) => (
                  <tr key={s.id}>
                    <td>{s.item_name}</td>
                    <td className="muted">{s.barcode}</td>
                    <td>{s.quantity}</td>
                    <td>{money(s.unit_price)}</td>
                    <td className="muted">{new Date(s.created_at + 'Z').toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Today's stock added (restocks) detail */}
      <section className="card">
        <div className="card__head">
          <h3>{t('todaysStockAdded')}</h3>
          <span className="muted">{t('unitsCount', { n: stockToday?.units ?? 0 })} · {t('restockCount', { n: stockToday?.count ?? 0 })}</span>
        </div>
        {!stockToday?.items?.length ? (
          <p className="muted">{t('noStockYet')}</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>{t('thItem')}</th><th>{t('thBarcode')}</th><th>{t('thAdded')}</th><th>{t('thTime')}</th></tr>
              </thead>
              <tbody>
                {stockToday.items.map((m) => (
                  <tr key={m.id}>
                    <td>{m.item_name}</td>
                    <td className="muted">{m.barcode}</td>
                    <td>+{m.quantity_change}</td>
                    <td className="muted">{new Date(m.created_at + 'Z').toLocaleTimeString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className={`stat stat--${accent}`}>
      <span className="stat__label">{label}</span>
      <span className="stat__value">{value}</span>
      {sub && <span className="stat__sub">{sub}</span>}
    </div>
  );
}
