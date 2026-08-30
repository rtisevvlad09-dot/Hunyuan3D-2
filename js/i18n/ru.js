/* =========================================================
 *  js/i18n/ru.js
 *  Русские переводы для FLO.RISTA Pro
 * ========================================================= */

App.I18n.loadTranslations('ru', {
  // Общие
  app: {
    name: 'FLO.RISTA',
    tagline: 'Профессиональная система управления',
    loading: 'Загрузка...',
    ready: 'Готово к работе!'
  },

  common: {
    save: 'Сохранить',
    cancel: 'Отмена',
    delete: 'Удалить',
    edit: 'Редактировать',
    close: 'Закрыть',
    search: 'Поиск',
    add: 'Добавить',
    create: 'Создать',
    export: 'Экспорт',
    import: 'Импорт',
    print: 'Печать',
    back: 'Назад',
    next: 'Далее',
    confirm: 'Подтвердить',
    yes: 'Да',
    no: 'Нет',
    all: 'Все',
    none: 'Нет',
    guest: 'Гость',
    language_changed: 'Язык изменён',
    no_data: 'Нет данных',
    error: 'Ошибка',
    success: 'Успешно',
    warning: 'Внимание',
    info: 'Информация',
    choose_language: 'Выберите язык'
  },

  // Навигация
  nav: {
    dashboard: '📊 Дашборд',
    orders: '📦 Заказы',
    flowers: '🌸 Товары',
    bouquets: '💐 Букеты',
    clients: '👥 Клиенты',
    calendar: '📅 Календарь',
    shifts: '⏰ Смены',
    writeoffs: '📉 Списания',
    expenses: '💸 Расходы',
    supplies: '📥 Поставки',
    returns: '↩️ Возвраты',
    analytics: '📈 Аналитика',
    staff: '👥 Персонал',
    settings: '⚙️ Настройки'
  },

  // Роли
  roles: {
    owner: 'Владелец',
    admin: 'Администратор',
    employee: 'Сотрудник'
  },

  // Дашборд
  dashboard: {
    title: 'Дашборд',
    good_morning: 'Доброе утро',
    good_afternoon: 'Добрый день',
    good_evening: 'Добрый вечер',
    good_night: 'Доброй ночи',
    revenue_today: 'Выручка сегодня',
    active_orders: 'Активные заказы',
    low_stock: 'Низкие остатки',
    clients: 'Клиенты',
    quick_actions: 'Быстрые действия',
    recent_orders: 'Последние заказы',
    notifications: 'Уведомления',
    week_chart: 'Выручка за неделю',
    new_order: 'Новый заказ',
    new_client: 'Добавить клиента',
    new_flower: 'Новый товар',
    new_supply: 'Поставка',
    open_calendar: 'Календарь',
    view_analytics: 'Аналитика',
    on_shift: 'На смене',
    open_shift: 'Открыть смену',
    total: 'Всего',
    growth: 'рост',
    decline: 'падение',
    today: 'Сегодня',
    orders: 'заказ',
    orders_few: 'заказа',
    orders_many: 'заказов'
  },

  // Заказы
  orders: {
    title: 'Заказы',
    new: 'Новый заказ',
    edit: 'Редактировать заказ',
    client: 'Клиент',
    items: 'Позиции',
    delivery: 'Доставка',
    total: 'Итого',
    status: 'Статус',
    created: 'Создан',
    statuses: {
      new: '🆕 Новый',
      processing: '⚙️ В работе',
      ready: '✅ Готов',
      completed: '🎉 Выполнен',
      cancelled: '❌ Отменён',
      delivered: '🚚 Доставлен'
    },
    confirm_delete: 'Удалить заказ?',
    saved: 'Заказ сохранён',
    deleted: 'Заказ удалён'
  },

  // Товары
  flowers: {
    title: 'Товары',
    new: 'Новый товар',
    edit: 'Редактировать товар',
    name: 'Название',
    category: 'Категория',
    purchase_price: 'Цена закупки',
    shop_price: 'Цена продажи',
    stock: 'Остаток',
    photo: 'Фото',
    active: 'Активен',
    confirm_delete: 'Удалить товар?',
    saved: 'Товар сохранён',
    deleted: 'Товар удалён'
  },

  // Клиенты
  clients: {
    title: 'Клиенты',
    new: 'Новый клиент',
    edit: 'Редактировать клиента',
    name: 'Имя',
    phone: 'Телефон',
    birthday: 'День рождения',
    orders: 'Заказы',
    total_spent: 'Общая сумма',
    bonus: 'Бонусы',
    confirm_delete: 'Удалить клиента?',
    saved: 'Клиент сохранён',
    deleted: 'Клиент удалён'
  },

  // Финансы (для Этапа 2)
  finance: {
    title: 'Финансы',
    revenue: 'Выручка',
    expenses: 'Расходы',
    profit: 'Прибыль',
    margin: 'Маржа',
    currency: 'Валюта',
    exchange_rate: 'Курс валют',
    today: 'Сегодня',
    yesterday: 'Вчера',
    this_week: 'Эта неделя',
    this_month: 'Этот месяц',
    this_year: 'Этот год',
    vs_last_period: 'к прошлому периоду'
  },

  // Форма входа
  login: {
    title: 'Добро пожаловать',
    subtitle: 'Войдите в корпоративную систему',
    phone: 'Телефон',
    password: 'Пароль',
    remember: 'Запомнить меня',
    button: 'Войти в систему',
    forgot: 'Забыли пароль?',
    error_empty_phone: 'Введите номер телефона',
    error_empty_password: 'Введите пароль',
    error_user_not_found: 'Пользователь не найден',
    error_wrong_password: 'Неверный пароль',
    welcome: 'Добро пожаловать, {name}!'
  },

  // Форма создания владельца
  setup: {
    title: 'Создание первого администратора',
    subtitle: 'Задайте данные владельца системы',
    name: 'ФИО',
    phone: 'Телефон',
    password: 'Пароль',
    password2: 'Подтверждение пароля',
    sec_question: 'Секретный вопрос',
    sec_answer: 'Ответ на секретный вопрос',
    button: 'Создать владельца и войти',
    success: 'Владелец создан!'
  },

  // Выход
  logout: {
    button: 'Выйти',
    message: 'Вы вышли из системы'
  },

  // Ошибки
  errors: {
    generic: 'Произошла ошибка',
    network: 'Нет подключения к интернету',
    permission: 'Нет доступа',
    not_found: 'Не найдено'
  }
});