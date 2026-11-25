// V1.1.1: ihanda ang pag-sign ng APK gamit ang SARILING key (hindi debug key).
// - Kung wala pang key, gagawa ng isa (tindamo-release.jks) sa folder na "signing/".
// - IMPORTANTE: i-backup ang folder na "signing/". Kapag nawala ito, hindi na mauupdate ang app sa phone ng mga user
//   (kailangan nilang i-uninstall at mag-install ulit). Huwag i-upload sa GitHub (nasa .gitignore na).
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawnSync } from 'node:child_process';

// Hanapin ang keytool: sa JAVA_HOME muna, tapos sa PATH, tapos sa Android Studio (jbr)
function findKeytool(env) {
  const exe = process.platform === 'win32' ? 'keytool.exe' : 'keytool';
  const dirs = [];
  const E = k => env[k] || env[k.toUpperCase()] || process.env[k] || '';
  if (E('JAVA_HOME')) dirs.push(path.join(E('JAVA_HOME'), 'bin'));
  for (const d of String(E('PATH') || E('Path')).split(path.delimiter)) if (d) dirs.push(d.replace(/^"|"$/g, ''));
  for (const base of [process.env.ProgramFiles, process.env.LOCALAPPDATA && path.join(process.env.LOCALAPPDATA, 'Programs')]) {
    if (base) dirs.push(path.join(base, 'Android', 'Android Studio', 'jbr', 'bin'));
  }
  for (const d of dirs) { const f = path.join(d, exe); if (fs.existsSync(f)) return f; }
  return exe;
}

export function ensureSigning(root, env) {
  const dir = path.join(root, 'signing');
  const jks = path.join(dir, 'tindamo-release.jks');
  const props = path.join(dir, 'keystore.properties');
  fs.mkdirSync(dir, { recursive: true });
  if (!fs.existsSync(jks) || !fs.existsSync(props)) {
    const pw = crypto.randomBytes(12).toString('hex');
    // Walang shell at walang path na may space: tumatakbo ang keytool sa loob ng folder na signing/ (para gumana kahit may space ang pangalan ng folder mo)
    const r = spawnSync(findKeytool(env), ['-genkeypair', '-v', '-keystore', 'tindamo-release.jks', '-alias', 'tindamo', '-keyalg', 'RSA', '-keysize', '2048', '-validity', '36500',
      '-storepass', pw, '-keypass', pw, '-dname', 'CN=TindaMo, OU=TindaMo, O=TindaMo, C=PH'], { env, cwd: dir, stdio: 'inherit' });
    if (r.status !== 0) { console.error('\nHindi nakagawa ng key (keytool). Siguraduhing naka-install ang Java / Android Studio.\n'); process.exit(1); }
    fs.writeFileSync(props, 'storeFile=' + jks.replace(/\\/g, '/') + '\nstorePassword=' + pw + '\nkeyAlias=tindamo\nkeyPassword=' + pw + '\n');
    console.log('\nGumawa ng bagong key sa: signing/   <-- I-BACKUP ITO (flash drive / Google Drive). Huwag i-upload sa GitHub.\n');
  }
  // ilagay ang signingConfig sa android/app/build.gradle (isang beses lang)
  const gp = path.join(root, 'android/app/build.gradle');
  let g = fs.readFileSync(gp, 'utf8');
  if (!g.includes('tindamoSigning')) {
    const block = `
def tindamoSigning = new Properties()
def tindamoSigningFile = new File("\${rootProject.projectDir}/../signing/keystore.properties")
if (tindamoSigningFile.exists()) { tindamoSigningFile.withInputStream { tindamoSigning.load(it) } }
`;
    g = g.replace(/^android\s*\{/m, block + '\nandroid {\n    signingConfigs {\n        release {\n            storeFile file(tindamoSigning[\'storeFile\'])\n            storePassword tindamoSigning[\'storePassword\']\n            keyAlias tindamoSigning[\'keyAlias\']\n            keyPassword tindamoSigning[\'keyPassword\']\n        }\n    }');
    if (!/buildTypes\s*\{\s*release\s*\{/.test(g)) { console.error('\nHindi mahanap ang buildTypes.release sa build.gradle. Patakbuhin ulit ang: npm run android:setup\n'); process.exit(1); }
    g = g.replace(/(buildTypes\s*\{\s*release\s*\{)/, '$1\n            signingConfig signingConfigs.release');
    fs.writeFileSync(gp, g);
  }
}
