/* =========================================================
 *  js/i18n/tr.js
 *  FLO.RISTA Pro için Türkçe çeviriler
 * ========================================================= */

App.I18n.loadTranslations('tr', {
  app: {
    name: 'FLO.RISTA',
    tagline: 'Profesyonel yönetim sistemi',
    loading: 'Yükleniyor...',
    ready: 'Çalışmaya hazır!'
  },

  common: {
    save: 'Kaydet',
    cancel: 'İptal',
    delete: 'Sil',
    edit: 'Düzenle',
    close: 'Kapat',
    search: 'Ara',
    add: 'Ekle',
    create: 'Oluştur',
    export: 'Dışa aktar',
    import: 'İçe aktar',
    print: 'Yazdır',
    back: 'Geri',
    next: 'İleri',
    confirm: 'Onayla',
    yes: 'Evet',
    no: 'Hayır',
    all: 'Tümü',
    none: 'Yok',
    guest: 'Misafir',
    language_changed: 'Dil değiştirildi',
    no_data: 'Veri yok',
    error: 'Hata',
    success: 'Başarılı',
    warning: 'Uyarı',
    info: 'Bilgi',
    choose_language: 'Dil seçin'
  },

  nav: {
    dashboard: '📊 Panel',
    orders: '📦 Siparişler',
    flowers: '🌸 Ürünler',
    bouquets: '💐 Buketler',
    clients: '👥 Müşteriler',
    calendar: '📅 Takvim',
    shifts: '⏰ Vardiyalar',
    writeoffs: '📉 İadeler',
    expenses: '💸 Giderler',
    supplies: '📥 Tedarikler',
    returns: '↩️ İadeler',
    analytics: '📈 Analizler',
    staff: '👥 Personel',
    settings: '⚙️ Ayarlar'
  },

  roles: {
    owner: 'Sahip',
    admin: 'Yönetici',
    employee: 'Çalışan'
  },

  dashboard: {
    title: 'Panel',
    good_morning: 'Günaydın',
    good_afternoon: 'İyi günler',
    good_evening: 'İyi akşamlar',
    good_night: 'İyi geceler',
    revenue_today: 'Bugünkü gelir',
    active_orders: 'Aktif siparişler',
    low_stock: 'Düşük stok',
    clients: 'Müşteriler',
    quick_actions: 'Hızlı işlemler',
    recent_orders: 'Son siparişler',
    notifications: 'Bildirimler',
    week_chart: 'Haftalık gelir',
    new_order: 'Yeni sipariş',
    new_client: 'Müşteri ekle',
    new_flower: 'Yeni ürün',
    new_supply: 'Tedarik',
    open_calendar: 'Takvim',
    view_analytics: 'Analizler',
    on_shift: 'Vardiyada',
    open_shift: 'Vardiya başlat',
    total: 'Toplam',
    growth: 'büyüme',
    decline: 'düşüş',
    today: 'Bugün',
    orders: 'sipariş',
    orders_few: 'sipariş',
    orders_many: 'sipariş'
  },

  orders: {
    title: 'Siparişler',
    new: 'Yeni sipariş',
    edit: 'Siparişi düzenle',
    client: 'Müşteri',
    items: 'Ürünler',
    delivery: 'Teslimat',
    total: 'Toplam',
    status: 'Durum',
    created: 'Oluşturuldu',
    statuses: {
      new: '🆕 Yeni',
      processing: '⚙️ İşleniyor',
      ready: '✅ Hazır',
      completed: '🎉 Tamamlandı',
      cancelled: '❌ İptal edildi',
      delivered: '🚚 Teslim edildi'
    },
    confirm_delete: 'Sipariş silinsin mi?',
    saved: 'Sipariş kaydedildi',
    deleted: 'Sipariş silindi'
  },

  flowers: {
    title: 'Ürünler',
    new: 'Yeni ürün',
    edit: 'Ürünü düzenle',
    name: 'Ad',
    category: 'Kategori',
    purchase_price: 'Alış fiyatı',
    shop_price: 'Satış fiyatı',
    stock: 'Stok',
    photo: 'Fotoğraf',
    active: 'Aktif',
    confirm_delete: 'Ürün silinsin mi?',
    saved: 'Ürün kaydedildi',
    deleted: 'Ürün silindi'
  },

  clients: {
    title: 'Müşteriler',
    new: 'Yeni müşteri',
    edit: 'Müşteriyi düzenle',
    name: 'Ad',
    phone: 'Telefon',
    birthday: 'Doğum günü',
    orders: 'Siparişler',
    total_spent: 'Toplam harcama',
    bonus: 'Bonus puanları',
    confirm_delete: 'Müşteri silinsin mi?',
    saved: 'Müşteri kaydedildi',
    deleted: 'Müşteri silindi'
  },

  finance: {
    title: 'Finans',
    revenue: 'Gelir',
    expenses: 'Giderler',
    profit: 'Kar',
    margin: 'Kar marjı',
    currency: 'Para birimi',
    exchange_rate: 'Döviz kuru',
    today: 'Bugün',
    yesterday: 'Dün',
    this_week: 'Bu hafta',
    this_month: 'Bu ay',
    this_year: 'Bu yıl',
    vs_last_period: 'önceki döneme göre'
  },

  login: {
    title: 'Hoş geldiniz',
    subtitle: 'Hesabınıza giriş yapın',
    phone: 'Telefon',
    password: 'Şifre',
    remember: 'Beni hatırla',
    button: 'Giriş yap',
    forgot: 'Şifrenizi mi unuttunuz?',
    error_empty_phone: 'Telefon numarasını girin',
    error_empty_password: 'Şifreyi girin',
    error_user_not_found: 'Kullanıcı bulunamadı',
    error_wrong_password: 'Yanlış şifre',
    welcome: 'Hoş geldiniz, {name}!'
  },

  setup: {
    title: 'İlk yöneticiyi oluşturun',
    subtitle: 'Sahip hesabını yapılandırın',
    name: 'Ad Soyad',
    phone: 'Telefon',
    password: 'Şifre',
    password2: 'Şifreyi onayla',
    sec_question: 'Güvenlik sorusu',
    sec_answer: 'Güvenlik cevabı',
    button: 'Sahip oluştur ve giriş yap',
    success: 'Sahip oluşturuldu!'
  },

  logout: {
    button: 'Çıkış',
    message: 'Sistemden çıkış yaptınız'
  },

  errors: {
    generic: 'Bir hata oluştu',
    network: 'İnternet bağlantısı yok',
    permission: 'Erişim reddedildi',
    not_found: 'Bulunamadı'
  }
});