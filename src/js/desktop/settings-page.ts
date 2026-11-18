import { applyDesktopStrings } from './strings.js';
import { THEME_EVENT, setThemePreference, themePreference } from './theme.js';
import {
  DESKTOP_LANGUAGES,
  changeLanguage,
  getLanguageFromUrl,
  languageNames,
} from '../i18n/i18n.js';

function initThemeOptions(): void {
  const options = document.querySelectorAll<HTMLElement>('[data-theme-option]');

  const sync = () => {
    options.forEach((option) => {
      option.setAttribute(
        'aria-checked',
        String(option.dataset.themeOption === themePreference())
      );
    });
  };

  options.forEach((option) => {
    option.addEventListener('click', () => {
      const value = option.dataset.themeOption;
      setThemePreference(
        value === 'light' || value === 'system' ? value : 'dark'
      );
    });
  });

  // Also follows the quick toggle in the status bar.
  document.addEventListener(THEME_EVENT, sync);
  sync();
}

function initLanguageSelect(): void {
  const select = document.getElementById(
    'desktop-language-select'
  ) as HTMLSelectElement | null;
  if (!select) return;

  DESKTOP_LANGUAGES.forEach((lang) => {
    const option = document.createElement('option');
    option.value = lang;
    option.textContent = languageNames[lang];
    select.append(option);
  });
  select.value = getLanguageFromUrl();
  select.addEventListener('change', () => {
    changeLanguage(select.value as (typeof DESKTOP_LANGUAGES)[number]);
  });
}

applyDesktopStrings();
initThemeOptions();
initLanguageSelect();
