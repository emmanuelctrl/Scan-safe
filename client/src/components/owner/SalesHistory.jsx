// Owner sales history: every checkout, searchable by date range, with the
// profit (selling price − cost at time of sale) for each line and in total.
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import { useLang } from '../../context/LanguageContext.jsx';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;
const todayStr = () => new Date().toISOString().slice(0, 10);

export default function SalesHistory({ refreshKey }) {
  const { t } = useLang();
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  function load(fromDate = from, toDate = to) {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams();
    if (fromDate) params.set('from', fromDate);
    if (toDate) params.set('to', toDate);
    const qs = params.toString();
    api(`/api/owner/sales${qs ? `?${qs}` : ''}`, { owner: true })
      .then((d) => setData(d))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  // Load all sales on mount and whenever the portal refreshes after a change.
  useEffect(() => { load(from, to); /* eslint-disable-next-line */ }, [refreshKey]);

  function applyFilter(e) {
    e.preventDefault();
    load(from, to);
  }

  function showToday() {
    const d = todayStr();
    setFrom(d); setTo(d);
    load(d, d);
  }

  function clearFilter() {
    setFrom(''); setTo('');
    load('', '');
  }

  return (
    <section className="card">
      <div className="card__head">
        <h3>{t('salesHistory')}</h3>
        {data && (
          <span className="muted">
            {data.count} · {money(data.revenue)} · {t('profitLabel')} {money(data.profit)}
          </span>
        )}
      </div>

      <form className="sales-filter" onSubmit={applyFilter}>
        <label className="field">
          <span>{t('fromDate')}</span>
          <input type="date" value={from} max={to || todayStr()} onChange={(e) => setFrom(e.target.value)} />
        </label>
        <label className="field">
          <span>{t('toDate')}</span>
          <input type="date" value={to} min={from} max={todayStr()} onChange={(e) => setTo(e.target.value)} />
        </label>
        <button className="btn btn--primary" type="submit">{t('search')}</button>
        <button className="btn btn--secondary" type="button" onClick={showToday}>{t('today')}</button>
        <button className="btn btn--ghost" type="button" onClick={clearFilter}>{t('allTime')}</button>
      </form>

      {/* Totals */}
      {data && !loading && (
        <div className="stats sales-totals">
          <div className="stat stat--indigo">
            <span className="stat__label">{t('salesCount')}</span>
            <span className="stat__value">{data.count}</span>
            <span className="stat__sub">{t('unitsCount', { n: data.units })}</span>
          </div>
          <div className="stat stat--green">
            <span className="stat__label">{t('revenue')}</span>
            <span className="stat__value">{money(data.revenue)}</span>
          </div>
          <div className="stat stat--amber">
            <span className="stat__label">{t('costLabel')}</span>
            <span className="stat__value">{money(data.cost)}</span>
          </div>
          <div className="stat stat--green">
            <span className="stat__label">{t('profitLabel')}</span>
            <span className="stat__value">{money(data.profit)}</span>
          </div>
        </div>
      )}

      {loading ? (
        <p className="muted">{t('loading')}</p>
      ) : error ? (
        <p className="status status--error">{error}</p>
      ) : !data?.items?.length ? (
        <p className="muted">{t('noSalesFound')}</p>
      ) : (
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>{t('thDateTime')}</th>
                <th>{t('thItem')}</th>
                <th>{t('thQty')}</th>
                <th>{t('thPrice')}</th>
                <th>{t('thCost')}</th>
                <th>{t('thProfit')}</th>
              </tr>
            </thead>
            <tbody>
              {data.items.map((s) => {
                const profit = (s.unit_price - (s.unit_cost || 0)) * s.quantity;
                return (
                  <tr key={s.id}>
                    <td className="muted">{new Date(s.created_at + 'Z').toLocaleString()}</td>
                    <td>{s.item_name}<span className="muted"> · {s.barcode}</span></td>
                    <td>{s.quantity}</td>
                    <td>{money(s.unit_price * s.quantity)}</td>
                    <td className="muted">{money((s.unit_cost || 0) * s.quantity)}</td>
                    <td>{money(profit)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
