/* =========================================================
 *  js/i18n/it.js
 *  Traduzioni italiane per FLO.RISTA Pro
 * ========================================================= */

App.I18n.loadTranslations('it', {
  app: {
    name: 'FLO.RISTA',
    tagline: 'Sistema di gestione professionale',
    loading: 'Caricamento...',
    ready: 'Pronto al lavoro!'
  },

  common: {
    save: 'Salva',
    cancel: 'Annulla',
    delete: 'Elimina',
    edit: 'Modifica',
    close: 'Chiudi',
    search: 'Cerca',
    add: 'Aggiungi',
    create: 'Crea',
    export: 'Esporta',
    import: 'Importa',
    print: 'Stampa',
    back: 'Indietro',
    next: 'Avanti',
    confirm: 'Conferma',
    yes: 'Sì',
    no: 'No',
    all: 'Tutti',
    none: 'Nessuno',
    guest: 'Ospite',
    language_changed: 'Lingua cambiata',
    no_data: 'Nessun dato',
    error: 'Errore',
    success: 'Successo',
    warning: 'Attenzione',
    info: 'Informazione',
    choose_language: 'Scegli la lingua'
  },

  nav: {
    dashboard: '📊 Dashboard',
    orders: '📦 Ordini',
    flowers: '🌸 Prodotti',
    bouquets: '💐 Bouquet',
    clients: '👥 Clienti',
    calendar: '📅 Calendario',
    shifts: '⏰ Turni',
    writeoffs: '📉 Scarti',
    expenses: '💸 Spese',
    supplies: '📥 Forniture',
    returns: '↩️ Resi',
    analytics: '📈 Analisi',
    staff: '👥 Personale',
    settings: '⚙️ Impostazioni'
  },

  roles: {
    owner: 'Proprietario',
    admin: 'Amministratore',
    employee: 'Dipendente'
  },

  dashboard: {
    title: 'Dashboard',
    good_morning: 'Buongiorno',
    good_afternoon: 'Buon pomeriggio',
    good_evening: 'Buonasera',
    good_night: 'Buonanotte',
    revenue_today: 'Ricavi di oggi',
    active_orders: 'Ordini attivi',
    low_stock: 'Scorte basse',
    clients: 'Clienti',
    quick_actions: 'Azioni rapide',
    recent_orders: 'Ordini recenti',
    notifications: 'Notifiche',
    week_chart: 'Ricavi settimanali',
    new_order: 'Nuovo ordine',
    new_client: 'Aggiungi cliente',
    new_flower: 'Nuovo prodotto',
    new_supply: 'Fornitura',
    open_calendar: 'Calendario',
    view_analytics: 'Analisi',
    on_shift: 'In turno',
    open_shift: 'Apri turno',
    total: 'Totale',
    growth: 'crescita',
    decline: 'calo',
    today: 'Oggi',
    orders: 'ordine',
    orders_few: 'ordini',
    orders_many: 'ordini'
  },

  orders: {
    title: 'Ordini',
    new: 'Nuovo ordine',
    edit: 'Modifica ordine',
    client: 'Cliente',
    items: 'Articoli',
    delivery: 'Consegna',
    total: 'Totale',
    status: 'Stato',
    created: 'Creato',
    statuses: {
      new: '🆕 Nuovo',
      processing: '⚙️ In lavorazione',
      ready: '✅ Pronto',
      completed: '🎉 Completato',
      cancelled: '❌ Annullato',
      delivered: '🚚 Consegnato'
    },
    confirm_delete: 'Eliminare l\'ordine?',
    saved: 'Ordine salvato',
    deleted: 'Ordine eliminato'
  },

  flowers: {
    title: 'Prodotti',
    new: 'Nuovo prodotto',
    edit: 'Modifica prodotto',
    name: 'Nome',
    category: 'Categoria',
    purchase_price: 'Prezzo di acquisto',
    shop_price: 'Prezzo di vendita',
    stock: 'Disponibilità',
    photo: 'Foto',
    active: 'Attivo',
    confirm_delete: 'Eliminare il prodotto?',
    saved: 'Prodotto salvato',
    deleted: 'Prodotto eliminato'
  },

  clients: {
    title: 'Clienti',
    new: 'Nuovo cliente',
    edit: 'Modifica cliente',
    name: 'Nome',
    phone: 'Telefono',
    birthday: 'Compleanno',
    orders: 'Ordini',
    total_spent: 'Totale speso',
    bonus: 'Punti bonus',
    confirm_delete: 'Eliminare il cliente?',
    saved: 'Cliente salvato',
    deleted: 'Cliente eliminato'
  },

  finance: {
    title: 'Finanze',
    revenue: 'Ricavi',
    expenses: 'Spese',
    profit: 'Profitto',
    margin: 'Margine',
    currency: 'Valuta',
    exchange_rate: 'Tasso di cambio',
    today: 'Oggi',
    yesterday: 'Ieri',
    this_week: 'Questa settimana',
    this_month: 'Questo mese',
    this_year: 'Quest\'anno',
    vs_last_period: 'vs periodo precedente'
  },

  login: {
    title: 'Benvenuto',
    subtitle: 'Accedi al tuo account',
    phone: 'Telefono',
    password: 'Password',
    remember: 'Ricordami',
    button: 'Accedi',
    forgot: 'Password dimenticata?',
    error_empty_phone: 'Inserisci il numero di telefono',
    error_empty_password: 'Inserisci la password',
    error_user_not_found: 'Utente non trovato',
    error_wrong_password: 'Password errata',
    welcome: 'Benvenuto, {name}!'
  },

  setup: {
    title: 'Crea il primo amministratore',
    subtitle: 'Configura l\'account del proprietario',
    name: 'Nome completo',
    phone: 'Telefono',
    password: 'Password',
    password2: 'Conferma password',
    sec_question: 'Domanda di sicurezza',
    sec_answer: 'Risposta di sicurezza',
    button: 'Crea proprietario e accedi',
    success: 'Proprietario creato!'
  },

  logout: {
    button: 'Esci',
    message: 'Sei uscito dal sistema'
  },

  errors: {
    generic: 'Si è verificato un errore',
    network: 'Nessuna connessione internet',
    permission: 'Accesso negato',
    not_found: 'Non trovato'
  }
});