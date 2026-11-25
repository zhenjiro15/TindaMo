// V1.1.4: ipakita ang SHA-1 at SHA-256 ng key na ginagamit sa pag-sign ng APK (signing/tindamo-release.jks).
// Ito ang kailangang ilagay sa Google Cloud (Android OAuth client) at Firebase para gumana ang "Continue with Google".
// Patakbuhin:  npm run android:sha1
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { buildEnv } from './env.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const dir = path.join(root, 'signing'), jks = path.join(dir, 'tindamo-release.jks'), props = path.join(dir, 'keystore.properties');
if (!fs.existsSync(jks) || !fs.existsSync(props)) {
  console.error('\nWala pang key sa folder na "signing/". Patakbuhin muna ang:  npm run android:apk  (gagawa ito ng key)\n');
  process.exit(1);
}
const P = {};
for (const l of fs.readFileSync(props, 'utf8').split(/\r?\n/)) { const i = l.indexOf('='); if (i > 0) P[l.slice(0, i).trim()] = l.slice(i + 1).trim(); }
const { env } = buildEnv();
const exe = process.platform === 'win32' ? 'keytool.exe' : 'keytool';
const kt = env.JAVA_HOME && fs.existsSync(path.join(env.JAVA_HOME, 'bin', exe)) ? path.join(env.JAVA_HOME, 'bin', exe) : exe;
const r = spawnSync(kt, ['-list', '-v', '-keystore', 'tindamo-release.jks', '-alias', P.keyAlias || 'tindamo', '-storepass', P.storePassword], { env, cwd: dir, encoding: 'utf8', shell: process.platform === 'win32' && false });
if (r.status !== 0) { console.error('\nHindi nabasa ang key (keytool).\n' + (r.stderr || r.stdout || '') + '\n'); process.exit(1); }
const pick = k => ((r.stdout.match(new RegExp(k + ':\\s*([0-9A-Fa-f:]+)')) || [])[1] || '?');
console.log('\nSHA-1  : ' + pick('SHA1'));
console.log('SHA-256: ' + pick('SHA256'));
console.log('\nPackage name: com.tindamo.app');
console.log('\nHakbang: Google Cloud Console -> APIs & Services -> Credentials -> gumawa ng bagong OAuth client (Android)');
console.log('         (package com.tindamo.app + SHA-1 sa itaas). Idagdag din ang SHA-1 sa Firebase -> Project settings -> Your apps.');
console.log('         Hindi na kailangang mag-build ulit ng app; subukan ulit ang Google sign-in pagkaraan ng ilang minuto.\n');
