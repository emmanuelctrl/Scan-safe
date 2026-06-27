// Owner dashboard: inventory health, low/out-of-stock alerts, today's sales.
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';

const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function DashboardTab({ refreshKey }) {
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

  if (loading) return <p className="muted">Loading dashboard…</p>;
  if (error) return <p className="status status--error">{error}</p>;
  if (!data) return null;

  const { inventory, salesToday } = data;

  return (
    <div className="dashboard">
      {/* Summary stat cards */}
      <div className="stats">
        <StatCard label="Sales today" value={salesToday.count} sub={money(salesToday.revenue)} accent="indigo" />
        <StatCard label="Units sold today" value={salesToday.units} accent="green" />
        <StatCard label="Total items" value={inventory.totalItems} sub={`${inventory.totalUnits} units`} accent="blue" />
        <StatCard label="Inventory value" value={money(inventory.inventoryValue)} accent="amber" />
      </div>

      <div className="grid grid--2">
        {/* Out of stock */}
        <section className="card">
          <div className="card__head">
            <h3>Out of stock <span className="badge badge--danger">{inventory.outOfStock.length}</span></h3>
          </div>
          {inventory.outOfStock.length === 0 ? (
            <p className="muted">Nothing is out of stock. 🎉</p>
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
            <h3>Low stock alerts <span className="badge badge--warning">{inventory.lowStock.length}</span></h3>
          </div>
          {inventory.lowStock.length === 0 ? (
            <p className="muted">All stock levels are healthy. ✅</p>
          ) : (
            <ul className="list">
              {inventory.lowStock.map((i) => (
                <li key={i.id} className="list__row">
                  <span>{i.name}</span>
                  <span className="badge badge--warning">{i.quantity} left</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      {/* Today's sales detail */}
      <section className="card">
        <div className="card__head">
          <h3>Today's sales</h3>
          <span className="muted">{money(salesToday.revenue)} · {salesToday.units} units</span>
        </div>
        {salesToday.items.length === 0 ? (
          <p className="muted">No sales recorded yet today.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr><th>Item</th><th>Barcode</th><th>Qty</th><th>Price</th><th>Time</th></tr>
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
