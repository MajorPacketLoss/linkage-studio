const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const root = path.resolve(__dirname, '..');
const source = path.join(root, 'src');
const readSource = file => fs.readFileSync(path.join(source, file), 'utf8').replace(/\r\n?/g, '\n');
let html = readSource('index.html');
const scripts = [...html.matchAll(/<script defer src="([^"]+)"><\/script>/g)];
const code = scripts.map(([, file]) => readSource(file)).join('\n');
html = html.replace('<link rel="stylesheet" href="style.css">', '<style>\n' + readSource('style.css') + '\n</style>');
for (const [tag] of scripts) html = html.replace(tag, '');
html = html.replace('</body>', '<script>\n' + code + '\n</script>\n</body>');
const scriptHash = crypto.createHash('sha256').update('\n' + code + '\n').digest('base64');
const policy = "default-src 'none'; script-src 'sha256-" + scriptHash + "'; style-src 'unsafe-inline'; img-src data: blob:; connect-src 'none'; object-src 'none'; base-uri 'none'; form-action 'none'";
html = html.replace('</head>', '<meta http-equiv="Content-Security-Policy" content="' + policy + '">\n<meta name="referrer" content="no-referrer">\n</head>');
if (process.argv.includes('--check')) {
  if (fs.readFileSync(path.join(root, 'index.html'), 'utf8') !== html) {
    throw Error('The published index.html is out of date. Run npm run build and commit it.');
  }
} else {
  fs.writeFileSync(path.join(root, 'index.html'), html);
}
