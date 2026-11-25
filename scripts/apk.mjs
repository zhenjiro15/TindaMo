// Gumawa ng APK na pwedeng i-install sa phone/tablet (release build, naka-sign sa sariling key).
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildEnv, writeLocalProps } from './env.mjs';
import { applyIcons } from './icons.mjs';
import { ensureSigning } from './sign.mjs';
import { ensureUpdater } from './updater.mjs';
import { ensureBg } from './bgservice.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const win = process.platform === 'win32';
const { env, sdk, jh } = buildEnv();
const run = (cmd, args, cwd = root) => {
  const r = spawnSync(cmd, args, { cwd, stdio: 'inherit', env, shell: win });
  if (r.status !== 0) { console.error('\nNagka-error sa: ' + cmd + ' ' + args.join(' ')); process.exit(r.status || 1); }
};
if (!fs.existsSync(path.join(root, 'android'))) { console.error('\nWala pang android folder. Patakbuhin muna:  npm run android:setup\n'); process.exit(1); }

if (!sdk) { console.error('\nWalang Android SDK. Patakbuhin:  npm run android:check\n'); process.exit(1); }
writeLocalProps(root, sdk);
// ilagay ang version (galing sa version.json) sa Android build
{
  const vj = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8'));
  const gp = path.join(root, 'android/app/build.gradle');
  if (fs.existsSync(gp)) {
    let g = fs.readFileSync(gp, 'utf8');
    const vp = vj.version.split('.').map(x => parseInt(x, 10) || 0);   // 1.1.1 -> 10101, 1.2 -> 10200 (laging tumataas)
    const code = (vp[0] || 0) * 10000 + (vp[1] || 0) * 100 + (vp[2] || 0) || 1;
    g = g.replace(/versionCode\s+\d+/, 'versionCode ' + code).replace(/versionName\s+"[^"]*"/, 'versionName "' + vj.version + '"');
    fs.writeFileSync(gp, g);
  }
}
run('node', ['scripts/build-web.mjs']);
// ilagay ulit ang icon mula sa assets/ sa bawat build (para laging tama ang logo ng app sa phone)
applyIcons(root);
ensureUpdater(root);   // V1.1.2: in-app update (download + install)
ensureBg(root);       // V1.2.3: abiso kahit sarado ang app (background service)
run('npx', ['cap', 'sync', 'android']);
// V1.1.1: RELEASE build na may sariling permanenteng key (hindi debug), para hindi na "parang virus" sa Play Protect
ensureSigning(root, env);
run(win ? 'gradlew.bat' : './gradlew', ['assembleRelease'], path.join(root, 'android'));
{
  // sync ang version sa android/app/build.gradle bago mag-build ay nasa android-setup; dito pangalanan ang APK
  const vj = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8'));
  const src = path.join(root, 'android/app/build/outputs/apk/release/app-release.apk');
  const outDir = path.join(root, 'release');
  fs.mkdirSync(outDir, { recursive: true });
  const dest = path.join(outDir, 'TindaMo.apk');
  fs.copyFileSync(src, dest);
  console.log('\nTapos! Ang APK ay nasa:\n  release/TindaMo.apk\n');
  console.log('I-upload ang file na ito sa GitHub (Releases) para ma-download ng lahat.');
}
