const crypto = require('crypto');
const fs = require('fs');

const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: {
    type: 'spki',
    format: 'pem'
  },
  privateKeyEncoding: {
    type: 'pkcs8',
    format: 'pem'
  }
});

fs.writeFileSync('public_key.pem', publicKey);
fs.writeFileSync('private_key.pem', privateKey);
console.log('Сгенерированы RSA ключи (public_key.pem, private_key.pem) для тестового запуска.');
console.log('В ПРОДАКШЕНЕ: private_key.pem должен находиться только на вашем сервере, а public_key.pem должен быть встроен в licensing.js.');
