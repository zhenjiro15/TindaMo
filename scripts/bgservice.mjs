// V1.2.3: abiso kahit SARADO ang app (mensahe, sync request) gamit ang maliit na background service sa Android.
// Idempotent: pwedeng patakbuhin sa bawat build. Tinatawag ng android-setup.mjs at apk.mjs.
//
// Paano gumagana: ang app ay nagpapasa ng login token sa service. Ang service ay tumitingin sa Firestore (REST, parehong
// ginagamit ng app) kada ~30 segundo. Kapag may bago (sagot ng admin, bagong mensahe sa admin, sync request),
// naglalabas ito ng abiso sa phone. Kapag bukas ang app, hindi ito naglalabas (ang app na ang bahala).
// Hindi ito "totoong push" (FCM). Ang totoong push ay kailangan ng server (Firebase Cloud Functions, Blaze plan).
import fs from 'node:fs';
import path from 'node:path';

const PLUGIN = (pkg) => `package ${pkg};

import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.net.Uri;
import android.os.PowerManager;
import android.provider.Settings;
import androidx.core.content.ContextCompat;
import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/** V1.2.3: JS -> Android. Ipinapasa ang login token sa background service at sinisimulan o pinapatay ito. */
@CapacitorPlugin(name = "TindaBg")
public class TindaBgPlugin extends Plugin {

    private SharedPreferences prefs() {
        return getContext().getSharedPreferences(TindaBgService.PREFS, Context.MODE_PRIVATE);
    }

    @PluginMethod
    public void configure(PluginCall call) {
        try {
            SharedPreferences p = prefs();
            String uid = call.getString("uid", "");
            String old = p.getString("uid", "");
            SharedPreferences.Editor e = p.edit();
            if (!uid.equals(old)) {          // ibang account: kalimutan ang mga nakita na
                e.remove("seenThread").remove("seenAdmin").remove("xfSeen");
            }
            e.putBoolean("on", true);
            e.putString("apiKey", call.getString("apiKey", ""));
            e.putString("projectId", call.getString("projectId", ""));
            e.putString("refresh", call.getString("refresh", ""));
            e.putString("uid", uid);
            e.putBoolean("admin", Boolean.TRUE.equals(call.getBoolean("admin", false)));
            e.putString("tMsg", call.getString("tMsg", "TindaMo"));
            e.putString("tAdmin", call.getString("tAdmin", "TindaMo"));
            e.putString("tXfer", call.getString("tXfer", "TindaMo"));
            e.putString("bXfer", call.getString("bXfer", ""));
            e.putString("tRun", call.getString("tRun", "TindaMo"));
            e.putString("bRun", call.getString("bRun", ""));
            e.apply();
            TindaBgService.start(getContext());
            call.resolve();
        } catch (Exception ex) {
            call.reject(String.valueOf(ex.getMessage()));
        }
    }

    @PluginMethod
    public void stop(PluginCall call) {
        try {
            prefs().edit().putBoolean("on", false).remove("refresh").apply();
            getContext().stopService(new Intent(getContext(), TindaBgService.class));
            call.resolve();
        } catch (Exception ex) {
            call.reject(String.valueOf(ex.getMessage()));
        }
    }

    /** Bukas ba ang app sa harap? Kung oo, hindi maglalabas ng abiso ang service. */
    @PluginMethod
    public void setFg(PluginCall call) {
        TindaBgService.fg = Boolean.TRUE.equals(call.getBoolean("fg", false));
        call.resolve();
    }

    @PluginMethod
    public void batteryOk(PluginCall call) {
        JSObject r = new JSObject();
        boolean ok = true;
        try {
            PowerManager pm = (PowerManager) getContext().getSystemService(Context.POWER_SERVICE);
            ok = pm == null || pm.isIgnoringBatteryOptimizations(getContext().getPackageName());
        } catch (Exception ex) { ok = true; }
        r.put("ok", ok);
        call.resolve(r);
    }

    /** Buksan ang Android setting para hindi patayin ng battery saver ang service. */
    @PluginMethod
    public void batterySettings(PluginCall call) {
        try {
            Intent i = new Intent(Settings.ACTION_REQUEST_IGNORE_BATTERY_OPTIMIZATIONS, Uri.parse("package:" + getContext().getPackageName()));
            i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
            getContext().startActivity(i);
            call.resolve();
        } catch (Exception ex) {
            try {
                Intent i = new Intent(Settings.ACTION_IGNORE_BATTERY_OPTIMIZATION_SETTINGS);
                i.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK);
                getContext().startActivity(i);
                call.resolve();
            } catch (Exception e2) {
                call.reject(String.valueOf(e2.getMessage()));
            }
        }
    }
}
`;

