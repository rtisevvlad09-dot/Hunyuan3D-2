// ===== ВНЕШНИЕ СЕРВИСЫ (EmailJS, SMS.ru, АТОЛ) =====
// js/services/external.js
// v2.0 — с retry, таймаутами, rate limiting, аудитом

window.App = window.App || {};

/* ---------- Утилиты для HTTP ---------- */
const http = {
  async fetch(url, options = {}, timeoutMs = 15000) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const res = await fetch(url, {
        ...options,
        signal: controller.signal
      });
      clearTimeout(timeoutId);
      return res;
    } catch (e) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        throw new Error('Таймаут запроса');
      }
      throw e;
    }
  },

  async withRetry(fn, maxRetries = 2, delayMs = 1000) {
    let lastError;
    for (let i = 0; i <= maxRetries; i++) {
      try {
        return await fn();
      } catch (e) {
        lastError = e;
        if (i < maxRetries) {
          await new Promise(r => setTimeout(r, delayMs * Math.pow(2, i)));
        }
      }
    }
    throw lastError;
  }
};

/* ---------- Rate limiting ---------- */
const rateLimit = {
  _counters: {},

  check(key, limit = 5, windowMs = 60000) {
    const now = Date.now();
    if (!this._counters[key]) {
      this._counters[key] = { count: 0, resetAt: now + windowMs };
    }

    const c = this._counters[key];

    // Сброс окна если прошло время
    if (now > c.resetAt) {
      c.count = 0;
      c.resetAt = now + windowMs;
    }

    if (c.count >= limit) {
      const waitSec = Math.ceil((c.resetAt - now) / 1000);
      throw new Error(`Превышен лимит. Подождите ${waitSec} сек`);
    }

    c.count++;
    return true;
  }
};

/* ---------- Тестовый режим ---------- */
App.isTestMode = async function() {
  try {
    return !!(await App.getSetting('testMode', false));
  } catch {
    return false;
  }
};

