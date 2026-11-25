// Isang beses lang patakbuhin: gumawa ng Android project, ilagay ang permissions, icon at abiso.
import fs from 'node:fs';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { buildEnv, writeLocalProps } from './env.mjs';
import { applyIcons } from './icons.mjs';
import { ensureUpdater } from './updater.mjs';
import { ensureBg } from './bgservice.mjs';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { env, sdk } = buildEnv();
const run = (cmd, args) => {
  const r = spawnSync(cmd, args, { cwd: root, stdio: 'inherit', env, shell: process.platform === 'win32' });
  if (r.status !== 0) { console.error('\nNagka-error sa: ' + cmd + ' ' + args.join(' ')); process.exit(r.status || 1); }
};

run('node', ['scripts/build-web.mjs']);
if (!fs.existsSync(path.join(root, 'android'))) run('npx', ['cap', 'add', 'android']);

writeLocalProps(root, sdk);

// permissions (camera para sa scan/larawan, GPS para sa cashier, abiso, vibrate)
const mp = path.join(root, 'android/app/src/main/AndroidManifest.xml');
let m = fs.readFileSync(mp, 'utf8');
const add = [
  '<uses-permission android:name="android.permission.CAMERA" />',
  '<uses-permission android:name="android.permission.RECORD_AUDIO" />',
  '<uses-permission android:name="android.permission.MODIFY_AUDIO_SETTINGS" />',
  '<uses-permission android:name="android.permission.ACCESS_FINE_LOCATION" />',
  '<uses-permission android:name="android.permission.ACCESS_COARSE_LOCATION" />',
  '<uses-permission android:name="android.permission.POST_NOTIFICATIONS" />',
  '<uses-permission android:name="android.permission.VIBRATE" />',
  '<uses-permission android:name="android.permission.RECEIVE_BOOT_COMPLETED" />',
  '<uses-permission android:name="android.permission.WAKE_LOCK" />',
  '<uses-permission android:name="android.permission.SCHEDULE_EXACT_ALARM" />',
  '<uses-permission android:name="android.permission.USE_EXACT_ALARM" />',
  '<uses-feature android:name="android.hardware.camera" android:required="false" />',
  '<uses-feature android:name="android.hardware.camera.autofocus" android:required="false" />',
  '<uses-feature android:name="android.hardware.location.gps" android:required="false" />'
].filter(l => !m.includes(l.match(/android:name="([^"]+)"/)[1]));
if (add.length) {
  if (!m.includes('<application')) throw new Error('Walang <application> sa AndroidManifest.xml');
  m = m.replace('<application', add.map(l => '    ' + l).join('\n') + '\n\n    <application');
  fs.writeFileSync(mp, m);
}

// naka-portrait lang (nakatayo), bawal landscape
m = fs.readFileSync(mp, 'utf8');
if (!/android:screenOrientation=/.test(m)) {
  m = m.replace(/<activity\b/, '<activity\n            android:screenOrientation="portrait"');
  fs.writeFileSync(mp, m);
}

// V27.1: Google sign-in (Capgo Social Login) kailangan ng pagbabago sa MainActivity
{
  const find = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? find(path.join(d, e.name)) : e.name === 'MainActivity.java' ? [path.join(d, e.name)] : []);
  const base = path.join(root, 'android/app/src/main/java');
  const f = fs.existsSync(base) ? find(base)[0] : null;
  if (f) {
    const src = fs.readFileSync(f, 'utf8');
    if (!src.includes('SocialLogin')) {
      const pkg = (src.match(/^\s*package\s+([\w.]+);/m) || [])[1];
      fs.writeFileSync(f,
`package ${pkg};

import android.content.Intent;
import com.getcapacitor.BridgeActivity;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginHandle;
import ee.forgr.capacitor.social.login.GoogleProvider;
import ee.forgr.capacitor.social.login.ModifiedMainActivityForSocialLoginPlugin;
import ee.forgr.capacitor.social.login.SocialLoginPlugin;

public class MainActivity extends BridgeActivity implements ModifiedMainActivityForSocialLoginPlugin {
    @Override
    public void onActivityResult(int requestCode, int resultCode, Intent data) {
        super.onActivityResult(requestCode, resultCode, data);
        if (requestCode >= GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MIN && requestCode < GoogleProvider.REQUEST_AUTHORIZE_GOOGLE_MAX) {
            PluginHandle handle = getBridge().getPlugin("SocialLogin");
            if (handle == null) return;
            Plugin plugin = handle.getInstance();
            if (!(plugin instanceof SocialLoginPlugin)) return;
            ((SocialLoginPlugin) plugin).handleGoogleLoginIntent(requestCode, data);
        }
    }

    public void IHaveModifiedTheMainActivityForTheUseWithSocialLoginPlugin() {}
}
`);
      console.log('MainActivity.java: inayos para sa Google sign-in');
    }
  }
}

// maliit na icon ng abiso (puting tindahan)
const dd = path.join(root, 'android/app/src/main/res/drawable');
fs.mkdirSync(dd, { recursive: true });
fs.writeFileSync(path.join(dd, 'ic_stat_tindamo.xml'),
`<vector xmlns:android="http://schemas.android.com/apk/res/android" android:width="24dp" android:height="24dp" android:viewportWidth="24" android:viewportHeight="24">
    <path android:fillColor="#FFFFFF" android:pathData="M20,4H4v2h16V4zm1,10v-2l-1,-5H4l-1,5v2h1v6h10v-6h4v6h2v-6h1zm-9,4H6v-4h6v4z"/>
</vector>
`);

// app icon (galing sa assets/)
applyIcons(root);

// bersyon ng APK (galing sa version.json)
{
  const vj = JSON.parse(fs.readFileSync(path.join(root, 'version.json'), 'utf8'));
  const gp = path.join(root, 'android/app/build.gradle');
  if (fs.existsSync(gp)) {
    let g = fs.readFileSync(gp, 'utf8');
    const vp = vj.version.split('.').map(x => parseInt(x, 10) || 0);
    const code = (vp[0] || 0) * 10000 + (vp[1] || 0) * 100 + (vp[2] || 0) || 1;
    g = g.replace(/versionCode\s+\d+/, 'versionCode ' + code).replace(/versionName\s+"[^"]*"/, 'versionName "' + vj.version + '"');
    fs.writeFileSync(gp, g);
    console.log('build.gradle: version ' + vj.version + ' (code ' + code + ')');
  }
}

ensureUpdater(root);   // V1.1.2: in-app update (download + install)
ensureBg(root);       // V1.2.3: abiso kahit sarado ang app (background service)
run('npx', ['cap', 'sync', 'android']);
console.log('\nOK! Pwede mo nang buksan:  npm run android:open   (o gumawa ng APK:  npm run android:apk)');
