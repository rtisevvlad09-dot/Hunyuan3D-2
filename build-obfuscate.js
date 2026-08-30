const fs = require('fs');
const path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');

function ensureDirectoryExistence(filePath) {
  var dirname = path.dirname(filePath);
  if (fs.existsSync(dirname)) {
    return true;
  }
  ensureDirectoryExistence(dirname);
  fs.mkdirSync(dirname);
}

function obfuscateDirectory(srcDir, destDir) {
    if (!fs.existsSync(destDir)) {
        fs.mkdirSync(destDir, { recursive: true });
    }
    const files = fs.readdirSync(srcDir);
    for (const file of files) {
        const fullPath = path.join(srcDir, file);
        const destPath = path.join(destDir, file);

        if (fs.statSync(fullPath).isDirectory()) {
            obfuscateDirectory(fullPath, destPath);
        } else if (fullPath.endsWith('.js') && !fullPath.includes('node_modules')) {
            console.log(`Obfuscating: ${fullPath} -> ${destPath}`);
            const code = fs.readFileSync(fullPath, 'utf8');
            const obfuscationResult = JavaScriptObfuscator.obfuscate(code, {
                compact: true,
                controlFlowFlattening: true,
                controlFlowFlatteningThreshold: 0.75,
                deadCodeInjection: true,
                deadCodeInjectionThreshold: 0.4,
                debugProtection: false,
                debugProtectionInterval: 0,
                disableConsoleOutput: false,
                identifierNamesGenerator: 'hexadecimal',
                log: false,
                numbersToExpressions: true,
                renameGlobals: false,
                selfDefending: true,
                simplify: true,
                splitStrings: true,
                splitStringsChunkLength: 10,
                stringArray: true,
                stringArrayCallsTransform: true,
                stringArrayCallsTransformThreshold: 0.5,
                stringArrayEncoding: ['base64', 'rc4'],
                stringArrayIndexShift: true,
                stringArrayRotate: true,
                stringArrayShuffle: true,
                stringArrayWrappersCount: 1,
                stringArrayWrappersChainedCalls: true,
                stringArrayWrappersParametersMaxCount: 2,
                stringArrayWrappersType: 'variable',
                stringArrayThreshold: 0.75,
                transformObjectKeys: true,
                unicodeEscapeSequence: false
            });
            ensureDirectoryExistence(destPath);
            fs.writeFileSync(destPath, obfuscationResult.getObfuscatedCode(), 'utf8');
        } else {
            ensureDirectoryExistence(destPath);
            fs.copyFileSync(fullPath, destPath);
        }
    }
}

console.log("Starting Obfuscation (creating dist-src directory)");
// For Electron Builder, we usually obfuscate in place if it's during a hook,
// or copy the whole app to a temporary build dir.
// Since `electron-builder` packages everything in the current directory by default,
// a common approach is to configure `electron-builder` to package from a specific directory,
// or we temporarily overwrite files and restore them (not recommended).
// For this simple script, we will copy all necessary files to a `dist-src` folder, obfuscating JS,
// and then we will update package.json to tell electron-builder to pack from `dist-src`.

const distSrc = path.join(__dirname, 'dist-src');
if (!fs.existsSync(distSrc)) fs.mkdirSync(distSrc);

const filesToCopy = ['index.html', 'package.json', 'server.js', 'main.js', 'encryption.js', 'licensing.js', 'manifest.json', 'sw.js', 'public_key.pem'];
const dirsToCopy = ['css']; // we'll treat 'js' specially

for (const f of filesToCopy) {
    if (fs.existsSync(path.join(__dirname, f))) {
        if(f !== 'package.json') fs.copyFileSync(path.join(__dirname, f), path.join(distSrc, f));
    }
}

for (const d of dirsToCopy) {
    const srcDir = path.join(__dirname, d);
    if (fs.existsSync(srcDir)) {
        fs.cpSync(srcDir, path.join(distSrc, d), { recursive: true });
    }
}

obfuscateDirectory(path.join(__dirname, 'js'), path.join(distSrc, 'js'));

console.log("Obfuscation complete.");

// create package.json for dist-src without build commands
const pkg = require('./package.json');
delete pkg.build;
delete pkg.scripts;
delete pkg.devDependencies;
fs.writeFileSync(path.join(distSrc, 'package.json'), JSON.stringify(pkg, null, 2));
