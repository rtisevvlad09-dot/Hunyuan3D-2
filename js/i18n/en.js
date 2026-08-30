/* =========================================================
 *  js/i18n/en.js
 *  English translations for FLO.RISTA Pro
 * ========================================================= */

App.I18n.loadTranslations('en', {
  app: {
    name: 'FLO.RISTA',
    tagline: 'Professional Management System',
    loading: 'Loading...',
    ready: 'Ready to work!'
  },

  common: {
    save: 'Save',
    cancel: 'Cancel',
    delete: 'Delete',
    edit: 'Edit',
    close: 'Close',
    search: 'Search',
    add: 'Add',
    create: 'Create',
    export: 'Export',
    import: 'Import',
    print: 'Print',
    back: 'Back',
    next: 'Next',
    confirm: 'Confirm',
    yes: 'Yes',
    no: 'No',
    all: 'All',
    none: 'None',
    guest: 'Guest',
    language_changed: 'Language changed',
    no_data: 'No data',
    error: 'Error',
    success: 'Success',
    warning: 'Warning',
    info: 'Information',
    choose_language: 'Choose language'
  },

  nav: {
    dashboard: '📊 Dashboard',
    orders: '📦 Orders',
    flowers: '🌸 Products',
    bouquets: '💐 Bouquets',
    clients: '👥 Clients',
    calendar: '📅 Calendar',
    shifts: '⏰ Shifts',
    writeoffs: '📉 Write-offs',
    expenses: '💸 Expenses',
    supplies: '📥 Supplies',
    returns: '↩️ Returns',
    analytics: '📈 Analytics',
    staff: '👥 Staff',
    settings: '⚙️ Settings'
  },

  roles: {
    owner: 'Owner',
    admin: 'Administrator',
    employee: 'Employee'
  },

  dashboard: {
    title: 'Dashboard',
    good_morning: 'Good morning',
    good_afternoon: 'Good afternoon',
    good_evening: 'Good evening',
    good_night: 'Good night',
    revenue_today: 'Revenue Today',
    active_orders: 'Active Orders',
    low_stock: 'Low Stock',
    clients: 'Clients',
    quick_actions: 'Quick Actions',
    recent_orders: 'Recent Orders',
    notifications: 'Notifications',
    week_chart: 'Weekly Revenue',
    new_order: 'New Order',
    new_client: 'Add Client',
    new_flower: 'New Product',
    new_supply: 'Supply',
    open_calendar: 'Calendar',
    view_analytics: 'Analytics',
    on_shift: 'On Shift',
    open_shift: 'Open Shift',
    total: 'Total',
    growth: 'growth',
    decline: 'decline',
    today: 'Today',
    orders: 'order',
    orders_few: 'orders',
    orders_many: 'orders'
  },

  orders: {
    title: 'Orders',
    new: 'New Order',
    edit: 'Edit Order',
    client: 'Client',
    items: 'Items',
    delivery: 'Delivery',
    total: 'Total',
    status: 'Status',
    created: 'Created',
    statuses: {
      new: '🆕 New',
      processing: '⚙️ Processing',
      ready: '✅ Ready',
      completed: '🎉 Completed',
      cancelled: '❌ Cancelled',
      delivered: '🚚 Delivered'
    },
    confirm_delete: 'Delete order?',
    saved: 'Order saved',
    deleted: 'Order deleted'
  },

  flowers: {
    title: 'Products',
    new: 'New Product',
    edit: 'Edit Product',
    name: 'Name',
    category: 'Category',
    purchase_price: 'Purchase Price',
    shop_price: 'Shop Price',
    stock: 'Stock',
    photo: 'Photo',
    active: 'Active',
    confirm_delete: 'Delete product?',
    saved: 'Product saved',
    deleted: 'Product deleted'
  },

  clients: {
    title: 'Clients',
    new: 'New Client',
    edit: 'Edit Client',
    name: 'Name',
    phone: 'Phone',
    birthday: 'Birthday',
    orders: 'Orders',
    total_spent: 'Total Spent',
    bonus: 'Bonus Points',
    confirm_delete: 'Delete client?',
    saved: 'Client saved',
    deleted: 'Client deleted'
  },

  finance: {
    title: 'Finance',
    revenue: 'Revenue',
    expenses: 'Expenses',
    profit: 'Profit',
    margin: 'Margin',
    currency: 'Currency',
    exchange_rate: 'Exchange Rate',
    today: 'Today',
    yesterday: 'Yesterday',
    this_week: 'This Week',
    this_month: 'This Month',
    this_year: 'This Year',
    vs_last_period: 'vs last period'
  },

  login: {
    title: 'Welcome',
    subtitle: 'Sign in to your account',
    phone: 'Phone',
    password: 'Password',
    remember: 'Remember me',
    button: 'Sign In',
    forgot: 'Forgot password?',
    error_empty_phone: 'Please enter phone number',
    error_empty_password: 'Please enter password',
    error_user_not_found: 'User not found',
    error_wrong_password: 'Wrong password',
    welcome: 'Welcome, {name}!'
  },

  setup: {
    title: 'Create First Administrator',
    subtitle: 'Set up the owner account',
    name: 'Full Name',
    phone: 'Phone',
    password: 'Password',
    password2: 'Confirm Password',
    sec_question: 'Security Question',
    sec_answer: 'Security Answer',
    button: 'Create Owner & Sign In',
    success: 'Owner created!'
  },

  logout: {
    button: 'Log Out',
    message: 'You have been logged out'
  },

  errors: {
    generic: 'An error occurred',
    network: 'No internet connection',
    permission: 'Access denied',
    not_found: 'Not found'
  }
});