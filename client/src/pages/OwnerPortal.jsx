// Owner Portal: PIN-gated area with Dashboard, Inventory and Settings tabs.
// Each account sees only its own data.
import { useCallback, useState } from 'react';
import Navbar from '../components/Navbar.jsx';
import PinGate from '../components/owner/PinGate.jsx';
import DashboardTab from '../components/owner/DashboardTab.jsx';
import InventoryTab from '../components/owner/InventoryTab.jsx';
import SettingsTab from '../components/owner/SettingsTab.jsx';
import { tokenStore } from '../api/client.js';

const TABS = [
  { id: 'dashboard', label: '📊 Dashboard' },
  { id: 'inventory', label: '📦 Inventory' },
  { id: 'settings', label: '⚙️ Settings' },
];

export default function OwnerPortal() {
  // Consider the portal unlocked if an owner token already exists this session.
  const [unlocked, setUnlocked] = useState(() => !!tokenStore.getOwner());
  const [tab, setTab] = useState('dashboard');
  // Bumping this forces dashboard/inventory to refetch after mutations.
  const [refreshKey, setRefreshKey] = useState(0);
  const bumpRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  function lock() {
    tokenStore.clearOwner();
    setUnlocked(false);
  }

  if (!unlocked) {
    return (
      <div className="page">
        <Navbar />
        <main className="container">
          <PinGate onUnlocked={() => setUnlocked(true)} />
        </main>
      </div>
    );
  }

  return (
    <div className="page">
      <Navbar />
      <main className="container">
        <div className="page__head page__head--row">
          <div>
            <h1>Owner Portal</h1>
            <p className="muted">Your store's inventory, sales and settings.</p>
          </div>
          <button className="btn btn--ghost" onClick={lock}>🔒 Lock portal</button>
        </div>

        <div className="tabs">
          {TABS.map((t) => (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? 'is-active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div className="tab-content">
          {tab === 'dashboard' && <DashboardTab refreshKey={refreshKey} />}
          {tab === 'inventory' && (
            <InventoryTab refreshKey={refreshKey} bumpRefresh={bumpRefresh} />
          )}
          {tab === 'settings' && <SettingsTab />}
        </div>
      </main>
    </div>
  );
}
