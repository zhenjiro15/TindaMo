# Version ng TindaMo (website)

Kasalukuyan: **1.0.0**  ·  Website: **https://tindamo.app** (palitan kung iba ang domain mo)  ·  GitHub: https://github.com/zhenjiro15/TindaMo

> Nagsimula ulit ang bilang sa **1.0.0**. Lahat ng dating bersyon (1.0.0 hanggang 1.2.8, kasama ang mga lumang V22 hanggang V38) ay **isinama na sa 1.0.0**. Ang code ng lahat ng dating patch ay nasa iisang file na: `js/versions/v1.0.0.js`.

## Paano gumagana ang version
- **Update (website)**: ang app ay tumitingin sa `version.json` ng sarili mong site kada ~30 minuto. Kapag mas mataas ang `version` doon kaysa sa version ng bukas na app, lalabas ang "May bagong version!" na may **I-update** (nire-refresh ang website at kinukuha ang bagong files) at **Mamaya na** (tahimik sa loob ng 24 oras). Makikita rin sa Settings > Bersyon ng app.
- **Pinakamababang version (`min`)**: kapag mas mababa ang version ng app kaysa sa `min` sa `version.json`, may harang na screen na hindi maisasara hanggang mag-update. Alisin ang `min` para alisin ang harang.
- **Cashier**: dapat PAREHO ang version ng cashier at ng may-ari. Kapag magkaiba, may harang na screen sa cashier. Hindi rin tatanggapin ng may-ari ang benta ng cashier na iba ang version (nananatili ito sa device ng cashier at maipapadala pagkatapos mag-update). Nakikita ng may-ari ang version ng bawat cashier.
- **"Ano ang bago?"**: galing sa `notes` ng `version.json` (pwedeng gumamit ng `-` bullets, `##` heading at `**bold**`).

## Paglabas ng bagong version (hal. 1.0.1)
1. Palitan ang `ver` sa `js/version.js` (APP_VER.ver), ang `version` (at `notes`) sa `version.json`, at ang `version` sa `package.json`.
2. Palitan ang pangalan ng cache sa `sw.js` (`CACHE = 'tindamo-web-1.0.1'`).
3. Kung may bagong code: gumawa ng `js/versions/v1.0.1.js`, idagdag sa `index.html` (bago ang `js/main.js`) at sa `SHELL` ng `sw.js`.
4. I-push sa `main`. Pagkatapos ng 1 hanggang 2 minuto, makikita na ng lahat. Ang mga naka-bukas ay makakakita ng "May bagong version!".
5. Para pilitin ang lahat na mag-update: itaas ang `min` sa `version.json`.

## Ano ang nasa 1.0.0 (lahat ng dating bersyon, pinagsama)

### Benta (Sell)
- Scan ng barcode na may cart sa loob ng scanner (Tap to scan / Continuous), cash o utang. Hindi na tumatalon sa taas ang listahan at hindi na bumabalik sa taas ang scroll kapag nag +/-.
- **Maraming barcode sa isang item**; hindi pwedeng gamitin sa ibang item ang parehong barcode.
- **Hold** ng cart (ipila ang isang customer, asikasuhin ang iba, tapos ituloy). **Ibalik (Undo)** kapag naalis ang item sa cart. I-type ang eksaktong dami (pindutin ang numero sa cart).
- **Kulang ang bayad**: halimbawa total ₱45, ₱30 ang ibinigay. May tanong na **Payagan / Hindi** na gawing utang ang kulang. Naitatala bilang utang na "Kulang" at lalabas ang **Resibo ng Utang**; ang binayad ay bilang cash sa Benta.
- Paborito na item, Target sa benta kada araw (may confetti), Listahan ng bibilhin (kulang na stock) na pwedeng i-share.
- Kapag pinindot ang Enter / Search, kusang nagsasara ang keyboard.

### Inventory
- Larawan na ginagawang **sticker** (tinatanggal ang background); may ON / OFF na switch na naaalala ang huling pinili. **Kopyahin ang item** para sa magkakaparehong produkto na iba ang lasa o laki.
- Stock, expiry (may bagong kalendaryo at mabilis na pindot: 1 linggo, 1 buwan, 3, 6, 1 taon), category, filter (Lahat / Mababa / Ubos / Malapit mag-expire), stock bar.
- **Camera**: mas mabilis na bukas (naaalala ang tamang camera at pinapainit kapag binuksan ang form ng item).
- **Abiso ng expiry**: 7, 3, 1 araw bago, sa mismong araw, at kapag expired na.

### Utang
- Listahan ng may utang na may search, edad ng utang ("5 araw nang may utang"), at bar ng lampas na sa takda.
- **Bayad sa utang, 3 paraan**: Lahat (pinakamatandang utang muna), Per resibo, Per item. May sukli kapag sobra, at **Kulang** kapag kulang (per item at per resibo). Hindi nagiging negatibo ang natitirang utang.
- Kapag fully paid na ang customer, naka-archive ang dati niyang utang sa **Bayad nang history**. Selyong **Hindi Pa Bayad / Bahagyang Bayad / Fully Paid**.
- **Kasaysayan ng utang na papel** (parang talaan/resibo) na may balanse sa bawat linya.
- **Clear Data Utang** sa Profile; **Paalalahanan ang may utang** (share ng mensahe).
- **Abiso sa utang**: mapipili kung ilang araw bago (7/5/3/2/1), sa mismong araw, at kapag lampas na. May "Subukan ang abiso".

