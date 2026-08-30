/* =========================================================
 *  js/i18n/pl.js
 *  Polskie tłumaczenia dla FLO.RISTA Pro
 * ========================================================= */

App.I18n.loadTranslations('pl', {
  app: {
    name: 'FLO.RISTA',
    tagline: 'Profesjonalny system zarządzania',
    loading: 'Ładowanie...',
    ready: 'Gotowy do pracy!'
  },

  common: {
    save: 'Zapisz',
    cancel: 'Anuluj',
    delete: 'Usuń',
    edit: 'Edytuj',
    close: 'Zamknij',
    search: 'Szukaj',
    add: 'Dodaj',
    create: 'Utwórz',
    export: 'Eksportuj',
    import: 'Importuj',
    print: 'Drukuj',
    back: 'Wstecz',
    next: 'Dalej',
    confirm: 'Potwierdź',
    yes: 'Tak',
    no: 'Nie',
    all: 'Wszystkie',
    none: 'Brak',
    guest: 'Gość',
    language_changed: 'Język zmieniony',
    no_data: 'Brak danych',
    error: 'Błąd',
    success: 'Sukces',
    warning: 'Ostrzeżenie',
    info: 'Informacja',
    choose_language: 'Wybierz język'
  },

  nav: {
    dashboard: '📊 Pulpit',
    orders: '📦 Zamówienia',
    flowers: '🌸 Produkty',
    bouquets: '💐 Bukiety',
    clients: '👥 Klienci',
    calendar: '📅 Kalendarz',
    shifts: '⏰ Zmiany',
    writeoffs: '📉 Odpisy',
    expenses: '💸 Wydatki',
    supplies: '📥 Dostawy',
    returns: '↩️ Zwroty',
    analytics: '📈 Analizy',
    staff: '👥 Personel',
    settings: '⚙️ Ustawienia'
  },

  roles: {
    owner: 'Właściciel',
    admin: 'Administrator',
    employee: 'Pracownik'
  },

  dashboard: {
    title: 'Pulpit',
    good_morning: 'Dzień dobry',
    good_afternoon: 'Dzień dobry',
    good_evening: 'Dobry wieczór',
    good_night: 'Dobranoc',
    revenue_today: 'Przychód dzisiaj',
    active_orders: 'Aktywne zamówienia',
    low_stock: 'Niski stan magazynowy',
    clients: 'Klienci',
    quick_actions: 'Szybkie akcje',
    recent_orders: 'Ostatnie zamówienia',
    notifications: 'Powiadomienia',
    week_chart: 'Przychód tygodniowy',
    new_order: 'Nowe zamówienie',
    new_client: 'Dodaj klienta',
    new_flower: 'Nowy produkt',
    new_supply: 'Dostawa',
    open_calendar: 'Kalendarz',
    view_analytics: 'Analizy',
    on_shift: 'Na zmianie',
    open_shift: 'Rozpocznij zmianę',
    total: 'Razem',
    growth: 'wzrost',
    decline: 'spadek',
    today: 'Dzisiaj',
    orders: 'zamówienie',
    orders_few: 'zamówienia',
    orders_many: 'zamówień'
  },

  orders: {
    title: 'Zamówienia',
    new: 'Nowe zamówienie',
    edit: 'Edytuj zamówienie',
    client: 'Klient',
    items: 'Pozycje',
    delivery: 'Dostawa',
    total: 'Razem',
    status: 'Status',
    created: 'Utworzono',
    statuses: {
      new: '🆕 Nowe',
      processing: '⚙️ W realizacji',
      ready: '✅ Gotowe',
      completed: '🎉 Zakończone',
      cancelled: '❌ Anulowane',
      delivered: '🚚 Dostarczone'
    },
    confirm_delete: 'Usunąć zamówienie?',
    saved: 'Zamówienie zapisane',
    deleted: 'Zamówienie usunięte'
  },

  flowers: {
    title: 'Produkty',
    new: 'Nowy produkt',
    edit: 'Edytuj produkt',
    name: 'Nazwa',
    category: 'Kategoria',
    purchase_price: 'Cena zakupu',
    shop_price: 'Cena sprzedaży',
    stock: 'Stan magazynowy',
    photo: 'Zdjęcie',
    active: 'Aktywny',
    confirm_delete: 'Usunąć produkt?',
    saved: 'Produkt zapisany',
    deleted: 'Produkt usunięty'
  },

  clients: {
    title: 'Klienci',
    new: 'Nowy klient',
    edit: 'Edytuj klienta',
    name: 'Imię',
    phone: 'Telefon',
    birthday: 'Urodziny',
    orders: 'Zamówienia',
    total_spent: 'Łącznie wydano',
    bonus: 'Punkty bonusowe',
    confirm_delete: 'Usunąć klienta?',
    saved: 'Klient zapisany',
    deleted: 'Klient usunięty'
  },

  finance: {
    title: 'Finanse',
    revenue: 'Przychód',
    expenses: 'Wydatki',
    profit: 'Zysk',
    margin: 'Marża',
    currency: 'Waluta',
    exchange_rate: 'Kurs wymiany',
    today: 'Dzisiaj',
    yesterday: 'Wczoraj',
    this_week: 'Ten tydzień',
    this_month: 'Ten miesiąc',
    this_year: 'Ten rok',
    vs_last_period: 'vs poprzedni okres'
  },

  login: {
    title: 'Witamy',
    subtitle: 'Zaloguj się na swoje konto',
    phone: 'Telefon',
    password: 'Hasło',
    remember: 'Zapamiętaj mnie',
    button: 'Zaloguj się',
    forgot: 'Nie pamiętasz hasła?',
    error_empty_phone: 'Wprowadź numer telefonu',
    error_empty_password: 'Wprowadź hasło',
    error_user_not_found: 'Nie znaleziono użytkownika',
    error_wrong_password: 'Nieprawidłowe hasło',
    welcome: 'Witamy, {name}!'
  },

  setup: {
    title: 'Utwórz pierwszego administratora',
    subtitle: 'Skonfiguruj konto właściciela',
    name: 'Imię i nazwisko',
    phone: 'Telefon',
    password: 'Hasło',
    password2: 'Potwierdź hasło',
    sec_question: 'Pytanie bezpieczeństwa',
    sec_answer: 'Odpowiedź bezpieczeństwa',
    button: 'Utwórz właściciela i zaloguj się',
    success: 'Właściciel utworzony!'
  },

  logout: {
    button: 'Wyloguj',
    message: 'Wylogowano z systemu'
  },

  errors: {
    generic: 'Wystąpił błąd',
    network: 'Brak połączenia z internetem',
    permission: 'Brak dostępu',
    not_found: 'Nie znaleziono'
  }
});