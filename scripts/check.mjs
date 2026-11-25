// Tingnan kung handa na ang computer mo para sa pag-build ng APK.
import { spawnSync } from 'node:child_process';
import { buildEnv } from './env.mjs';

const { env, jh, sdk } = buildEnv();
let bad = 0;
const line = (good, msg) => { console.log((good ? '[OK]  ' : '[MALI] ') + msg); if (!good) bad++; };

const major = parseInt(process.versions.node.split('.')[0], 10);
line(major >= 22, 'Node.js ' + process.versions.node + (major >= 22 ? '' : '  -> kailangan ng 22 pataas (nodejs.org)'));

const j = spawnSync('java', ['-version'], { env, encoding: 'utf8', shell: process.platform === 'win32' });
const jv = ((j.stderr || '') + (j.stdout || '')).match(/version "(\d+)/);
const jm = jv ? parseInt(jv[1], 10) : 0;
line(jm >= 21, jm ? 'Java ' + jm + (jh ? ' (galing sa Android Studio)' : '') + (jm >= 21 ? '' : '  -> kailangan ng 21 pataas') : 'Walang Java. I-install ang Android Studio at buksan nang isang beses.');

line(!!sdk, sdk ? 'Android SDK: ' + sdk : 'Walang Android SDK. Buksan ang Android Studio, tapos tapusin ang Setup Wizard (ito ang magda-download ng SDK).');
console.log(bad ? '\nAyusin muna ang mga [MALI], tapos patakbuhin ulit:  npm run android:check' : '\nHanda na! Susunod:  npm run android:setup');
process.exit(bad ? 1 : 0);
