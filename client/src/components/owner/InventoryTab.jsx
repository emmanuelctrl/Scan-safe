// Inventory management: import from Excel, add new items, edit prices/details,
// and delete items. All actions are scoped to the logged-in account.
import { useEffect, useState } from 'react';
import { api } from '../../api/client.js';
import ImportPanel from './ImportPanel.jsx';

const EMPTY = { barcode: '', name: '', price: '', quantity: '', low_stock_at: 5, sku: '' };
const money = (n) => `$${Number(n || 0).toFixed(2)}`;

export default function InventoryTab({ refreshKey, bumpRefresh }) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [form, setForm] = useState(EMPTY);
  const [editingId, setEditingId] = useState(null);
  const [editRow, setEditRow] = useState(null);
  const [notice, setNotice] = useState(null);

  function load() {
    setLoading(true);
    api('/api/owner/items', { owner: true })
      .then((d) => setItems(d.items))
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }

  useEffect(load, [refreshKey]);

  const updateForm = (f) => (e) => setForm((s) => ({ ...s, [f]: e.target.value }));

  async function handleAdd(e) {
    e.preventDefault();
    setNotice(null);
    try {
      await api('/api/owner/items', {
        method: 'POST',
        owner: true,
        body: {
          barcode: form.barcode.trim(),
          name: form.name.trim(),
          price: Number(form.price || 0),
          quantity: Number(form.quantity || 0),
          low_stock_at: Number(form.low_stock_at || 5),
          sku: form.sku?.trim() || undefined,
        },
      });
      setForm(EMPTY);
      setNotice({ type: 'success', message: 'Item added.' });
      load();
      bumpRefresh?.();
    } catch (err) {
      setNotice({ type: 'error', message: err.message });
    }
  }

  function startEdit(item) {
    setEditingId(item.id);
    setEditRow({ ...item });
  }

  async function saveEdit(id) {
    setNotice(null);
    try {
      await api(`/api/owner/items/${id}`, {
        method: 'PATCH',
        owner: true,
        body: {
          name: editRow.name.trim(),
          barcode: editRow.barcode.trim(),
          price: Number(editRow.price || 0),
          quantity: Number(editRow.quantity || 0),
          low_stock_at: Number(editRow.low_stock_at || 0),
          sku: editRow.sku?.trim() || undefined,
        },
      });
      setEditingId(null);
      setEditRow(null);
      load();
      bumpRefresh?.();
    } catch (err) {
      setNotice({ type: 'error', message: err.message });
    }
  }

  async function remove(id) {
    if (!window.confirm('Delete this item? This cannot be undone.')) return;
    try {
      await api(`/api/owner/items/${id}`, { method: 'DELETE', owner: true });
      load();
      bumpRefresh?.();
    } catch (err) {
      setNotice({ type: 'error', message: err.message });
    }
  }

  return (
    <div className="inventory">
      <ImportPanel onImported={() => { load(); bumpRefresh?.(); }} />

      {/* Add new item */}
      <section className="card">
        <div className="card__head"><h3>➕ Add a new item</h3></div>
        <form onSubmit={handleAdd} className="item-form">
          <input required placeholder="Barcode" value={form.barcode} onChange={updateForm('barcode')} />
          <input required placeholder="Name" value={form.name} onChange={updateForm('name')} />
          <input type="number" step="0.01" min="0" placeholder="Price" value={form.price} onChange={updateForm('price')} />
          <input type="number" min="0" placeholder="Qty" value={form.quantity} onChange={updateForm('quantity')} />
          <input type="number" min="0" placeholder="Low-stock at" value={form.low_stock_at} onChange={updateForm('low_stock_at')} />
          <input placeholder="SKU (optional)" value={form.sku} onChange={updateForm('sku')} />
          <button className="btn btn--primary">Add</button>
        </form>
        {notice && <p className={`status status--${notice.type}`}>{notice.message}</p>}
      </section>

      {/* Inventory table */}
      <section className="card">
        <div className="card__head">
          <h3>Inventory <span className="badge">{items.length}</span></h3>
          <button className="btn btn--ghost" onClick={load}>Refresh</button>
        </div>

        {loading ? (
          <p className="muted">Loading inventory…</p>
        ) : error ? (
          <p className="status status--error">{error}</p>
        ) : items.length === 0 ? (
          <p className="muted">No items yet. Import a spreadsheet or add one above.</p>
        ) : (
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Name</th><th>Barcode</th><th>Price</th><th>Qty</th>
                  <th>Low at</th><th>SKU</th><th></th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) =>
                  editingId === item.id ? (
                    <tr key={item.id} className="is-editing">
                      <td><input value={editRow.name} onChange={(e) => setEditRow({ ...editRow, name: e.target.value })} /></td>
                      <td><input value={editRow.barcode} onChange={(e) => setEditRow({ ...editRow, barcode: e.target.value })} /></td>
                      <td><input type="number" step="0.01" min="0" value={editRow.price} onChange={(e) => setEditRow({ ...editRow, price: e.target.value })} /></td>
                      <td><input type="number" min="0" value={editRow.quantity} onChange={(e) => setEditRow({ ...editRow, quantity: e.target.value })} /></td>
                      <td><input type="number" min="0" value={editRow.low_stock_at} onChange={(e) => setEditRow({ ...editRow, low_stock_at: e.target.value })} /></td>
                      <td><input value={editRow.sku || ''} onChange={(e) => setEditRow({ ...editRow, sku: e.target.value })} /></td>
                      <td className="row-actions">
                        <button className="btn btn--small btn--primary" onClick={() => saveEdit(item.id)}>Save</button>
                        <button className="btn btn--small btn--ghost" onClick={() => { setEditingId(null); setEditRow(null); }}>Cancel</button>
                      </td>
                    </tr>
                  ) : (
                    <tr key={item.id} className={item.quantity === 0 ? 'is-oos' : ''}>
                      <td>{item.name}</td>
                      <td className="muted">{item.barcode}</td>
                      <td>{money(item.price)}</td>
                      <td>
                        {item.quantity}
                        {item.quantity === 0 && <span className="badge badge--danger">OUT</span>}
                        {item.quantity > 0 && item.quantity <= item.low_stock_at && (
                          <span className="badge badge--warning">LOW</span>
                        )}
                      </td>
                      <td className="muted">{item.low_stock_at}</td>
                      <td className="muted">{item.sku || '—'}</td>
                      <td className="row-actions">
                        <button className="btn btn--small btn--secondary" onClick={() => startEdit(item)}>Edit</button>
                        <button className="btn btn--small btn--danger" onClick={() => remove(item.id)}>Delete</button>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
