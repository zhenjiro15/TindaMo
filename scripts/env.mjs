// Hanapin ang Android SDK at Java (galing sa Android Studio) para hindi na mano-manong mag-set ng kung anu-ano.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const win = process.platform === 'win32', mac = process.platform === 'darwin';
const ok = p => p && fs.existsSync(p);

export function sdkPath() {
  const c = [process.env.ANDROID_HOME, process.env.ANDROID_SDK_ROOT];
  if (win) c.push(path.join(process.env.LOCALAPPDATA || '', 'Android', 'Sdk'));
  else if (mac) c.push(path.join(os.homedir(), 'Library/Android/sdk'));
  else c.push(path.join(os.homedir(), 'Android/Sdk'));
  return c.find(ok) || null;
}

export function javaHome() {
  const exe = win ? 'java.exe' : 'java';
  const c = [process.env.JAVA_HOME];
  if (win) c.push('C:\\Program Files\\Android\\Android Studio\\jbr', path.join(process.env.LOCALAPPDATA || '', 'Programs', 'Android Studio', 'jbr'));
  else if (mac) c.push('/Applications/Android Studio.app/Contents/jbr/Contents/Home');
  else c.push('/opt/android-studio/jbr', path.join(os.homedir(), 'android-studio/jbr'));
  return c.find(p => ok(p) && ok(path.join(p, 'bin', exe))) || null;
}

export function buildEnv() {
  const env = { ...process.env }, jh = javaHome(), sdk = sdkPath();
  const pk = Object.keys(env).find(k => k.toLowerCase() === 'path') || 'PATH';
  if (jh) { env.JAVA_HOME = jh; env[pk] = path.join(jh, 'bin') + path.delimiter + (env[pk] || ''); }
  if (sdk) { env.ANDROID_HOME = sdk; env.ANDROID_SDK_ROOT = sdk; }
  return { env, jh, sdk };
}

// Sinasabi kay Gradle kung nasaan ang SDK
export function writeLocalProps(root, sdk) {
  const dir = path.join(root, 'android');
  if (!sdk || !fs.existsSync(dir)) return;
  fs.writeFileSync(path.join(dir, 'local.properties'), 'sdk.dir=' + sdk.replace(/\\/g, '\\\\').replace(/:/g, '\\:') + '\n');
}
