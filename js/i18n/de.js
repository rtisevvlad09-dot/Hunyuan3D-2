/* =========================================================
 *  js/i18n/de.js
 *  Deutsche Übersetzungen für FLO.RISTA Pro
 * ========================================================= */

App.I18n.loadTranslations('de', {
  app: {
    name: 'FLO.RISTA',
    tagline: 'Professionelles Managementsystem',
    loading: 'Wird geladen...',
    ready: 'Bereit zur Arbeit!'
  },

  common: {
    save: 'Speichern',
    cancel: 'Abbrechen',
    delete: 'Löschen',
    edit: 'Bearbeiten',
    close: 'Schließen',
    search: 'Suchen',
    add: 'Hinzufügen',
    create: 'Erstellen',
    export: 'Exportieren',
    import: 'Importieren',
    print: 'Drucken',
    back: 'Zurück',
    next: 'Weiter',
    confirm: 'Bestätigen',
    yes: 'Ja',
    no: 'Nein',
    all: 'Alle',
    none: 'Keine',
    guest: 'Gast',
    language_changed: 'Sprache geändert',
    no_data: 'Keine Daten',
    error: 'Fehler',
    success: 'Erfolg',
    warning: 'Warnung',
    info: 'Information',
    choose_language: 'Sprache wählen'
  },

  nav: {
    dashboard: '📊 Dashboard',
    orders: '📦 Bestellungen',
    flowers: '🌸 Produkte',
    bouquets: '💐 Sträuße',
    clients: '👥 Kunden',
    calendar: '📅 Kalender',
    shifts: '⏰ Schichten',
    writeoffs: '📉 Abschreibungen',
    expenses: '💸 Ausgaben',
    supplies: '📥 Lieferungen',
    returns: '↩️ Rückgaben',
    analytics: '📈 Analysen',
    staff: '👥 Personal',
    settings: '⚙️ Einstellungen'
  },

  roles: {
    owner: 'Inhaber',
    admin: 'Administrator',
    employee: 'Mitarbeiter'
  },

  dashboard: {
    title: 'Dashboard',
    good_morning: 'Guten Morgen',
    good_afternoon: 'Guten Tag',
    good_evening: 'Guten Abend',
    good_night: 'Gute Nacht',
    revenue_today: 'Umsatz heute',
    active_orders: 'Aktive Bestellungen',
    low_stock: 'Niedriger Bestand',
    clients: 'Kunden',
    quick_actions: 'Schnellaktionen',
    recent_orders: 'Letzte Bestellungen',
    notifications: 'Benachrichtigungen',
    week_chart: 'Wochenumsatz',
    new_order: 'Neue Bestellung',
    new_client: 'Kunde hinzufügen',
    new_flower: 'Neues Produkt',
    new_supply: 'Lieferung',
    open_calendar: 'Kalender',
    view_analytics: 'Analysen',
    on_shift: 'Im Dienst',
    open_shift: 'Schicht öffnen',
    total: 'Gesamt',
    growth: 'Wachstum',
    decline: 'Rückgang',
    today: 'Heute',
    orders: 'Bestellung',
    orders_few: 'Bestellungen',
    orders_many: 'Bestellungen'
  },

  orders: {
    title: 'Bestellungen',
    new: 'Neue Bestellung',
    edit: 'Bestellung bearbeiten',
    client: 'Kunde',
    items: 'Artikel',
    delivery: 'Lieferung',
    total: 'Gesamt',
    status: 'Status',
    created: 'Erstellt',
    statuses: {
      new: '🆕 Neu',
      processing: '⚙️ In Bearbeitung',
      ready: '✅ Fertig',
      completed: '🎉 Abgeschlossen',
      cancelled: '❌ Storniert',
      delivered: '🚚 Geliefert'
    },
    confirm_delete: 'Bestellung löschen?',
    saved: 'Bestellung gespeichert',
    deleted: 'Bestellung gelöscht'
  },

  flowers: {
    title: 'Produkte',
    new: 'Neues Produkt',
    edit: 'Produkt bearbeiten',
    name: 'Name',
    category: 'Kategorie',
    purchase_price: 'Einkaufspreis',
    shop_price: 'Verkaufspreis',
    stock: 'Bestand',
    photo: 'Foto',
    active: 'Aktiv',
    confirm_delete: 'Produkt löschen?',
    saved: 'Produkt gespeichert',
    deleted: 'Produkt gelöscht'
  },

  clients: {
    title: 'Kunden',
    new: 'Neuer Kunde',
    edit: 'Kunde bearbeiten',
    name: 'Name',
    phone: 'Telefon',
    birthday: 'Geburtstag',
    orders: 'Bestellungen',
    total_spent: 'Gesamt ausgegeben',
    bonus: 'Bonuspunkte',
    confirm_delete: 'Kunde löschen?',
    saved: 'Kunde gespeichert',
    deleted: 'Kunde gelöscht'
  },

  finance: {
    title: 'Finanzen',
    revenue: 'Umsatz',
    expenses: 'Ausgaben',
    profit: 'Gewinn',
    margin: 'Marge',
    currency: 'Währung',
    exchange_rate: 'Wechselkurs',
    today: 'Heute',
    yesterday: 'Gestern',
    this_week: 'Diese Woche',
    this_month: 'Diesen Monat',
    this_year: 'Dieses Jahr',
    vs_last_period: 'vs Vorperiode'
  },

  login: {
    title: 'Willkommen',
    subtitle: 'Melden Sie sich bei Ihrem Konto an',
    phone: 'Telefon',
    password: 'Passwort',
    remember: 'Angemeldet bleiben',
    button: 'Anmelden',
    forgot: 'Passwort vergessen?',
    error_empty_phone: 'Bitte Telefonnummer eingeben',
    error_empty_password: 'Bitte Passwort eingeben',
    error_user_not_found: 'Benutzer nicht gefunden',
    error_wrong_password: 'Falsches Passwort',
    welcome: 'Willkommen, {name}!'
  },

  setup: {
    title: 'Ersten Administrator erstellen',
    subtitle: 'Richten Sie das Inhaberkonto ein',
    name: 'Vollständiger Name',
    phone: 'Telefon',
    password: 'Passwort',
    password2: 'Passwort bestätigen',
    sec_question: 'Sicherheitsfrage',
    sec_answer: 'Sicherheitsantwort',
    button: 'Inhaber erstellen und anmelden',
    success: 'Inhaber erstellt!'
  },

  logout: {
    button: 'Abmelden',
    message: 'Sie wurden abgemeldet'
  },

  errors: {
    generic: 'Ein Fehler ist aufgetreten',
    network: 'Keine Internetverbindung',
    permission: 'Zugriff verweigert',
    not_found: 'Nicht gefunden'
  }
});