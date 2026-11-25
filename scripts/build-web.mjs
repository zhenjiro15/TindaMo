// Ito para sa paggawa ng "www" folder: kopya ng app + mga library na naka-bundle (walang CDN, walang internet na kailangan).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const www = path.join(root, 'www');
const nm = p => path.join(root, 'node_modules', p);
const need = p => { if (!fs.existsSync(nm(p))) { console.error('\nWala pa ang "' + p + '". Patakbuhin muna ang:  npm install\n'); process.exit(1); } };

need('@zxing/library/umd/index.min.js');
need('@fontsource/inter/files');
need('@fontsource/bricolage-grotesque/files');

fs.rmSync(www, { recursive: true, force: true });
fs.mkdirSync(path.join(www, 'vendor', 'fonts', 'files'), { recursive: true });

for (const f of ['index.html']) fs.copyFileSync(path.join(root, f), path.join(www, f));
for (const d of ['css', 'js', 'SFX', 'icons']) fs.cpSync(path.join(root, d), path.join(www, d), { recursive: true });

// barcode / QR library
fs.copyFileSync(nm('@zxing/library/umd/index.min.js'), path.join(www, 'vendor', 'zxing.min.js'));

// fonts (Inter 400/500/600, Bricolage Grotesque 600/800): latin lang ang kailangan
const fontDir = path.join(www, 'vendor', 'fonts');
const links = [];
const want = { inter: ['400', '500', '600'], 'bricolage-grotesque': ['600', '800'] };
for (const [pkg, weights] of Object.entries(want)) {
  const base = nm('@fontsource/' + pkg);
  for (const w of weights) {
    const css = path.join(base, w + '.css');
    if (!fs.existsSync(css)) { console.warn('Walang ' + pkg + ' ' + w + '.css, lalaktawan.'); continue; }
    fs.copyFileSync(css, path.join(fontDir, pkg + '-' + w + '.css'));
    links.push('<link rel="stylesheet" href="vendor/fonts/' + pkg + '-' + w + '.css">');
  }
  for (const f of fs.readdirSync(path.join(base, 'files'))) {
    if (new RegExp('-(latin|latin-ext)-(' + weights.join('|') + ')-normal\\.woff2?$').test(f))
      fs.copyFileSync(path.join(base, 'files', f), path.join(fontDir, 'files', f));
  }
}

// ayusin ang index.html ng www: local na font at library, wala nang manifest/CDN
const ip = path.join(www, 'index.html');
let h = fs.readFileSync(ip, 'utf8');
const swap = (re, to) => { if (!re.test(h)) throw new Error('Hindi nahanap sa index.html: ' + re); h = h.replace(re, to); };
swap(/<link rel="preconnect" href="https:\/\/fonts\.googleapis\.com">\s*/, '');
swap(/<link rel="preconnect" href="https:\/\/fonts\.gstatic\.com" crossorigin>\s*/, '');
swap(/<link rel="stylesheet" href="https:\/\/fonts\.googleapis\.com[^>]*>/, links.join('\n'));
swap(/<script src="https:\/\/cdn\.jsdelivr\.net\/npm\/@zxing\/library[^>]*><\/script>/, '<script src="vendor/zxing.min.js"></script>');
swap(/<link rel="manifest"[^>]*>\s*/, '');
fs.writeFileSync(ip, h);

console.log('OK: handa na ang "www" (' + fs.readdirSync(www).join(', ') + ')');
