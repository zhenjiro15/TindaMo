# Online database (para bumalik ang data kahit ma-uninstall ang app)

Gumagamit ang TindaMo ng **Firebase** (libre ang Spark plan para sa maliit na tindahan).
Hangga't walang laman ang `js/config.js`, local lang ang app gaya ng dati.

## 1. Gumawa ng Firebase project
1. Pumunta sa https://console.firebase.google.com → **Add project**.
2. **Build → Authentication → Get started → Sign-in method** → i-enable ang **Email/Password**.
   (Ginagamit din ito ng *phone number + password*: ginagawang nakatagong email ang number.)
3. **Build → Firestore Database → Create database** (production mode).
4. Sa tab na **Rules**, i-paste ang laman ng `firestore.rules` → **Publish**.

## 2. Ilagay ang keys
**Project settings (⚙) → General**: kopyahin ang **Project ID** at **Web API Key** sa `js/config.js`:

```js
window.TINDAMO_CLOUD={ apiKey:'AIza...', projectId:'tindamo-xxxx', googleClientId:'' };
```
Huwag lagyan ng "restriction" ang API key (HTTP referrer / Android app) — hindi iyon gagana sa WebView ng app. Ligtas ito dahil ang Firestore rules ang nagbabantay ng data.

Tapos: `npm run android:sync` (o `android:apk`) para mabuo ulit ang app.

## 3. Google sign-in (optional)
1. Authentication → Sign-in method → i-enable ang **Google**.
2. **Web client ID** (Google Cloud → Credentials → OAuth client, type *Web*) → ilagay sa `googleClientId`.
3. **Sa Android app** kailangan ng native Google sign-in plugin. Handa ang code para sa `GoogleAuth` (`@codetrix-studio/capacitor-google-auth`) o `SocialLogin` (`@capgo/capacitor-social-login`). Piliin ang bersyong sumusuporta sa Capacitor 8, i-install, at ilagay ang SHA-1 ng app sa Firebase.
   Sa browser/PWA, gagana ito gamit ang Google web popup.

## Paano gumagana
- **Gumawa ng account** → gagawa ng online account at i-a-upload ang data.
- Bawat save (benta, item, utang, cashier list) → auto-backup pagkaraan ng ~2.5 segundo. Kapag walang internet, mag-aantay at susubukan ulit.
- **Na-uninstall ang app?** I-install ulit → **Sign in** gamit ang parehong email/number + password (o Google) → babalik ang items, benta, utang, code ng tindahan at listahan ng cashier.
- **Delete Account** → buburahin din ang online na data at account (kailangan ng internet).
- Kung dalawang phone ang gamit sa parehong account, ang pinakabagong save ang nananaig.

## Mga limitasyon
- Ang *phone number* login ay number + password lang. **Walang SMS code** (hindi na-verify ang number).
- Walang "Forgot password" pa.
- Ang cashier ay sumasali online (V26): scan ng QR o type ng code -> Tanggapin ng may-ari. Kailangan ang BAGONG `firestore.rules` (i-Publish ulit sa Firebase Rules).

## V26: Live na tindahan (may-ari + cashier)
1. **I-publish ulit ang `firestore.rules`** (Firestore → Rules → i-paste ang buong laman → Publish). Kung hindi, hindi makakasali ang mga cashier.
2. Walang dagdag na setting sa Authentication: gumagamit ang cashier ng nakatagong Email/Password account (na-enable mo na).
3. Gumagana kahit magkalayo ang may-ari at cashier. Mga ~5 segundo ang tagal bago lumabas sa kabila ang pagbabago.
4. Offline: tuloy ang benta ng cashier at magsi-sync pagbalik ng internet.
5. Abiso kapag sarado ang app ay kailangan ng push (FCM): wala pa; kapag bukas o nasa background ang app, may abiso.

## V27.1: Google sign-in sa Android app
1. Google Cloud (project ng Firebase) -> APIs & Services -> Credentials: dapat may **Web client** (ito ang nasa `googleClientId`) at isang **Android client** (package `com.tindamo.app` + SHA-1 ng app).
2. SHA-1: `cd android && gradlew signingReport` (Windows) / `./gradlew signingReport`. Kopyahin ang SHA1 ng `debug`.
3. Firebase -> Authentication -> Sign-in method -> i-enable ang Google.
4. Sa folder ng project: `npm install`, tapos `npm run android:setup` (ipapasok nito ang plugin at aayusin ang MainActivity), tapos `npm run android:apk`.
5. Kapag ibang computer ang nag-build, ibang SHA-1 ito: gumawa ng bagong Android client para doon.

## V1.1.4: Ayusin ang "Google sign-in failed [16] Account reauth failed"
Ito ay lumalabas kapag hindi tugma ang **SHA-1 ng key na ginamit sa pag-sign ng APK** sa nakarehistro sa Google Cloud.
Mula 1.1.1, ang APK ay pinipirmahan ng sariling key (`signing/tindamo-release.jks`), hindi na ng debug key, kaya ibang SHA-1 na ito.
1. Sa folder ng project: `npm run android:sha1` -> ipapakita ang **SHA-1** at SHA-256 ng release key mo.
2. Google Cloud Console (project ng Firebase) -> APIs & Services -> Credentials -> **Create credentials -> OAuth client ID -> Android**.
   Package name: `com.tindamo.app`, SHA-1: ang galing sa hakbang 1. (Pwedeng may isa pang client para sa debug SHA-1; hindi sila nag-iinterfere.)
3. Firebase -> Project settings -> Your apps (Android) -> **Add fingerprint** -> ilagay ang parehong SHA-1.
4. OAuth consent screen: kung naka-**Testing** ang status, idagdag ang mga Gmail na gagamit sa **Test users**, o i-**Publish app**.
5. Maghintay ng ilang minuto, buksan ulit ang app, at subukan ang **Continue with Google**. Hindi na kailangang mag-build ulit.
Kapag ang APK ay galing sa **ibang computer** o bagong key, ibang SHA-1 ito: ulitin ang mga hakbang. Ang `googleClientId` sa `config.js` ay dapat nanatiling **Web client**.


## V1.1.7: Ban / Block at Reports
I-**Publish ulit ang `firestore.rules`** (Firestore > Rules > i-paste ang buong laman > Publish). May bagong `/bans` (ban/block ng admin) at `/reports` (report ng user). Kung hindi, hindi gagana ang mga ito.

## Verify ng email sa Create account
Hindi na makakagawa ng account ang peke/maling email. Pagkatapos mag-Create account, magpapadala ang Firebase ng link sa email; kailangang pindutin muna iyon bago makapasok. Walang kailangang i-setup (default ito ng Firebase Authentication). **I-publish ulit ang `firestore.rules`** para makita ng Admin kung Google / Email ang ginamit ng bawat user.