/* ---------- Объект ExtServices ---------- */
App.ExtServices = {

  /* ===== Email через EmailJS ===== */
  async sendEmail(to, subject, body, options = {}) {
    // Валидация
    if (!to || !App.isValidEmail(to)) {
      return { ok: false, msg: 'Некорректный email' };
    }
    if (!subject || subject.length > 200) {
      return { ok: false, msg: 'Некорректная тема' };
    }

    // Rate limiting
    try {
      rateLimit.check('email', 10, 3600000); // 10 писем в час
    } catch (e) {
      App.Toast.wn(e.message);
      return { ok: false, msg: e.message };
    }

    // Конфиг
    const [serviceId, templateId, publicKey] = await Promise.all([
      App.getSetting('emailjsService', ''),
      App.getSetting('emailjsTemplate', ''),
      App.getSetting('emailjsKey', '')
    ]);

    if (!serviceId || !publicKey) {
      return { ok: false, msg: 'EmailJS не настроен' };
    }

    // Тестовый режим
    const testMode = await App.isTestMode();
    if (testMode) {
      console.log('📧 [TEST] Email to:', to, 'Subject:', subject);
      await this._logAction('email_sent_test', { to, subject });
      return { ok: true, msg: 'Тестовый режим: письмо не отправлено' };
    }

    try {
      const res = await http.withRetry(async () => {
        return http.fetch('https://api.emailjs.com/api/v1.0/email/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            service_id: serviceId,
            template_id: templateId,
            user_id: publicKey,
            template_params: {
              to_email: to,
              subject,
              message: body,
              ...options.params
            }
          })
        });
      });

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      await this._logAction('email_sent', { to, subject });
      return { ok: true, msg: 'Письмо отправлено' };
    } catch (e) {
      await this._logAction('email_failed', { to, subject, error: e.message });
      return { ok: false, msg: 'Ошибка отправки: ' + e.message };
    }
  },

  /* ===== SMS через SMS.ru ===== */
  async sendSMS(phone, text, options = {}) {
    // Валидация
    if (!App.isValidPhone(phone)) {
      return { ok: false, msg: 'Некорректный телефон' };
    }
    if (!text || text.length > 700) {
      return { ok: false, msg: 'Сообщение слишком длинное' };
    }

    // Rate limiting
    try {
      rateLimit.check('sms', 20, 3600000); // 20 SMS в час
    } catch (e) {
      App.Toast.wn(e.message);
      return { ok: false, msg: e.message };
    }

    // Проверка интернета
    if (!navigator.onLine) {
      return { ok: false, msg: 'Нет подключения к интернету' };
    }

    // Конфиг
    const key = await App.getSetting('smsruKey', '');
    if (!key) {
      return { ok: false, msg: 'SMS.ru не настроен' };
    }

    // Тестовый режим
    const testMode = await App.isTestMode();
    if (testMode) {
      console.log('📱 [TEST] SMS to:', phone, 'Text:', text);
      await this._logAction('sms_sent_test', { phone, text });
      return { ok: true, msg: 'Тестовый режим: SMS не отправлено' };
    }

    const normalizedPhone = App.normPhone(phone);

    try {
      // Используем POST вместо GET — ключ не попадает в URL
      const body = new URLSearchParams({
        api_id: key,
        to: normalizedPhone,
        msg: text,
        json: '1',
        ...(options.from ? { from: options.from } : {})
      });

      const res = await http.withRetry(async () => {
        return http.fetch('https://sms.ru/sms/send', {
          method: 'POST',
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
          body
        });
      });

      const d = await res.json();

      if (d.status !== 'OK' && d.status_code !== 100) {
        throw new Error(d.status_text || `Код ошибки: ${d.status_code}`);
      }

      await this._logAction('sms_sent', {
        phone: this._maskPhone(normalizedPhone),
        smsId: d.sms?.[normalizedPhone]
      });

      return { ok: true, msg: 'SMS отправлено', data: d };
    } catch (e) {
      await this._logAction('sms_failed', {
        phone: this._maskPhone(normalizedPhone),
        error: e.message
      });
      return { ok: false, msg: 'Ошибка SMS: ' + e.message };
    }
  },

  /* ===== Фискализация через АТОЛ Онлайн ===== */
  _atolTokenCache: null,

  async _getAtolToken(login, pass) {
    // Кэш токена (живёт ~24 часа, обновляем каждые 23 часа)
    if (this._atolTokenCache &&
        this._atolTokenCache.expiresAt > Date.now()) {
      return this._atolTokenCache.token;
    }

    const res = await http.withRetry(async () => {
      return http.fetch('https://online.atol.ru/possystem/v4/getToken', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ login, pass })
      });
    });

    if (!res.ok) {
      throw new Error(`HTTP ${res.status} при получении токена`);
    }

    const data = await res.json();
    if (!data.token) {
      throw new Error(data.error?.text || 'Не удалось получить токен АТОЛ');
    }

    this._atolTokenCache = {
      token: data.token,
      expiresAt: Date.now() + 23 * 60 * 60 * 1000 // 23 часа
    };

    return data.token;
  },

  async fiscalize(order, options = {}) {
    // Валидация заказа
    if (!order || !order.id) {
      return { ok: false, msg: 'Некорректный заказ' };
    }
    if (!order.items || !Array.isArray(order.items) || order.items.length === 0) {
      return { ok: false, msg: 'В заказе нет позиций' };
    }

    // Конфиг
    const [login, pass, groupCode, proxyUrl, testMode] = await Promise.all([
      App.getSetting('atol_login', ''),
      App.getSetting('atol_pass', ''),
      App.getSetting('atol_group', ''),
      App.getSetting('atol_proxy_url', ''), // URL своего proxy сервера
      App.isTestMode()
    ]);

    if (!login || !pass || !groupCode) {
      return { ok: false, msg: 'Фискализация не настроена' };
    }

    // Тестовый режим
    if (testMode) {
      console.log('🧾 [TEST] Fiscalize order:', order.id);
      await this._logAction('fiscalize_test', { orderId: order.id });
      return { ok: true, msg: 'Тестовый режим: чек не отправлен' };
    }

    try {
      const token = await this._getAtolToken(login, pass);

      // Формируем позиции
      const items = order.items.map(it => ({
        name: String(it.name || 'Товар').slice(0, 128),
        price: Number(it.price) || 0,
        quantity: Number(it.quantity) || 1,
        sum: (Number(it.price) || 0) * (Number(it.quantity) || 1),
        payment_method: 'full_payment',
        payment_object: 'commodity',
        tax: options.tax || 'none',
        ...(it.unit ? { measure: it.unit } : {})
      }));

      // Определяем тип оплаты
      const paymentType = order.paymentMethod === 'card' ? 'electronic' : 'cash';
      const payments = [{
        type: paymentType,
        sum: order.finalAmount || order.total || 0
      }];

      // Формируем документ
      const doc = {
        external_id: String(order.id).slice(0, 32),
        receipt: {
          client: {
            name: order.clientName || 'Покупатель',
            ...(order.clientEmail ? { email: order.clientEmail } : {}),
            ...(order.clientPhone ? { phone: App.normPhone(order.clientPhone) } : {})
          },
          company: {
            email: await App.getSetting('shopEmail', 'shop@example.com'),
            taxation_mode: options.taxationType || 'osn',
            ...(await App.getSetting('atol_inn') ? { inn: await App.getSetting('atol_inn') } : {})
          },
          items,
          payments,
          total: order.finalAmount || order.total || 0,
          vats: []
        }
      };

      // URL запроса: если есть proxy — используем его, иначе напрямую (но CORS может сломать)
      const url = proxyUrl
        ? proxyUrl
        : `https://online.atol.ru/possystem/v4/${groupCode}/sell`;

      const res = await http.withRetry(async () => {
        return http.fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Token': token
          },
          body: JSON.stringify(doc)
        });
      }, 3, 2000);

      // Обработка CORS ошибки
      if (!res.ok && !proxyUrl) {
        throw new Error(
          'CORS блокирует прямой запрос к АТОЛ. Настройте proxy URL в настройках ' +
          '(см. раздел "Фискализация" в документации).'
        );
      }

      const receiptData = await res.json();

      if (!res.ok || receiptData.error) {
        throw new Error(
          receiptData.error?.text ||
          receiptData.error?.error ||
          `HTTP ${res.status}`
        );
      }

      // Сохраняем UUID чека в заказе
      if (receiptData.uuid) {
        try {
          await App.repo('orders').update(order.id, {
            fiscalUuid: receiptData.uuid,
            fiscalizedAt: Date.now()
          });
        } catch { /* ignore */ }
      }

      // Уведомление
      if (App.Notify?.add) {
        await App.Notify.add(
          'order',
          'Фискализация',
          `Чек #${String(order.id).slice(-6)} отправлен в ФНС`
        );
      }

      await this._logAction('fiscalize_success', {
        orderId: order.id,
        uuid: receiptData.uuid
      });

      return {
        ok: true,
        msg: 'Чек отправлен',
        data: receiptData
      };
    } catch (e) {
      await this._logAction('fiscalize_failed', {
        orderId: order.id,
        error: e.message
      });
      return { ok: false, msg: 'Ошибка фискализации: ' + e.message };
    }
  },

  /* ===== Проверка статуса чека АТОЛ ===== */
  async checkReceiptStatus(uuid, groupCode) {
    if (!uuid || !groupCode) {
      return { ok: false, msg: 'Нет данных чека' };
    }

    const [login, pass] = await Promise.all([
      App.getSetting('atol_login', ''),
      App.getSetting('atol_pass', '')
    ]);

    if (!login || !pass) {
      return { ok: false, msg: 'АТОЛ не настроен' };
    }

    try {
      const token = await this._getAtolToken(login, pass);
      const res = await http.fetch(
        `https://online.atol.ru/possystem/v4/${groupCode}/sell/${uuid}`,
        {
          headers: { 'Token': token }
        }
      );

      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }

      const data = await res.json();
      return { ok: true, data };
    } catch (e) {
      return { ok: false, msg: e.message };
    }
  },

  /* ===== Вспомогательные методы ===== */

  // Маскирование телефона для логов
  _maskPhone(phone) {
    if (!phone || phone.length < 6) return phone;
    return phone.slice(0, 4) + '***' + phone.slice(-2);
  },

  // Логирование действий
  async _logAction(action, details) {
    try {
      if (App.Audit?.log) {
        await App.Audit.log(`external.${action}`, details);
      }
    } catch {
      // Не блокируем основной поток
    }
  },

  /* ===== Диагностика настроек ===== */
  async testConnections() {
    const results = {
      emailjs: false,
      smsru: false,
      atol: false
    };

    // EmailJS
    try {
      const [serviceId, publicKey] = await Promise.all([
        App.getSetting('emailjsService', ''),
        App.getSetting('emailjsKey', '')
      ]);
      results.emailjs = !!(serviceId && publicKey);
    } catch { /* ignore */ }

    // SMS.ru
    try {
      const key = await App.getSetting('smsruKey', '');
      results.smsru = !!key;
    } catch { /* ignore */ }

    // АТОЛ
    try {
      const [login, pass, group] = await Promise.all([
        App.getSetting('atol_login', ''),
        App.getSetting('atol_pass', ''),
        App.getSetting('atol_group', '')
      ]);
      if (login && pass && group) {
        try {
          await this._getAtolToken(login, pass);
          results.atol = true;
        } catch {
          results.atol = false;
        }
      }
    } catch { /* ignore */ }

    return results;
  },

  /* ===== Очистка чувствительных данных ===== */
  maskSettings(settings) {
    const masked = { ...settings };
    const sensitiveKeys = [
      'smsruKey', 'emailjsKey', 'atol_pass',
      'atol_login', 'emailjsService'
    ];

    for (const key of sensitiveKeys) {
      if (masked[key]) {
        const v = String(masked[key]);
        if (v.length <= 4) {
          masked[key] = '***';
        } else {
          masked[key] = v.slice(0, 2) + '*'.repeat(Math.min(8, v.length - 4)) + v.slice(-2);
        }
      }
    }

    return masked;
  }
};

console.log('✅ external.js загружен');