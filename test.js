const { encrypt, decrypt, setSecretKey } = require('./encryption.js');
const { getHWID, checkLicense, generateLicenseForTesting } = require('./licensing.js');
const fs = require('fs');
const crypto = require('crypto');

let testsPassed = true;

function assert(condition, message) {
    if (!condition) {
        console.error("❌ TEST FAILED:", message);
        testsPassed = false;
    } else {
        console.log("✅ TEST PASSED:", message);
    }
}

console.log("--- Running Tests ---");

// Test Encryption
// Simulate setting the key from env/safestorage
setSecretKey(crypto.randomBytes(32).toString('hex'));

const sampleText = "Особые данные клиента 123";
const encryptedText = encrypt(sampleText);
assert(encryptedText !== sampleText, "Encryption alters the string");
const decryptedText = decrypt(encryptedText);
assert(decryptedText === sampleText, "Decryption restores original string");
const invalidDecryption = decrypt("invalid_string_without_colon");
assert(invalidDecryption === "invalid_string_without_colon", "Decryption handles invalid inputs gracefully");

// Test Licensing
const hwid = getHWID();
assert(typeof hwid === "string" && hwid.length > 0, "Hardware ID successfully fetched");

const noKeyCheck = checkLicense();
assert(noKeyCheck.valid === false, "Missing key fails checkLicense");

if (fs.existsSync('./private_key.pem')) {
    const privateKey = fs.readFileSync('./private_key.pem', 'utf8');
    const mockToken = generateLicenseForTesting(hwid, privateKey, 30);
    const tokenCheck = checkLicense(mockToken);
    assert(tokenCheck.valid === true, "Generated valid token passes checkLicense");

    const invalidHwidToken = generateLicenseForTesting("another-hwid", privateKey, 30);
    const tokenCheckInvalidHwid = checkLicense(invalidHwidToken);
    assert(tokenCheckInvalidHwid.valid === false, "Token with mismatched HWID fails checkLicense");
} else {
    console.warn("⚠️ Skipping license signature tests because private_key.pem is missing. (This is expected in production but fine for tests if we generated one)");
}

if (testsPassed) {
    console.log("--- ALL UNIT TESTS PASSED ---");
    process.exit(0);
} else {
    console.error("--- SOME UNIT TESTS FAILED ---");
    process.exit(1);
}
