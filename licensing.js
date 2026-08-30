const { machineIdSync } = require('node-machine-id');
const jwt = require('jsonwebtoken');

// В реальном приложении на ПК поставляется ТОЛЬКО открытый ключ (PUBLIC KEY).
// Закрытый ключ (PRIVATE KEY) хранится ТОЛЬКО на защищенном сервере вендора
// и используется для генерации ключей.
const PUBLIC_KEY = `-----BEGIN PUBLIC KEY-----
MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoqzc2uvWjWmtu220NUuf
/LE+9CI6tHg5zvmVNHtsoxPWRbvrw6/7UhWN0c3XTBdHxazOXY38tPDa1rxUiao1
8nY7rkptNvrWlzoh7/ndas+izeCvGNm42v2MAEYvYQDhbDf6aEIJ8rlzCP5FFXdY
mCppe0+7xqxV0XXBfm7J2GAhhKleYqHLOtz5okJMtVklAfovxphhEq4U7rlcDcLv
6SHKK1BudCCPs2tzqr++cyJivXat5jZfGkD5476vECAzvvs470xeqSbfFJrvClF/
GI7hw0CaZTRLjt3nkMOkIzrUBY+B0hOtBt5TwbSLjCeUdpArw060oUOMSLK5kpdY
qwIDAQAB
-----END PUBLIC KEY-----`;

function getHWID() {
    try {
        return machineIdSync();
    } catch (e) {
        console.error("Could not get HWID", e);
        return "fallback-hwid";
    }
}

// Проверка лицензии с использованием асимметричной проверки подписи (RS256)
function checkLicense(licenseKey, publicKey = PUBLIC_KEY) {
    const hwid = getHWID();

    if (!licenseKey) {
        return { valid: false, message: "Лицензионный ключ не предоставлен. Поместите ключ в файл license.key рядом с исполняемым файлом." };
    }

    try {
        const decoded = jwt.verify(licenseKey, publicKey, { algorithms: ['RS256'] });

        if (decoded.hwid !== hwid) {
            return { valid: false, message: "Лицензия привязана к другому оборудованию" };
        }

        if (decoded.exp && Date.now() >= decoded.exp * 1000) {
            return { valid: false, message: "Срок действия лицензии истёк" };
        }

        return { valid: true, message: "Лицензия действительна" };
    } catch (err) {
        return { valid: false, message: "Недействительный ключ или подпись" };
    }
}

// Вспомогательная функция для генерации лицензии.
// В ПРОДАКШЕНЕ ЭТА ФУНКЦИЯ ДОЛЖНА БЫТЬ ТОЛЬКО НА СЕРВЕРЕ ЛИЦЕНЗИРОВАНИЯ!
function generateLicenseForTesting(hwid, privateKeyStr, expiresInDays = 30) {
    const payload = { hwid };
    return jwt.sign(payload, privateKeyStr, { algorithm: 'RS256', expiresIn: `${expiresInDays}d` });
}

module.exports = {
    getHWID,
    checkLicense,
    generateLicenseForTesting
};
