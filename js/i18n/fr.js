/* =========================================================
 *  js/i18n/fr.js
 *  Traductions françaises pour FLO.RISTA Pro
 * ========================================================= */

App.I18n.loadTranslations('fr', {
  app: {
    name: 'FLO.RISTA',
    tagline: 'Système de gestion professionnel',
    loading: 'Chargement...',
    ready: 'Prêt à travailler !'
  },

  common: {
    save: 'Enregistrer',
    cancel: 'Annuler',
    delete: 'Supprimer',
    edit: 'Modifier',
    close: 'Fermer',
    search: 'Rechercher',
    add: 'Ajouter',
    create: 'Créer',
    export: 'Exporter',
    import: 'Importer',
    print: 'Imprimer',
    back: 'Retour',
    next: 'Suivant',
    confirm: 'Confirmer',
    yes: 'Oui',
    no: 'Non',
    all: 'Tous',
    none: 'Aucun',
    guest: 'Invité',
    language_changed: 'Langue modifiée',
    no_data: 'Aucune donnée',
    error: 'Erreur',
    success: 'Succès',
    warning: 'Attention',
    info: 'Information',
    choose_language: 'Choisir la langue'
  },

  nav: {
    dashboard: '📊 Tableau de bord',
    orders: '📦 Commandes',
    flowers: '🌸 Produits',
    bouquets: '💐 Bouquets',
    clients: '👥 Clients',
    calendar: '📅 Calendrier',
    shifts: '⏰ Quarts de travail',
    writeoffs: '📉 Pertes',
    expenses: '💸 Dépenses',
    supplies: '📥 Approvisionnements',
    returns: '↩️ Retours',
    analytics: '📈 Analyses',
    staff: '👥 Personnel',
    settings: '⚙️ Paramètres'
  },

  roles: {
    owner: 'Propriétaire',
    admin: 'Administrateur',
    employee: 'Employé'
  },

  dashboard: {
    title: 'Tableau de bord',
    good_morning: 'Bonjour',
    good_afternoon: 'Bon après-midi',
    good_evening: 'Bonsoir',
    good_night: 'Bonne nuit',
    revenue_today: 'Revenus du jour',
    active_orders: 'Commandes actives',
    low_stock: 'Stock faible',
    clients: 'Clients',
    quick_actions: 'Actions rapides',
    recent_orders: 'Commandes récentes',
    notifications: 'Notifications',
    week_chart: 'Revenus hebdomadaires',
    new_order: 'Nouvelle commande',
    new_client: 'Ajouter un client',
    new_flower: 'Nouveau produit',
    new_supply: 'Approvisionnement',
    open_calendar: 'Calendrier',
    view_analytics: 'Analyses',
    on_shift: 'En service',
    open_shift: 'Ouvrir un quart',
    total: 'Total',
    growth: 'croissance',
    decline: 'baisse',
    today: 'Aujourd\'hui',
    orders: 'commande',
    orders_few: 'commandes',
    orders_many: 'commandes'
  },

  orders: {
    title: 'Commandes',
    new: 'Nouvelle commande',
    edit: 'Modifier la commande',
    client: 'Client',
    items: 'Articles',
    delivery: 'Livraison',
    total: 'Total',
    status: 'Statut',
    created: 'Créé',
    statuses: {
      new: '🆕 Nouveau',
      processing: '⚙️ En cours',
      ready: '✅ Prêt',
      completed: '🎉 Terminé',
      cancelled: '❌ Annulé',
      delivered: '🚚 Livré'
    },
    confirm_delete: 'Supprimer la commande ?',
    saved: 'Commande enregistrée',
    deleted: 'Commande supprimée'
  },

  flowers: {
    title: 'Produits',
    new: 'Nouveau produit',
    edit: 'Modifier le produit',
    name: 'Nom',
    category: 'Catégorie',
    purchase_price: 'Prix d\'achat',
    shop_price: 'Prix de vente',
    stock: 'Stock',
    photo: 'Photo',
    active: 'Actif',
    confirm_delete: 'Supprimer le produit ?',
    saved: 'Produit enregistré',
    deleted: 'Produit supprimé'
  },

  clients: {
    title: 'Clients',
    new: 'Nouveau client',
    edit: 'Modifier le client',
    name: 'Nom',
    phone: 'Téléphone',
    birthday: 'Anniversaire',
    orders: 'Commandes',
    total_spent: 'Total dépensé',
    bonus: 'Points bonus',
    confirm_delete: 'Supprimer le client ?',
    saved: 'Client enregistré',
    deleted: 'Client supprimé'
  },

  finance: {
    title: 'Finances',
    revenue: 'Revenus',
    expenses: 'Dépenses',
    profit: 'Bénéfice',
    margin: 'Marge',
    currency: 'Devise',
    exchange_rate: 'Taux de change',
    today: 'Aujourd\'hui',
    yesterday: 'Hier',
    this_week: 'Cette semaine',
    this_month: 'Ce mois',
    this_year: 'Cette année',
    vs_last_period: 'vs période précédente'
  },

  login: {
    title: 'Bienvenue',
    subtitle: 'Connectez-vous à votre compte',
    phone: 'Téléphone',
    password: 'Mot de passe',
    remember: 'Se souvenir de moi',
    button: 'Se connecter',
    forgot: 'Mot de passe oublié ?',
    error_empty_phone: 'Veuillez entrer le numéro de téléphone',
    error_empty_password: 'Veuillez entrer le mot de passe',
    error_user_not_found: 'Utilisateur non trouvé',
    error_wrong_password: 'Mot de passe incorrect',
    welcome: 'Bienvenue, {name} !'
  },

  setup: {
    title: 'Créer le premier administrateur',
    subtitle: 'Configurez le compte du propriétaire',
    name: 'Nom complet',
    phone: 'Téléphone',
    password: 'Mot de passe',
    password2: 'Confirmer le mot de passe',
    sec_question: 'Question de sécurité',
    sec_answer: 'Réponse de sécurité',
    button: 'Créer le propriétaire et se connecter',
    success: 'Propriétaire créé !'
  },

  logout: {
    button: 'Déconnexion',
    message: 'Vous avez été déconnecté'
  },

  errors: {
    generic: 'Une erreur est survenue',
    network: 'Pas de connexion internet',
    permission: 'Accès refusé',
    not_found: 'Non trouvé'
  }
});