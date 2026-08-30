const { app, BrowserWindow, dialog, safeStorage } = require('electron');
const path = require('path');
const { fork } = require('child_process');
const fs = require('fs');
const { checkLicense, getHWID, generateLicenseForTesting } = require('./licensing.js');
const crypto = require('crypto');

let mainWindow;
let serverProcess;

function createWindow() {
    mainWindow = new BrowserWindow({
        width: 1280,
        height: 800,
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true
        },
        autoHideMenuBar: true
    });

    // Load the local HTML file instead of relying on the backend to serve it
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
}

app.whenReady().then(() => {

    // --- 1. Encryption Key Management (using safeStorage) ---
    const keyFilePath = path.join(app.getPath('userData'), 'ekey.dat');
    let encryptionKeyHex = '';

    if (fs.existsSync(keyFilePath)) {
        try {
            const encryptedKey = fs.readFileSync(keyFilePath);
            if (safeStorage.isEncryptionAvailable()) {
                 const decryptedKeyBuffer = safeStorage.decryptString(encryptedKey);
                 encryptionKeyHex = decryptedKeyBuffer;
            } else {
                 // Fallback if safeStorage is not available (e.g., headless Linux)
                 encryptionKeyHex = encryptedKey.toString('utf8');
            }
        } catch(e) {
            console.error("Could not read encryption key", e);
        }
    }

    if (!encryptionKeyHex) {
        // Generate new 32 byte key for AES-256
        encryptionKeyHex = crypto.randomBytes(32).toString('hex');
        if (safeStorage.isEncryptionAvailable()) {
            fs.writeFileSync(keyFilePath, safeStorage.encryptString(encryptionKeyHex));
        } else {
            fs.writeFileSync(keyFilePath, encryptionKeyHex);
        }
    }

    // --- 2. Check License ---
    const licenseFilePath = path.join(__dirname, 'license.key');
    let licenseKey = null;
    if (fs.existsSync(licenseFilePath)) {
        licenseKey = fs.readFileSync(licenseFilePath, 'utf8').trim();
    } else {
        // FOR DEMONSTRATION/TESTING PURPOSES: We auto-generate a valid license if none exists
        // In a real app, the user would HAVE to provide this file.
        const privateKeyPath = path.join(__dirname, 'private_key.pem');
        if (fs.existsSync(privateKeyPath)) {
             const privateKey = fs.readFileSync(privateKeyPath, 'utf8');
             licenseKey = generateLicenseForTesting(getHWID(), privateKey, 30);
             fs.writeFileSync(licenseFilePath, licenseKey);
        }
    }

    const licenseCheck = checkLicense(licenseKey);

    if (!licenseCheck.valid) {
        dialog.showErrorBox("Ошибка лицензии", `${licenseCheck.message}\nВаш HWID: ${getHWID()}`);
        app.quit();
        return;
    }

    // --- 3. Start Local Server ---
    const serverPath = path.join(__dirname, 'server.js');
    serverProcess = fork(serverPath, [], {
        env: {
            ...process.env,
            APP_ENCRYPTION_KEY: encryptionKeyHex // Pass key securely via env vars
        }
    });

    serverProcess.on('error', (err) => {
        console.error('Server failed to start:', err);
    });

    // --- 4. Create Electron Window ---
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

app.on('will-quit', () => {
    if (serverProcess) {
        serverProcess.kill();
    }
});