### Resibo at Benta
- Resibo na papel na ipapasa bilang **larawan (PNG)**: benta, utang, bayad at Statement ng buong utang. Bagong disenyo na may logo, malaking kabuuan, kahon ng balanse at sukli.
- Benta page: Araw / Linggo / Buwan, live trend, 7 araw (berde = benta, pula = naging utang), mga button na Buod, Top Seller, Category, Utang, Insights, Kasaysayan. Walang tubo. Ulat ngayong araw na may kumpara sa kahapon at nabayarang utang.

### Account, cloud at Sync
- Login gamit ang email, phone number o Google. Online backup at restore (Firebase): tingnan ang `SETUP-CLOUD.md`.
- **Create account na totoong email lang**: may verification email bago magawa ang account. Ang phone number ay hindi pa pwede sa Create account (ang lumang phone account ay makakapag-sign in pa rin).
- **Sync**: I-sync ngayon, Auto-sync, tanong kung alin ang gagamitin kapag may conflict, at file sync kapag walang internet. **Kunin ang data ng ibang device** gamit ang Code ng account (may Decline / Accept at lumulutang na progress).
- **Iisang account sa iba't ibang device** (phone, laptop, website): lalabas sa kabila ang benta at pagbabago sa loob ng ~7 segundo.
- Naayos ang "Online database problem: INCOMPLETE": mas ligtas na upload (lahat o wala), ilang beses na subok, at pagbawi ng pinakabagong buong backup.
- **Profile photo** na may bilog na crop (i-drag at i-zoom); kusang kinukuha sa cloud.
- **Delete Account**: hihingi ng password (o Google login ulit) para makumpirma.

### Cashier at team
- Pagsali ng cashier gamit ang code o QR ng tindahan; Auto-link (QR, WiFi/hotspot) at GPS ng cashier.
- **Role ng cashier**: Cashier (benta lang), All Access, View lang, Edit at Scanner lang. Agad ang bagong role (may abiso).
- **Leave**: aalis ang cashier sa tindahan (may abiso ang may-ari).
- **Ginagawa ng mga cashier**: live na cart at kasaysayan (dagdag/bawas/alis sa cart, benta, gawa/edit/bura ng item, sumali/umalis), may filter kada cashier.
- Dapat parehong version ang cashier at may-ari (tingnan sa itaas).

### Message, Admin, VIP at GCash
- **Message**: live (may "nagta-type"), larawan na may caption, Reply / Copy / Edit / React (long-press), swipe para mag-Reply, Delete ("Deleted Message"), Report (Bug, Problema sa bayad, Inirereklamong user, Iba pa). **TindaMo AI** ("AI Tulong"; text, voice, larawan, Reply): kailangan ng AI server, tingnan ang `ai-proxy/README.md` at `js/config.js`.
- **Admin / Dev**: listahan ng User (search, filter Online/Offline, tatak na Google / Email, Dev / Admin / VIP / Guest), Babala, Ban (1/2/7/30 araw), Block, Mensahe, VIP, at Reports. **Dev lang** ang pwedeng Burahin ang account, Reset Password at Gawing Admin. Ang naka-ban/block ay may harang na screen.
- **VIP**: Guest (hanggang 85 items at 75 na taong may utang), VIP (walang limit), Admin, Dev. May presyo ng VIP na mababago ng Admin (Admin > User). Ang pagbibigay o pag-alis ng VIP ay agad na lumalabas.
- **GCash** (menu): setup, PIN, balance ng wallet, Cash In / Cash Out / Load (may SIM) na may resibo, at tab na GCash sa Bayad. Hindi ito direktang konektado sa GCash mismo; may **Ayusin ang balance** para itugma.
- Kailangang naka-publish ang pinakabagong `firestore.rules` sa Firebase.

### Itsura at tunog
- TindaMo theme (scalloped na awning, floating nav, liquid glass), 5 kulay ng app at sariling kulay, light/dark, 5 wika (Filipino, English, 한국어, 中文, 日本語).
- Mga tunog sa folder na `SFX/` (scan, success, error, at mga tap). Pwedeng palitan ng sariling mp3 na may parehong pangalan.
- Hilahin pababa ang guhit sa taas ng kahit anong pop-up para isara.

### Android app (opsyonal)
- Nandito pa rin ang mga script para gumawa ng APK (`npm run android:apk`): abiso kahit sarado ang app, in-app update ng APK, Google sign-in sa Android. Tingnan ang `BUILD-ANDROID.md`.
- **Paalala**: ang versionCode ng APK ay galing sa version (1.0.0 = 10000). Mas mababa ito sa 1.2.8 (10208), kaya hindi mapapalitan ng APK na 1.0.0 ang naka-install na 1.2.8; kailangang i-uninstall muna (i-sync muna ang data sa cloud).
