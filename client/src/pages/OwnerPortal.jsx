// Owner Portal: PIN-gated area with Dashboard, Inventory and Settings tabs.
// Each account sees only its own data.
import { useCallback, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Navbar from '../components/Navbar.jsx';
import PinGate from '../components/owner/PinGate.jsx';
import DashboardTab from '../components/owner/DashboardTab.jsx';
import InventoryTab from '../components/owner/InventoryTab.jsx';
import SettingsTab from '../components/owner/SettingsTab.jsx';
import { tokenStore } from '../api/client.js';
import { useTelegramBackButton } from '../lib/telegram.js';
import { useLang } from '../context/LanguageContext.jsx';

const TABS = [
  { id: 'dashboard', icon: '📊', labelKey: 'tabDashboard' },
  { id: 'inventory', icon: '📦', labelKey: 'tabInventory' },
  { id: 'settings', icon: '⚙️', labelKey: 'tabSettings' },
];

export default function OwnerPortal() {
  const { t } = useLang();
  const navigate = useNavigate();
  // Consider the portal unlocked if an owner token already exists this session.
  const [unlocked, setUnlocked] = useState(() => !!tokenStore.getOwner());
  const [tab, setTab] = useState('dashboard');
  // Bumping this forces dashboard/inventory to refetch after mutations.
  const [refreshKey, setRefreshKey] = useState(0);
  const bumpRefresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  // Inside Telegram there's no browser chrome, so surface the native
  // BackButton to return to the Worker portal.
  useTelegramBackButton(true, useCallback(() => navigate('/worker'), [navigate]));

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
            <h1>{t('ownerPortal')}</h1>
            <p className="muted">{t('ownerIntro')}</p>
          </div>
          <button className="btn btn--ghost" onClick={lock}>🔒 {t('lockPortal')}</button>
        </div>

        <div className="tabs">
          {TABS.map(({ id, icon, labelKey }) => (
            <button
              key={id}
              className={`tab ${tab === id ? 'is-active' : ''}`}
              onClick={() => setTab(id)}
            >
              {icon} {t(labelKey)}
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
