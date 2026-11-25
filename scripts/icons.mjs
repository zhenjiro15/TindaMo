// Ilagay ang icon ng app (galing sa android-res/) sa Android project. Walang "sharp" na kailangan, kaya gumagana sa Windows.
import fs from 'node:fs';
import path from 'node:path';

export function applyIcons(root) {
  const from = path.join(root, 'android-res');
  const to = path.join(root, 'android/app/src/main/res');
  if (!fs.existsSync(from) || !fs.existsSync(to)) { console.warn('Walang android-res o android/res: lalaktawan ang icon.'); return; }
  fs.cpSync(from, to, { recursive: true, force: true });
  // alisin ang lumang icon ng Capacitor (webp / lumang adaptive) para hindi sila ang magamit
  for (const d of fs.readdirSync(to)) {
    if (!d.startsWith('mipmap-')) continue;
    for (const f of fs.readdirSync(path.join(to, d))) {
      if (/^ic_launcher(_round|_foreground)?\.webp$/.test(f)) fs.rmSync(path.join(to, d, f), { force: true });
      if (d === 'mipmap-anydpi-v26' ) continue;
    }
  }
  fs.rmSync(path.join(to, 'drawable-v24/ic_launcher_foreground.xml'), { force: true });
  console.log('Icon ng TindaMo: nailagay na.');
}
