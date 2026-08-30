/* =========================================================
 *  js/i18n/pt.js
 *  Traduções em português para FLO.RISTA Pro
 * ========================================================= */

App.I18n.loadTranslations('pt', {
  app: {
    name: 'FLO.RISTA',
    tagline: 'Sistema de gestão profissional',
    loading: 'Carregando...',
    ready: 'Pronto para trabalhar!'
  },

  common: {
    save: 'Salvar',
    cancel: 'Cancelar',
    delete: 'Excluir',
    edit: 'Editar',
    close: 'Fechar',
    search: 'Pesquisar',
    add: 'Adicionar',
    create: 'Criar',
    export: 'Exportar',
    import: 'Importar',
    print: 'Imprimir',
    back: 'Voltar',
    next: 'Próximo',
    confirm: 'Confirmar',
    yes: 'Sim',
    no: 'Não',
    all: 'Todos',
    none: 'Nenhum',
    guest: 'Convidado',
    language_changed: 'Idioma alterado',
    no_data: 'Sem dados',
    error: 'Erro',
    success: 'Sucesso',
    warning: 'Atenção',
    info: 'Informação',
    choose_language: 'Escolha o idioma'
  },

  nav: {
    dashboard: '📊 Painel',
    orders: '📦 Pedidos',
    flowers: '🌸 Produtos',
    bouquets: '💐 Buquês',
    clients: '👥 Clientes',
    calendar: '📅 Calendário',
    shifts: '⏰ Turnos',
    writeoffs: '📉 Baixas',
    expenses: '💸 Despesas',
    supplies: '📥 Fornecimentos',
    returns: '↩️ Devoluções',
    analytics: '📈 Análises',
    staff: '👥 Equipe',
    settings: '⚙️ Configurações'
  },

  roles: {
    owner: 'Proprietário',
    admin: 'Administrador',
    employee: 'Funcionário'
  },

  dashboard: {
    title: 'Painel',
    good_morning: 'Bom dia',
    good_afternoon: 'Boa tarde',
    good_evening: 'Boa noite',
    good_night: 'Boa noite',
    revenue_today: 'Receita de hoje',
    active_orders: 'Pedidos ativos',
    low_stock: 'Estoque baixo',
    clients: 'Clientes',
    quick_actions: 'Ações rápidas',
    recent_orders: 'Pedidos recentes',
    notifications: 'Notificações',
    week_chart: 'Receita semanal',
    new_order: 'Novo pedido',
    new_client: 'Adicionar cliente',
    new_flower: 'Novo produto',
    new_supply: 'Fornecimento',
    open_calendar: 'Calendário',
    view_analytics: 'Análises',
    on_shift: 'Em turno',
    open_shift: 'Abrir turno',
    total: 'Total',
    growth: 'crescimento',
    decline: 'queda',
    today: 'Hoje',
    orders: 'pedido',
    orders_few: 'pedidos',
    orders_many: 'pedidos'
  },

  orders: {
    title: 'Pedidos',
    new: 'Novo pedido',
    edit: 'Editar pedido',
    client: 'Cliente',
    items: 'Itens',
    delivery: 'Entrega',
    total: 'Total',
    status: 'Status',
    created: 'Criado',
    statuses: {
      new: '🆕 Novo',
      processing: '⚙️ Em andamento',
      ready: '✅ Pronto',
      completed: '🎉 Concluído',
      cancelled: '❌ Cancelado',
      delivered: '🚚 Entregue'
    },
    confirm_delete: 'Excluir pedido?',
    saved: 'Pedido salvo',
    deleted: 'Pedido excluído'
  },

  flowers: {
    title: 'Produtos',
    new: 'Novo produto',
    edit: 'Editar produto',
    name: 'Nome',
    category: 'Categoria',
    purchase_price: 'Preço de compra',
    shop_price: 'Preço de venda',
    stock: 'Estoque',
    photo: 'Foto',
    active: 'Ativo',
    confirm_delete: 'Excluir produto?',
    saved: 'Produto salvo',
    deleted: 'Produto excluído'
  },

  clients: {
    title: 'Clientes',
    new: 'Novo cliente',
    edit: 'Editar cliente',
    name: 'Nome',
    phone: 'Telefone',
    birthday: 'Aniversário',
    orders: 'Pedidos',
    total_spent: 'Total gasto',
    bonus: 'Pontos bônus',
    confirm_delete: 'Excluir cliente?',
    saved: 'Cliente salvo',
    deleted: 'Cliente excluído'
  },

  finance: {
    title: 'Finanças',
    revenue: 'Receita',
    expenses: 'Despesas',
    profit: 'Lucro',
    margin: 'Margem',
    currency: 'Moeda',
    exchange_rate: 'Taxa de câmbio',
    today: 'Hoje',
    yesterday: 'Ontem',
    this_week: 'Esta semana',
    this_month: 'Este mês',
    this_year: 'Este ano',
    vs_last_period: 'vs período anterior'
  },

  login: {
    title: 'Bem-vindo',
    subtitle: 'Entre na sua conta',
    phone: 'Telefone',
    password: 'Senha',
    remember: 'Lembrar-me',
    button: 'Entrar',
    forgot: 'Esqueceu a senha?',
    error_empty_phone: 'Digite o número de telefone',
    error_empty_password: 'Digite a senha',
    error_user_not_found: 'Usuário não encontrado',
    error_wrong_password: 'Senha incorreta',
    welcome: 'Bem-vindo, {name}!'
  },

  setup: {
    title: 'Criar o primeiro administrador',
    subtitle: 'Configure a conta do proprietário',
    name: 'Nome completo',
    phone: 'Telefone',
    password: 'Senha',
    password2: 'Confirmar senha',
    sec_question: 'Pergunta de segurança',
    sec_answer: 'Resposta de segurança',
    button: 'Criar proprietário e entrar',
    success: 'Proprietário criado!'
  },

  logout: {
    button: 'Sair',
    message: 'Você saiu do sistema'
  },

  errors: {
    generic: 'Ocorreu um erro',
    network: 'Sem conexão com a internet',
    permission: 'Acesso negado',
    not_found: 'Não encontrado'
  }
});