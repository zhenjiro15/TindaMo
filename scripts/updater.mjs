// V1.1.2: ilagay ang "in-app update" (download + install ng APK) sa Android project.
// Idempotent: pwedeng patakbuhin sa bawat build. Tinatawag ng android-setup.mjs at apk.mjs.
import fs from 'node:fs';
import path from 'node:path';

const PLUGIN = (pkg) => `package ${pkg};

import android.content.Intent;
import android.net.Uri;
import android.os.Build;
import android.provider.Settings;
import androidx.core.content.FileProvider;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;
import java.io.File;
import java.io.FileInputStream;
import java.io.FileOutputStream;
import java.io.IOException;
import java.io.InputStream;
import java.net.HttpURLConnection;
import java.net.URL;

/** V1.1.2: dina-download ang bagong APK sa loob ng app at binubuksan ang installer ng Android. */
@CapacitorPlugin(name = "ApkInstaller")
public class ApkInstallerPlugin extends Plugin {
    private volatile boolean cancelled = false;

    private File dir() {
        File d = new File(getContext().getCacheDir(), "updates");
        if (!d.exists()) d.mkdirs();
        return d;
    }

    private boolean allowed() {
        return Build.VERSION.SDK_INT < 26 || getContext().getPackageManager().canRequestPackageInstalls();
    }

    @PluginMethod
    public void canInstall(PluginCall call) {
        JSObject r = new JSObject();
        r.put("allowed", allowed());
        call.resolve(r);
    }

    @PluginMethod
    public void openSettings(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_MANAGE_UNKNOWN_APP_SOURCES, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()));
        }
    }

    @PluginMethod
    public void cancel(PluginCall call) {
        cancelled = true;
        call.resolve();
    }

    @PluginMethod
    public void download(final PluginCall call) {
        final String url = call.getString("url");
        if (url == null || !url.startsWith("https://")) {
            call.reject("Maling link");
            return;
        }
        cancelled = false;
        new Thread(new Runnable() {
            @Override
            public void run() {
                HttpURLConnection c = null;
                File part = null;
                try {
                    File d = dir();
                    File[] old = d.listFiles();
                    if (old != null) for (File f : old) f.delete();
                    part = new File(d, "TindaMo.apk.part");
                    String cur = url;
                    boolean ok = false;
                    for (int hop = 0; hop < 8; hop++) {
                        c = (HttpURLConnection) new URL(cur).openConnection();
                        c.setInstanceFollowRedirects(false);
                        c.setConnectTimeout(15000);
                        c.setReadTimeout(30000);
                        c.setRequestProperty("User-Agent", "TindaMo-Updater");
                        int code = c.getResponseCode();
                        if (code >= 300 && code < 400) {
                            String loc = c.getHeaderField("Location");
                            c.disconnect();
                            if (loc == null) throw new IOException("Walang redirect");
                            cur = new URL(new URL(cur), loc).toString();
                            if (!cur.startsWith("https://")) throw new IOException("Hindi ligtas na link");
                            continue;
                        }
                        if (code != 200) throw new IOException("HTTP " + code);
                        ok = true;
                        break;
                    }
                    if (!ok) throw new IOException("Maraming redirect");
                    long total = c.getContentLengthLong();
                    long done = 0;
                    int lastPct = -1;
                    long lastAt = 0;
                    InputStream in = c.getInputStream();
                    FileOutputStream out = new FileOutputStream(part);
                    byte[] buf = new byte[32768];
                    int n;
                    while ((n = in.read(buf)) > 0) {
                        if (cancelled) { out.close(); in.close(); part.delete(); call.reject("Kinansela", "CANCELLED"); return; }
                        out.write(buf, 0, n);
                        done += n;
                        long now = System.currentTimeMillis();
                        int pct = total > 0 ? (int) (done * 100 / total) : -1;
                        if (pct != lastPct && now - lastAt > 120) {
                            lastPct = pct;
                            lastAt = now;
                            JSObject p = new JSObject();
                            p.put("done", done);
                            p.put("total", total);
                            p.put("pct", pct);
                            notifyListeners("progress", p);
                        }
                    }
                    out.flush();
                    out.close();
                    in.close();
                    // tiyaking APK (zip) ito at hindi page ng error
                    byte[] head = new byte[4];
                    FileInputStream fi = new FileInputStream(part);
                    int r = fi.read(head);
                    fi.close();
                    if (done < 1000000 || r < 4 || head[0] != 'P' || head[1] != 'K') {
                        part.delete();
                        call.reject("Hindi APK ang na-download");
                        return;
                    }
                    File apk = new File(d, "TindaMo.apk");
                    if (apk.exists()) apk.delete();
                    if (!part.renameTo(apk)) throw new IOException("Hindi ma-save ang file");
                    JSObject res = new JSObject();
                    res.put("size", done);
                    call.resolve(res);
                } catch (Exception e) {
                    if (part != null) part.delete();
                    call.reject(String.valueOf(e.getMessage()), "DOWNLOAD");
                } finally {
                    if (c != null) c.disconnect();
                }
            }
        }).start();
    }

    @PluginMethod
    public void install(PluginCall call) {
        try {
            File apk = new File(dir(), "TindaMo.apk");
            if (!apk.exists()) { call.reject("Walang na-download na file", "NOFILE"); return; }
            if (!allowed()) { call.reject("Kailangan ng permiso", "NEEDS_PERMISSION"); return; }
            Uri uri = FileProvider.getUriForFile(getContext(), getContext().getPackageName() + ".updatefp", apk);
            Intent i = new Intent(Intent.ACTION_VIEW);
            i.setDataAndType(uri, "application/vnd.android.package-archive");
            i.addFlags(Intent.FLAG_GRANT_READ_URI_PERMISSION | Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception e) {
            call.reject(String.valueOf(e.getMessage()), "INSTALL");
        }
    }
}
`;