const SERVICE = (pkg) => `package ${pkg};

import android.app.Notification;
import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.app.PendingIntent;
import android.app.Service;
import android.content.Context;
import android.content.Intent;
import android.content.SharedPreferences;
import android.content.pm.ServiceInfo;
import android.os.Build;
import android.os.IBinder;
import androidx.core.app.NotificationCompat;
import androidx.core.app.NotificationManagerCompat;
import androidx.core.content.ContextCompat;
import java.io.BufferedReader;
import java.io.InputStream;
import java.io.InputStreamReader;
import java.io.OutputStream;
import java.net.HttpURLConnection;
import java.net.URL;
import java.net.URLEncoder;
import org.json.JSONArray;
import org.json.JSONObject;

/**
 * V1.2.3: tahimik na background service. Tumitingin sa Firestore kada ~30 segundo (REST) para sa:
 *  - sagot ng admin sa user, o bagong mensahe sa admin
 *  - sync request galing sa ibang account
 * at naglalabas ng abiso sa phone kahit sarado ang app.
 */
public class TindaBgService extends Service {
    static final String PREFS = "tindamo_bg";
    static final String CH_CHAT = "tindamo-chat";
    static final String CH_RUN = "tindamo-bg";
    static final long EVERY_MS = 30000L;     // gaano kadalas tumingin (mensahe)
    static final int XFER_EVERY = 3;         // sync request: isang beses kada 3 tingin (~90 segundo)
    static volatile boolean fg = false;
    private static volatile boolean running = false;

    private Thread worker;
    private String idToken = null;
    private long idExp = 0;
    private int tick = 0;
    private int fails = 0;

    static void start(Context c) {
        try {
            ContextCompat.startForegroundService(c, new Intent(c, TindaBgService.class));
        } catch (Exception e) {
            // hindi pinayagan ng Android (nasa background): subukan ulit sa susunod na bukas ng app
        }
    }

    private SharedPreferences prefs() {
        return getSharedPreferences(PREFS, Context.MODE_PRIVATE);
    }

    @Override
    public IBinder onBind(Intent intent) {
        return null;
    }

    @Override
    public void onCreate() {
        super.onCreate();
        makeChannels();
    }

    private void makeChannels() {
        if (Build.VERSION.SDK_INT < 26) return;
        NotificationManager nm = (NotificationManager) getSystemService(Context.NOTIFICATION_SERVICE);
        if (nm == null) return;
        NotificationChannel chat = new NotificationChannel(CH_CHAT, "Mensahe at sync", NotificationManager.IMPORTANCE_HIGH);
        chat.enableVibration(true);
        nm.createNotificationChannel(chat);
        NotificationChannel run = new NotificationChannel(CH_RUN, "TindaMo (nakabantay)", NotificationManager.IMPORTANCE_MIN);
        run.setShowBadge(false);
        nm.createNotificationChannel(run);
    }

    private int smallIcon() {
        int id = getResources().getIdentifier("ic_stat_tindamo", "drawable", getPackageName());
        return id != 0 ? id : android.R.drawable.ic_dialog_info;
    }

    private PendingIntent openApp(int code) {
        Intent li = getPackageManager().getLaunchIntentForPackage(getPackageName());
        if (li == null) li = new Intent();
        li.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK | Intent.FLAG_ACTIVITY_SINGLE_TOP | Intent.FLAG_ACTIVITY_CLEAR_TOP);
        int fl = PendingIntent.FLAG_UPDATE_CURRENT | (Build.VERSION.SDK_INT >= 23 ? PendingIntent.FLAG_IMMUTABLE : 0);
        return PendingIntent.getActivity(this, code, li, fl);
    }

    private Notification runNotif() {
        SharedPreferences p = prefs();
        return new NotificationCompat.Builder(this, CH_RUN)
            .setSmallIcon(smallIcon())
            .setContentTitle(p.getString("tRun", "TindaMo"))
            .setContentText(p.getString("bRun", ""))
            .setPriority(NotificationCompat.PRIORITY_MIN)
            .setOngoing(true)
            .setShowWhen(false)
            .setContentIntent(openApp(10))
            .build();
    }

    @Override
    public int onStartCommand(Intent intent, int flags, int startId) {
        if (!prefs().getBoolean("on", false)) {
            stopSelf();
            return START_NOT_STICKY;
        }
        try {
            if (Build.VERSION.SDK_INT >= 34) {
                startForeground(7301, runNotif(), ServiceInfo.FOREGROUND_SERVICE_TYPE_SPECIAL_USE);
            } else {
                startForeground(7301, runNotif());
            }
        } catch (Exception e) {
            stopSelf();
            return START_NOT_STICKY;
        }
        if (!running) {
            running = true;
            worker = new Thread(new Runnable() {
                @Override
                public void run() {
                    loop();
                }
            }, "tindamo-bg");
            worker.setDaemon(true);
            worker.start();
        }
        return START_STICKY;
    }

    @Override
    public void onDestroy() {
        running = false;
        if (worker != null) worker.interrupt();
        super.onDestroy();
    }

    private void loop() {
        while (running) {
            try {
                if (!prefs().getBoolean("on", false)) break;
                poll();
                fails = 0;
            } catch (Exception e) {
                fails++;
            }
            try {
                Thread.sleep(EVERY_MS + Math.min(fails, 6) * 15000L);
            } catch (InterruptedException e) {
                break;
            }
        }
        running = false;
        if (!prefs().getBoolean("on", false)) stopSelf();
    }

    /* ---------------- network ---------------- */
    private String readAll(InputStream in) throws Exception {
        if (in == null) return "";
        BufferedReader br = new BufferedReader(new InputStreamReader(in, "UTF-8"));
        StringBuilder sb = new StringBuilder();
        String line;
        while ((line = br.readLine()) != null) sb.append(line);
        br.close();
        return sb.toString();
    }

    private String token() throws Exception {
        if (idToken != null && idExp > System.currentTimeMillis() + 60000L) return idToken;
        SharedPreferences p = prefs();
        String refresh = p.getString("refresh", "");
        String key = p.getString("apiKey", "");
        if (refresh.length() == 0 || key.length() == 0) throw new Exception("NOSESSION");
        HttpURLConnection c = (HttpURLConnection) new URL("https://securetoken.googleapis.com/v1/token?key=" + URLEncoder.encode(key, "UTF-8")).openConnection();
        c.setRequestMethod("POST");
        c.setConnectTimeout(15000);
        c.setReadTimeout(20000);
        c.setDoOutput(true);
        c.setRequestProperty("Content-Type", "application/x-www-form-urlencoded");
        byte[] body = ("grant_type=refresh_token&refresh_token=" + URLEncoder.encode(refresh, "UTF-8")).getBytes("UTF-8");
        OutputStream os = c.getOutputStream();
        os.write(body);
        os.close();
        int code = c.getResponseCode();
        String txt = readAll(code >= 200 && code < 300 ? c.getInputStream() : c.getErrorStream());
        c.disconnect();
        if (code < 200 || code >= 300) throw new Exception("TOKEN " + code);
        JSONObject j = new JSONObject(txt);
        idToken = j.getString("id_token");
        long secs = 3600;
        try { secs = Long.parseLong(j.optString("expires_in", "3600")); } catch (Exception e) { secs = 3600; }
        idExp = System.currentTimeMillis() + secs * 1000L;
        String nr = j.optString("refresh_token", "");
        if (nr.length() > 0 && !nr.equals(refresh)) p.edit().putString("refresh", nr).apply();
        return idToken;
    }

    private String base() {
        return "https://firestore.googleapis.com/v1/projects/" + prefs().getString("projectId", "") + "/databases/(default)/documents";
    }

    /** GET. null = 404 (wala). */
    private JSONObject get(String path) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(base() + path).openConnection();
        c.setConnectTimeout(15000);
        c.setReadTimeout(20000);
        c.setRequestProperty("Authorization", "Bearer " + token());
        int code = c.getResponseCode();
        if (code == 404) { c.disconnect(); return null; }
        String txt = readAll(code >= 200 && code < 300 ? c.getInputStream() : c.getErrorStream());
        c.disconnect();
        if (code == 401) idToken = null;
        if (code < 200 || code >= 300) throw new Exception("HTTP " + code);
        return new JSONObject(txt);
    }

    private JSONArray runQuery(String body) throws Exception {
        HttpURLConnection c = (HttpURLConnection) new URL(base() + ":runQuery").openConnection();
        c.setRequestMethod("POST");
        c.setConnectTimeout(15000);
        c.setReadTimeout(20000);
        c.setDoOutput(true);
        c.setRequestProperty("Authorization", "Bearer " + token());
        c.setRequestProperty("Content-Type", "application/json");
        OutputStream os = c.getOutputStream();
        os.write(body.getBytes("UTF-8"));
        os.close();
        int code = c.getResponseCode();
        String txt = readAll(code >= 200 && code < 300 ? c.getInputStream() : c.getErrorStream());
        c.disconnect();
        if (code == 401) idToken = null;
        if (code < 200 || code >= 300) throw new Exception("HTTP " + code);
        return new JSONArray(txt);
    }

    /* ---------------- field helpers ---------------- */
    private static long fInt(JSONObject f, String k) {
        if (f == null) return 0;
        JSONObject x = f.optJSONObject(k);
        if (x == null) return 0;
        try { return Long.parseLong(x.optString("integerValue", "0")); } catch (Exception e) { return 0; }
    }

    private static String fStr(JSONObject f, String k) {
        if (f == null) return "";
        JSONObject x = f.optJSONObject(k);
        return x == null ? "" : x.optString("stringValue", "");
    }

    private static boolean isNew(String last) {
        return last.startsWith("\\u21a9") || last.startsWith("\\u26a0");
    }

    private static String clean(String s) {
        String r = s.replaceFirst("^[\\\\u21a9\\\\u26a0\\\\uFE0F\\\\s]+", "");
        return r.length() > 120 ? r.substring(0, 120) : r;
    }

    /* ---------------- ang pagtingin ---------------- */
    private void poll() throws Exception {
        SharedPreferences p = prefs();
        String uid = p.getString("uid", "");
        if (uid.length() == 0) return;
        boolean admin = p.getBoolean("admin", false);
        boolean show = !fg;

        if (admin) {
            String q = "{\\"structuredQuery\\":{\\"from\\":[{\\"collectionId\\":\\"threads\\"}],\\"where\\":{\\"fieldFilter\\":{\\"field\\":{\\"fieldPath\\":\\"unreadAdmin\\"},\\"op\\":\\"GREATER_THAN\\",\\"value\\":{\\"integerValue\\":\\"0\\"}}},\\"limit\\":30}}";
            JSONArray arr = runQuery(q);
            long max = 0;
            long seen = p.getLong("seenAdmin", -1);
            String who = "";
            int n = 0;
            for (int i = 0; i < arr.length(); i++) {
                JSONObject d = arr.optJSONObject(i);
                JSONObject doc = d == null ? null : d.optJSONObject("document");
                if (doc == null) continue;
                JSONObject f = doc.optJSONObject("fields");
                long ts = fInt(f, "lastTs");
                if (ts > max) max = ts;
                if (ts > seen) {
                    n++;
                    who = fStr(f, "email") + ": " + fStr(f, "last");
                }
            }
            if (seen < 0) {
                p.edit().putLong("seenAdmin", max).apply();
            } else {
                if (n > 0 && show) notifyOne(1002, p.getString("tAdmin", "TindaMo"), who.length() > 120 ? who.substring(0, 120) : who);
                if (max > seen || n > 0) p.edit().putLong("seenAdmin", Math.max(max, seen)).apply();
            }
        } else {
            JSONObject d = get("/threads/" + uid);
            if (d != null) {
                JSONObject f = d.optJSONObject("fields");
                long ts = fInt(f, "lastTs");
                String last = fStr(f, "last");
                long seen = p.getLong("seenThread", -1);
                if (seen < 0) {
                    p.edit().putLong("seenThread", ts).apply();
                } else if (ts > seen) {
                    if (isNew(last) && show) notifyOne(1001, p.getString("tMsg", "TindaMo"), clean(last));
                    p.edit().putLong("seenThread", ts).apply();
                }
            }
        }

        tick++;
        if (tick % XFER_EVERY == 1) checkXfer(uid, show);
    }

    private void checkXfer(String uid, boolean show) throws Exception {
        SharedPreferences p = prefs();
        JSONObject l = get("/inbox/" + uid + "/xfer?pageSize=20");
        if (l == null) return;
        JSONArray docs = l.optJSONArray("documents");
        if (docs == null) return;
        String seen = "," + p.getString("xfSeen", "") + ",";
        StringBuilder add = new StringBuilder();
        for (int i = 0; i < docs.length(); i++) {
            JSONObject doc = docs.optJSONObject(i);
            if (doc == null) continue;
            JSONObject f = doc.optJSONObject("fields");
            if (!"p".equals(fStr(f, "st"))) continue;
            String name = doc.optString("name", "");
            String id = name.substring(name.lastIndexOf('/') + 1);
            if (seen.contains("," + id + ",")) continue;
            add.append(',').append(id);
            if (show) {
                String from = fStr(f, "fs");
                if (from.length() == 0) from = fStr(f, "fe");
                notifyOne(2000 + Math.abs(id.hashCode() % 5000), p.getString("tXfer", "TindaMo"), (from + " " + p.getString("bXfer", "")).trim());
            }
        }
        if (add.length() > 0) {
            String all = (p.getString("xfSeen", "") + add).replaceFirst("^,", "");
            String[] parts = all.split(",");
            StringBuilder out = new StringBuilder();
            for (int i = Math.max(0, parts.length - 30); i < parts.length; i++) {
                if (parts[i].length() == 0) continue;
                if (out.length() > 0) out.append(',');
                out.append(parts[i]);
            }
            p.edit().putString("xfSeen", out.toString()).apply();
        }
    }

    private void notifyOne(int id, String title, String text) {
        try {
            Notification n = new NotificationCompat.Builder(this, CH_CHAT)
                .setSmallIcon(smallIcon())
                .setContentTitle(title)
                .setContentText(text)
                .setStyle(new NotificationCompat.BigTextStyle().bigText(text))
                .setPriority(NotificationCompat.PRIORITY_HIGH)
                .setDefaults(Notification.DEFAULT_ALL)
                .setAutoCancel(true)
                .setContentIntent(openApp(id))
                .build();
            NotificationManagerCompat.from(this).notify(id, n);
        } catch (SecurityException e) {
            // walang permiso sa abiso
        } catch (Exception e) {
            // huwag mag-crash
        }
    }
}
`;

