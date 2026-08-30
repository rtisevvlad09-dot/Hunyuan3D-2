const crypto = require('crypto');

const ALGORITHM = 'aes-256-gcm';

// ⚠️ ОЧЕНЬ ВАЖНО ДЛЯ БЕЗОПАСНОСТИ ⚠️
// Ни в коем случае не храните ключ в открытом виде в коде.
// В десктопном приложении лучше всего использовать OS secure storage
// (Например: keytar или safeStorage API в Electron) для генерации и хранения
// уникального ключа шифрования для каждого устройства.
//
// Для данного проекта мы будем генерировать случайный ключ при первом запуске
// и сохранять его, например, в переменной окружения или зашифрованном файле.
// В этом примере для совместимости с тестами и запуском,
// мы смоделируем получение ключа, но уберём хардкод пароля "152fz".

let secretKeyCache = null;

function getSecretKey() {
    if (secretKeyCache) return secretKeyCache;

    // В реальном приложении это должно приходить из Electron safeStorage.
    // Если ключа нет, мы генерируем новый случайный (для локальной базы).
    // Если нужно, чтобы база переносилась, пользователь должен вводить мастер-пароль,
    // из которого ключ выводится через PBKDF2/scrypt.

    const envKey = process.env.APP_ENCRYPTION_KEY;
    if (envKey && envKey.length === 64) { // 32 bytes in hex = 64 chars
        secretKeyCache = Buffer.from(envKey, 'hex');
    } else {
        // Fallback for demonstration: generate a random key for this session
        // (This means data will be lost on restart unless APP_ENCRYPTION_KEY is persisted)
        // In Electron, we would use safeStorage.
        secretKeyCache = crypto.randomBytes(32);
    }

    return secretKeyCache;
}

// Для тестирования
function setSecretKey(hexString) {
    secretKeyCache = Buffer.from(hexString, 'hex');
}

function encrypt(text) {
    if (!text) return text;
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipheriv(ALGORITHM, getSecretKey(), iv);

    let encrypted = cipher.update(String(text), 'utf8', 'hex');
    encrypted += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    return `${iv.toString('hex')}:${encrypted}:${authTag.toString('hex')}`;
}

function decrypt(encryptedText) {
    if (!encryptedText || typeof encryptedText !== 'string' || !encryptedText.includes(':')) {
        return encryptedText;
    }

    try {
        const parts = encryptedText.split(':');
        if (parts.length !== 3) return encryptedText;

        const iv = Buffer.from(parts[0], 'hex');
        const encrypted = parts[1];
        const authTag = Buffer.from(parts[2], 'hex');

        const decipher = crypto.createDecipheriv(ALGORITHM, getSecretKey(), iv);
        decipher.setAuthTag(authTag);

        let decrypted = decipher.update(encrypted, 'hex', 'utf8');
        decrypted += decipher.final('utf8');

        return decrypted;
    } catch (e) {
        console.error('Decryption error:', e);
        return null;
    }
}

module.exports = {
    encrypt,
    decrypt,
    setSecretKey
};
