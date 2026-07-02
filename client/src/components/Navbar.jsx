// Top navigation bar shared across portals.
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../context/AuthContext.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { useLang } from '../context/LanguageContext.jsx';

export default function Navbar() {
  const { user, logout } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const { lang, toggleLang, t } = useLang();
  const navigate = useNavigate();
  const { pathname } = useLocation();

  return (
    <header className="navbar">
      <div className="navbar__brand" onClick={() => navigate('/worker')}>
        <span className="navbar__logo">🛍️</span>
        <span>{t('appName')}</span>
      </div>

      <nav className="navbar__links">
        <button
          className={`navbar__link ${pathname === '/worker' ? 'is-active' : ''}`}
          onClick={() => navigate('/worker')}
        >
          {t('navWorker')}
        </button>
        <button
          className={`navbar__link ${pathname === '/owner' ? 'is-active' : ''}`}
          onClick={() => navigate('/owner')}
        >
          {t('navOwner')}
        </button>
      </nav>

      <div className="navbar__actions">
        <button
          className="icon-btn icon-btn--lang"
          title={t('changeLanguage')}
          onClick={toggleLang}
        >
          {lang === 'en' ? 'አማ' : 'EN'}
        </button>
        <button
          className="icon-btn"
          title={t('toggleTheme')}
          onClick={toggleTheme}
        >
          {theme === 'light' ? '🌙' : '☀️'}
        </button>
        {user && <span className="navbar__user">{user.email}</span>}
        <button className="btn btn--ghost" onClick={logout}>
          {t('logout')}
        </button>
      </div>
    </header>
  );
}