const BOOT = (pkg) => `package ${pkg};

import android.content.BroadcastReceiver;
import android.content.Context;
import android.content.Intent;

/** V1.2.3: pagkabukas ng phone (o pagkatapos mag-update ng app), ibalik ang background service kung naka-ON. */
public class TindaBgBoot extends BroadcastReceiver {
    @Override
    public void onReceive(Context ctx, Intent intent) {
        try {
            if (ctx.getSharedPreferences(TindaBgService.PREFS, Context.MODE_PRIVATE).getBoolean("on", false)) {
                TindaBgService.start(ctx);
            }
        } catch (Exception e) {
            // huwag mag-crash
        }
    }
}
`;

export function ensureBg(root) {
  const find = d => fs.readdirSync(d, { withFileTypes: true }).flatMap(e => e.isDirectory() ? find(path.join(d, e.name)) : e.name === 'MainActivity.java' ? [path.join(d, e.name)] : []);
  const base = path.join(root, 'android/app/src/main/java');
  const main = fs.existsSync(base) ? find(base)[0] : null;
  if (!main) { console.error('\nWalang MainActivity.java. Patakbuhin muna:  npm run android:setup\n'); process.exit(1); }
  const dir = path.dirname(main);
  let src = fs.readFileSync(main, 'utf8');
  const pkg = (src.match(/^\s*package\s+([\w.]+);/m) || [])[1];

  fs.writeFileSync(path.join(dir, 'TindaBgPlugin.java'), PLUGIN(pkg));
  fs.writeFileSync(path.join(dir, 'TindaBgService.java'), SERVICE(pkg));
  fs.writeFileSync(path.join(dir, 'TindaBgBoot.java'), BOOT(pkg));

  // MainActivity: irehistro ang plugin
  if (!src.includes('TindaBgPlugin')) {
    if (src.includes('registerPlugin(ApkInstallerPlugin.class);')) {
      src = src.replace('registerPlugin(ApkInstallerPlugin.class);', 'registerPlugin(ApkInstallerPlugin.class);\n        registerPlugin(TindaBgPlugin.class);');
    } else if (/void\s+onCreate\s*\(/.test(src)) {
      src = src.replace(/(void\s+onCreate\s*\([^)]*\)\s*\{)/, '$1\n        registerPlugin(TindaBgPlugin.class);');
    } else {
      src = src.replace(/(public\s+class\s+MainActivity[^{]*\{)/, '$1\n    @Override\n    public void onCreate(android.os.Bundle savedInstanceState) {\n        registerPlugin(TindaBgPlugin.class);\n        super.onCreate(savedInstanceState);\n    }\n');
    }
    if (!src.includes('TindaBgPlugin')) { console.error('\nHindi ma-patch ang MainActivity.java\n'); process.exit(1); }
    fs.writeFileSync(main, src);
  }

  // manifest: permiso, service at receiver
  const mp = path.join(root, 'android/app/src/main/AndroidManifest.xml');
  let m = fs.readFileSync(mp, 'utf8');
  const perms = [
    'android.permission.FOREGROUND_SERVICE',
    'android.permission.FOREGROUND_SERVICE_SPECIAL_USE',
    'android.permission.REQUEST_IGNORE_BATTERY_OPTIMIZATIONS',
    'android.permission.RECEIVE_BOOT_COMPLETED',
    'android.permission.POST_NOTIFICATIONS',
    'android.permission.INTERNET'
  ].filter(p => !m.includes(p));
  if (perms.length) m = m.replace('<application', perms.map(p => '<uses-permission android:name="' + p + '" />').join('\n    ') + '\n\n    <application');
  if (!m.includes('TindaBgService')) {
    m = m.replace('</application>', `    <service
            android:name=".TindaBgService"
            android:exported="false"
            android:foregroundServiceType="specialUse">
            <property
                android:name="android.app.PROPERTY_SPECIAL_USE_FGS_SUBTYPE"
                android:value="Checks for new chat messages and sync requests while the app is closed" />
        </service>
        <receiver android:name=".TindaBgBoot" android:exported="true">
            <intent-filter>
                <action android:name="android.intent.action.BOOT_COMPLETED" />
                <action android:name="android.intent.action.MY_PACKAGE_REPLACED" />
            </intent-filter>
        </receiver>
    </application>`);
  }
  fs.writeFileSync(mp, m);
}
