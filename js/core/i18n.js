/* =========================================================
 *  js/core/i18n.js
 *  Система мультиязычности
 *  v2.1 — использует глобальную App.applyTranslations
 * ========================================================= */

window.App = window.App || {};

App.I18n = {
  current: 'ru',

  languages: {
    'ru': { name: 'Русский',    flag: '🇷🇺', native: 'Русский' },
    'en': { name: 'English',    flag: '🇺🇸', native: 'English' },
    'es': { name: 'Español',    flag: '🇪🇸', native: 'Español' },
    'de': { name: 'Deutsch',    flag: '🇩🇪', native: 'Deutsch' },
    'fr': { name: 'Français',   flag: '🇫🇷', native: 'Français' },
    'it': { name: 'Italiano',   flag: '🇮🇹', native: 'Italiano' },
    'pt': { name: 'Português',  flag: '🇵🇹', native: 'Português' },
    'nl': { name: 'Nederlands', flag: '🇳🇱', native: 'Nederlands' },
    'pl': { name: 'Polski',     flag: '🇵🇱', native: 'Polski' },
    'tr': { name: 'Türkçe',     flag: '🇹🇷', native: 'Türkçe' }
  },

  translations: {},

  init: function() {
    console.log('🌐 I18n: инициализация (10 языков)...');

    const saved = App.ls.get('flo_language');
    if (saved && this.languages[saved]) {
      this.current = saved;
    } else {
      this.current = this._detectBrowserLanguage();
    }

    document.documentElement.lang = this.current;
    console.log('✅ I18n готов. Язык:', this.current);
  },

  _detectBrowserLanguage: function() {
    const fullLang = (navigator.language || navigator.userLanguage || 'ru').toLowerCase();
    if (fullLang.startsWith('pt')) return 'pt';
    const short = fullLang.substring(0, 2);
    return this.languages[short] ? short : 'ru';
  },

  loadTranslations: function(lang, translations) {
    this.translations[lang] = translations;
  },

  t: function(key, params) {
    const translations = this.translations[this.current] || this.translations['ru'];

    let result = this._getNestedValue(translations, key);

    if (result === undefined && this.current !== 'ru') {
      result = this._getNestedValue(this.translations['ru'], key);
    }

    if (result === undefined) {
      return key;
    }

    if (params && typeof result === 'string') {
      result = result.replace(/\{(\w+)\}/g, (match, param) => {
        return params[param] !== undefined ? params[param] : match;
      });
    }

    return result;
  },

  _getNestedValue: function(obj, path) {
    if (!obj) return undefined;
    return path.split('.').reduce((acc, part) => {
      return acc && acc[part] !== undefined ? acc[part] : undefined;
    }, obj);
  },

  setLanguage: function(lang) {
    if (!this.languages[lang]) return;

    this.current = lang;
    App.ls.set('flo_language', lang);
    document.documentElement.lang = lang;

    console.log(`🌐 Язык: ${lang}`);

    if (typeof App.updateNavLabels === 'function') App.updateNavLabels();
    if (typeof App.renderNav === 'function' && App.Auth?.user) App.renderNav();
    if (typeof App.renderView === 'function' && App.Auth?.user) App.renderView();

    // Обновляем имя пользователя
    const uname = document.getElementById('uname');
    if (uname && App.Auth?.user) {
      const roleName = this.t('roles.' + App.Auth.user.role);
      uname.textContent = `${App.Auth.user.name} (${roleName})`;
    }

    document.title = this.t('app.name') + ' — ' + this.t('app.tagline');

    // Вызываем глобальную функцию применения переводов
    if (typeof App.applyTranslations === 'function') {
      App.applyTranslations();
    }

    if (App.Toast?.ok) {
      App.Toast.ok(this.t('common.language_changed'));
    }
  },

  getLanguageOptions: function() {
    return Object.entries(this.languages).map(([code, info]) => ({
      code,
      ...info,
      active: code === this.current
    }));
  },

  getStats: function() {
    const stats = {};
    for (const lang of Object.keys(this.languages)) {
      stats[lang] = {
        loaded: !!this.translations[lang],
        active: this.current === lang
      };
    }
    return stats;
  }
};

window.App.t = App.I18n.t.bind(App.I18n);

console.log('✅ i18n.js загружен (10 языков)');