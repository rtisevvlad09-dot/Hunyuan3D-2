/* =========================================================
 *  js/i18n/es.js
 *  Traducciones al español para FLO.RISTA Pro
 * ========================================================= */

App.I18n.loadTranslations('es', {
  app: {
    name: 'FLO.RISTA',
    tagline: 'Sistema de gestión profesional',
    loading: 'Cargando...',
    ready: '¡Listo para trabajar!'
  },

  common: {
    save: 'Guardar',
    cancel: 'Cancelar',
    delete: 'Eliminar',
    edit: 'Editar',
    close: 'Cerrar',
    search: 'Buscar',
    add: 'Añadir',
    create: 'Crear',
    export: 'Exportar',
    import: 'Importar',
    print: 'Imprimir',
    back: 'Atrás',
    next: 'Siguiente',
    confirm: 'Confirmar',
    yes: 'Sí',
    no: 'No',
    all: 'Todos',
    none: 'Ninguno',
    guest: 'Invitado',
    language_changed: 'Idioma cambiado',
    no_data: 'Sin datos',
    error: 'Error',
    success: 'Éxito',
    warning: 'Advertencia',
    info: 'Información',
    choose_language: 'Elige el idioma'
  },

  nav: {
    dashboard: '📊 Panel',
    orders: '📦 Pedidos',
    flowers: '🌸 Productos',
    bouquets: '💐 Ramos',
    clients: '👥 Clientes',
    calendar: '📅 Calendario',
    shifts: '⏰ Turnos',
    writeoffs: '📉 Bajas',
    expenses: '💸 Gastos',
    supplies: '📥 Suministros',
    returns: '↩️ Devoluciones',
    analytics: '📈 Análisis',
    staff: '👥 Personal',
    settings: '⚙️ Configuración'
  },

  roles: {
    owner: 'Propietario',
    admin: 'Administrador',
    employee: 'Empleado'
  },

  dashboard: {
    title: 'Panel',
    good_morning: 'Buenos días',
    good_afternoon: 'Buenas tardes',
    good_evening: 'Buenas noches',
    good_night: 'Buenas noches',
    revenue_today: 'Ingresos de hoy',
    active_orders: 'Pedidos activos',
    low_stock: 'Stock bajo',
    clients: 'Clientes',
    quick_actions: 'Acciones rápidas',
    recent_orders: 'Pedidos recientes',
    notifications: 'Notificaciones',
    week_chart: 'Ingresos semanales',
    new_order: 'Nuevo pedido',
    new_client: 'Añadir cliente',
    new_flower: 'Nuevo producto',
    new_supply: 'Suministro',
    open_calendar: 'Calendario',
    view_analytics: 'Análisis',
    on_shift: 'En turno',
    open_shift: 'Abrir turno',
    total: 'Total',
    growth: 'crecimiento',
    decline: 'descenso',
    today: 'Hoy',
    orders: 'pedido',
    orders_few: 'pedidos',
    orders_many: 'pedidos'
  },

  orders: {
    title: 'Pedidos',
    new: 'Nuevo pedido',
    edit: 'Editar pedido',
    client: 'Cliente',
    items: 'Artículos',
    delivery: 'Entrega',
    total: 'Total',
    status: 'Estado',
    created: 'Creado',
    statuses: {
      new: '🆕 Nuevo',
      processing: '⚙️ En proceso',
      ready: '✅ Listo',
      completed: '🎉 Completado',
      cancelled: '❌ Cancelado',
      delivered: '🚚 Entregado'
    },
    confirm_delete: '¿Eliminar pedido?',
    saved: 'Pedido guardado',
    deleted: 'Pedido eliminado'
  },

  flowers: {
    title: 'Productos',
    new: 'Nuevo producto',
    edit: 'Editar producto',
    name: 'Nombre',
    category: 'Categoría',
    purchase_price: 'Precio de compra',
    shop_price: 'Precio de venta',
    stock: 'Stock',
    photo: 'Foto',
    active: 'Activo',
    confirm_delete: '¿Eliminar producto?',
    saved: 'Producto guardado',
    deleted: 'Producto eliminado'
  },

  clients: {
    title: 'Clientes',
    new: 'Nuevo cliente',
    edit: 'Editar cliente',
    name: 'Nombre',
    phone: 'Teléfono',
    birthday: 'Cumpleaños',
    orders: 'Pedidos',
    total_spent: 'Total gastado',
    bonus: 'Puntos de bonificación',
    confirm_delete: '¿Eliminar cliente?',
    saved: 'Cliente guardado',
    deleted: 'Cliente eliminado'
  },

  finance: {
    title: 'Finanzas',
    revenue: 'Ingresos',
    expenses: 'Gastos',
    profit: 'Beneficio',
    margin: 'Margen',
    currency: 'Moneda',
    exchange_rate: 'Tipo de cambio',
    today: 'Hoy',
    yesterday: 'Ayer',
    this_week: 'Esta semana',
    this_month: 'Este mes',
    this_year: 'Este año',
    vs_last_period: 'vs período anterior'
  },

  login: {
    title: 'Bienvenido',
    subtitle: 'Inicia sesión en tu cuenta',
    phone: 'Teléfono',
    password: 'Contraseña',
    remember: 'Recuérdame',
    button: 'Iniciar sesión',
    forgot: '¿Olvidaste tu contraseña?',
    error_empty_phone: 'Introduce el número de teléfono',
    error_empty_password: 'Introduce la contraseña',
    error_user_not_found: 'Usuario no encontrado',
    error_wrong_password: 'Contraseña incorrecta',
    welcome: '¡Bienvenido, {name}!'
  },

  setup: {
    title: 'Crear el primer administrador',
    subtitle: 'Configura la cuenta del propietario',
    name: 'Nombre completo',
    phone: 'Teléfono',
    password: 'Contraseña',
    password2: 'Confirmar contraseña',
    sec_question: 'Pregunta de seguridad',
    sec_answer: 'Respuesta de seguridad',
    button: 'Crear propietario e iniciar sesión',
    success: '¡Propietario creado!'
  },

  logout: {
    button: 'Cerrar sesión',
    message: 'Has cerrado sesión'
  },

  errors: {
    generic: 'Se produjo un error',
    network: 'Sin conexión a internet',
    permission: 'Acceso denegado',
    not_found: 'No encontrado'
  }
});