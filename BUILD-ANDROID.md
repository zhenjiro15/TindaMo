# TindaMo: gawing APK (Android app para sa phone at tablet)

Opsyonal na gabay ito. Ang pangunahing TindaMo ay **website** na (tingnan ang README.md at SETUP-DOMAIN.md). Totoong Android app ito, iisang APK para sa phone at tablet.

> **Paalala (V1.0.0)**: mula 1.0.0, ang versionCode ng APK ay 10000. Mas mababa ito sa naka-install na 1.2.8 (10208), kaya hindi ito mai-install bilang update sa 1.2.8: kailangang i-uninstall muna ang lumang app (i-sync muna sa cloud ang data).

## A. I-install muna (isang beses lang sa computer)

1. **Node.js 22 (LTS)**: https://nodejs.org (i-click ang LTS, Next lang hanggang matapos)
2. **Android Studio**: https://developer.android.com/studio
   - Buksan ito pagkatapos mag-install. Tapusin ang **Setup Wizard** (Standard). Dito dina-download ang Android SDK at Java.
   - Tapos: **More Actions → SDK Manager → SDK Platforms**. I-check ang **Android 16 (API 36)** at pindutin ang **Apply**.
   - Pagkatapos, pwede mo nang isara ang Android Studio.

## B. Buksan ang terminal sa folder ng TindaMo

1. I-unzip ang `TindaMo-V15-Android.zip`.
2. Sa VS Code: **File → Open Folder** → piliin ang folder na `tindamo`.
3. Buksan ang terminal: **Terminal → New Terminal** (o `Ctrl + `` `).
4. Siguraduhing nasa tamang folder. Dapat makita mo ang `package.json`:
   - Windows: `dir`
   - Mac/Linux: `ls`

## C. Mga command (isa-isa, hintayin matapos ang bawat isa)

```
npm install
```
Dina-download ang mga kailangan. Mga 1 hanggang 3 minuto.

```
npm run android:check
```
Chine-check kung handa ang computer. Dapat puro **[OK]** ang lalabas. Kapag may **[MALI]**, sundin ang sinasabi nito.

```
npm run android:setup
```
Isang beses lang. Gumagawa ng `android` folder, nilalagay ang permissions (camera, lokasyon, abiso) at ang icon ng TindaMo.

```
npm run android:apk
```
Ito ang gumagawa ng APK. **Ang unang beses ay matagal (5 hanggang 15 minuto)** dahil dina-download ni Gradle ang mga kailangan. Kailangan ng internet. Kapag tapos, lalabas ang:

```
release/TindaMo.apk
```

Para mabuksan agad ang folder (Windows): `explorer release`

## D. I-install sa phone o tablet

1. Ipasa ang `TindaMo.apk` sa phone (USB cable, Quick Share, Google Drive, Messenger).
2. Pindutin ang file sa phone. Kapag lumabas ang "Install unknown apps", i-**Allow** para sa app na pinagbuksan mo (Files, Chrome, atbp.).
3. Kapag lumabas ang Play Protect, pindutin ang **Install anyway** (normal ito sa APK na ikaw mismo ang gumawa).
4. Buksan ang **TindaMo**.

## E. Mga permiso (Allow)

Pagbukas ng app sa unang pagkakataon, kusang lalabas ang tanong ng Android: **Camera**, **Location**, at **Notifications**. Pindutin ang **Allow** (o "While using the app").

Kung napindot mo ang Don't allow, buksan ang Settings ng phone → **Apps → TindaMo → Permissions** (o Notifications), at i-**Allow**. Kapag sinubukan mo ulit ang scan, lokasyon o abiso sa app, lalabas din ang paalala kung paano.

## F. Pagkatapos mag-edit ng code

Patakbuhin lang ulit ang `npm run android:apk`, tapos i-install ang bagong APK sa ibabaw ng luma. Mananatili ang data mo kung sa iisang computer mo ginagawa ang APK.

## G. Kung may error

- **"SDK location not found"**: patakbuhin ang `npm run android:check`. Kailangan munang tapusin ang Setup Wizard ng Android Studio.
- **"Licenses not accepted"**: sa Android Studio, **SDK Manager → SDK Tools** at i-install ang **Android SDK Command-line Tools**. Tapos patakbuhin sa terminal (Windows): `%LOCALAPPDATA%\Android\Sdk\cmdline-tools\latest\bin\sdkmanager --licenses` at sagutin ang `y` sa lahat.
- **Error sa version ng plugin sa `npm install`**: patakbuhin ang `npm install @capacitor/<pangalan>@latest` (halimbawa `@capacitor/camera@latest`).
- **Mabagal o tumigil sa Gradle**: hintayin lang, o patakbuhin ulit ang `npm run android:apk`. Kailangan ng internet.
- Ang debug APK ay para sa sarili mong gamit. Para sa Google Play, kailangan ng signed release build.

## H. "Auto Blocker" / "Blocked by Auto Blocker" habang nag-i-install (Samsung)

Ang **Auto Blocker** ng Samsung (One UI 6.1 pataas) ay humaharang sa LAHAT ng app na galing sa labas ng Play Store / Galaxy Store. Hindi ito dahil virus ang TindaMo, at hindi ito maaayos ng code ng app. Ang APK ng TindaMo ay naka-sign na ng sariling permanenteng key (release build), pero hindi pa rin ito papayagan ng Auto Blocker.

Mga paraan:
1. **Pansamantalang patayin** (isang beses lang): Settings > Security and privacy > **Auto Blocker** > i-off ang **Block software from unauthorized sources** (o i-off ang buong Auto Blocker). I-install ang TindaMo, tapos pwede mo nang i-on ulit. Ang mga susunod na update ay maaaring hingin ulit ito.
2. **Para hindi na kailangan ang pagpatay**: i-publish ang app sa **Google Play** (Internal / Closed testing ay libre sa testers, kailangan ng Play Console developer account, bayad na $25 isang beses) o **Galaxy Store**. Ang app na galing sa store ay hindi hinaharang ng Auto Blocker. Kailangan ng **AAB** at ng parehong signing key.
3. Sa ibang phone: i-allow ang **Install unknown apps** para sa app na pinagbuksan mo ng APK, at **Install anyway** sa Play Protect.
