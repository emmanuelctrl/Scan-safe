// Language context: English / Amharic (አማርኛ). The choice is persisted to
// localStorage and applied to <html lang> and the document title. Purely
// client-side — server responses (e.g. error messages) keep their language.
import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { translations } from '../i18n/translations.js';

const LanguageContext = createContext(null);

export function LanguageProvider({ children }) {
  const [lang, setLangState] = useState(() =>
    localStorage.getItem('it_lang') === 'am' ? 'am' : 'en'
  );

  useEffect(() => {
    localStorage.setItem('it_lang', lang);
    document.documentElement.lang = lang;
    document.title = translations[lang].appName;
  }, [lang]);

  /** Translate a key, with optional {placeholder} interpolation. */
  const t = useCallback(
    (key, vars) => {
      let str = translations[lang][key] ?? translations.en[key] ?? key;
      if (vars) {
        for (const [k, v] of Object.entries(vars)) {
          str = str.replaceAll(`{${k}}`, String(v));
        }
      }
      return str;
    },
    [lang]
  );

  const setLang = useCallback((l) => setLangState(l === 'am' ? 'am' : 'en'), []);
  const toggleLang = useCallback(
    () => setLangState((l) => (l === 'en' ? 'am' : 'en')),
    []
  );

  const value = useMemo(
    () => ({ lang, setLang, toggleLang, t }),
    [lang, setLang, toggleLang, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLang() {
  const ctx = useContext(LanguageContext);
  if (!ctx) throw new Error('useLang must be used within a LanguageProvider');
  return ctx;
}