export function ensureUpdater(root) {
  const find = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? find(path.join(d, e.name)) : e.name === 'MainActivity.java' ? [path.join(d, e.name)] : []);
  const base = path.join(root, 'android/app/src/main/java');
  const main = fs.existsSync(base) ? find(base)[0] : null;
  if (!main) { console.error('\nWalang MainActivity.java. Patakbuhin muna:  npm run android:setup\n'); process.exit(1); }
  const dir = path.dirname(main);
  let src = fs.readFileSync(main, 'utf8');
  const pkg = (src.match(/^\s*package\s+([\w.]+);/m) || [])[1];

  fs.writeFileSync(path.join(dir, 'ApkInstallerPlugin.java'), PLUGIN(pkg));
  fs.writeFileSync(path.join(dir, 'UpdateFileProvider.java'), `package ${pkg};\n\npublic class UpdateFileProvider extends androidx.core.content.FileProvider {}\n`);

  // MainActivity: irehistro ang plugin
  if (!src.includes('ApkInstallerPlugin')) {
    if (/void\s+onCreate\s*\(/.test(src)) {
      src = src.replace(/(void\s+onCreate\s*\([^)]*\)\s*\{)/, '$1\n        registerPlugin(ApkInstallerPlugin.class);');
    } else {
      src = src.replace(/(public\s+class\s+MainActivity[^{]*\{)/, '$1\n    @Override\n    public void onCreate(android.os.Bundle savedInstanceState) {\n        registerPlugin(ApkInstallerPlugin.class);\n        super.onCreate(savedInstanceState);\n    }\n');
    }
    if (!src.includes('ApkInstallerPlugin')) { console.error('\nHindi ma-patch ang MainActivity.java\n'); process.exit(1); }
    fs.writeFileSync(main, src);
  }

  // folder ng file na pwedeng i-share sa installer
  const xd = path.join(root, 'android/app/src/main/res/xml');
  fs.mkdirSync(xd, { recursive: true });
  fs.writeFileSync(path.join(xd, 'tindamo_update_paths.xml'), '<?xml version="1.0" encoding="utf-8"?>\n<paths>\n    <cache-path name="updates" path="updates/" />\n</paths>\n');

  // manifest: permiso at provider
  const mp = path.join(root, 'android/app/src/main/AndroidManifest.xml');
  let m = fs.readFileSync(mp, 'utf8');
  if (!m.includes('android.permission.REQUEST_INSTALL_PACKAGES')) {
    m = m.replace('<application', '<uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />\n\n    <application');
  }
  if (!m.includes('UpdateFileProvider')) {
    m = m.replace('</application>', `    <provider
            android:name=".UpdateFileProvider"
            android:authorities="\${applicationId}.updatefp"
            android:exported="false"
            android:grantUriPermissions="true">
            <meta-data android:name="android.support.FILE_PROVIDER_PATHS" android:resource="@xml/tindamo_update_paths" />
        </provider>
    </application>`);
  }
  fs.writeFileSync(mp, m);
}
