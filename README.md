# TindaMo (website)

POS, inventory at utang para sa tindahan. **Website na ito** na gumagana sa phone at laptop (Chrome, Edge, Safari), at pwedeng i-install bilang app (Add to Home Screen / Install). Plain HTML, CSS at JavaScript lang; walang build step para ma-host.

**Kasalukuyang version: 1.0.0.** Lahat ng dating bersyon ay isinama na dito; tingnan ang [VERSION.md](VERSION.md).

## Mga gabay
- **[SETUP-DOMAIN.md](SETUP-DOMAIN.md)**: paano ilagay sa GitHub Pages at gumamit ng sariling domain (hal. `https://tindamo.app`).
- [SETUP-CLOUD.md](SETUP-CLOUD.md): online database at login (Firebase).
- [VERSION.md](VERSION.md): paano gumagana ang version/update at ang lahat ng nasa 1.0.0.
- [BUILD-ANDROID.md](BUILD-ANDROID.md): opsyonal, kung gusto mo pa ring gumawa ng APK.

## Mga file

```
tindamo/
├─ index.html              pahina
├─ CNAME                   ang domain ng website (para sa GitHub Pages)
├─ .nojekyll               para ihain ng GitHub Pages ang mga file nang walang pagbabago
├─ version.json            version, min at notes (binabasa ng app para sa update)
├─ css/styles.css          disenyo (light/dark)
├─ js/                     logic ng app, hiwa-hiwalay kada feature:
│   ├─ helpers.js, storage.js, i18n.js (lahat ng salita sa 5 wika), accounts.js, state.js, ui.js   (pundasyon)
│   ├─ auth.js · cashier.js · link.js · profile.js · shell.js
│   ├─ sell.js · inventory.js · utang.js · sales.js   (mga tab)
│   ├─ cloud.js · sync.js · shop.js · team.js · inbox.js · version.js · config.js
│   ├─ camera.js · scanner.js · sticker.js · receipt.js · reminders.js
│   ├─ versions/v1.0.0.js  lahat ng dating patch, pinagsama (at ang bahaging pang-website)
│   ├─ events.js           router ng mga click
│   └─ main.js             simula ng app
├─ SFX/                    mga tunog (mp3). Palitan ng sarili mong mp3 (parehong pangalan)
├─ sw.js                   service worker (offline)
├─ manifest.webmanifest    para ma-install bilang app
├─ icons/                  app icon
├─ firestore.rules         rules ng Firebase (i-publish sa Firebase)
└─ package.json            optional, para sa `npm start`
```

## Patakbuhin sa computer mo (para subukan)

1. I-unzip, buksan ang folder sa **Visual Studio Code** (File > Open Folder > `tindamo`).
2. I-install ang extension na **Live Server**, i-right-click ang `index.html` > **Open with Live Server** (`http://127.0.0.1:5500`).
   Alternatibo: may Node.js ka, `npm start` tapos buksan ang `http://localhost:5500`.

Kailangan ng `localhost` o `https` para gumana ang camera/scanner at offline mode (hindi gagana sa double-click na `file://`).

## I-publish sa internet

Pinakamadali: **GitHub Pages** (libre) + sariling domain. Hakbang-hakbang ang nasa [SETUP-DOMAIN.md](SETUP-DOMAIN.md). Gumagana rin ang Netlify, Cloudflare Pages at Vercel: i-upload lang ang buong folder.

## Mga dapat tandaan

- Naka-save ang data (items, benta, utang, account) sa **localStorage ng browser** ng bawat device. Para sa backup at pag-sync sa ibang device, mag-login at gamitin ang online database (tingnan ang [SETUP-CLOUD.md](SETUP-CLOUD.md)).
- Huwag mag-Clear Data, Delete Account, o mag-clear ng browser data kung wala kang backup.
- Ang data ng website ay nakabase sa **address** (domain). Ang data sa `127.0.0.1:5500`, sa `zhenjiro15.github.io/TindaMo` at sa `tindamo.app` ay magkakahiwalay. Gumamit ng cloud login/Sync para ilipat.
- Ang "Continue with Google" ay kailangang may nakalistang domain sa Google Cloud at Firebase (nasa [SETUP-DOMAIN.md](SETUP-DOMAIN.md), Hakbang 8).

## Features

Sell (scan barcode, cart, Hold, cash/utang/kulang), Inventory (sticker, stock, expiry, category, maraming barcode), Utang (bayad per resibo/item, history, paalala), Benta (trend, top seller, insights, kasaysayan), Resibo na larawan, Cashier (role, live cart, kasaysayan), Online backup at Sync, Message at TindaMo AI, Admin, VIP, GCash, at 5 wika (Filipino, English, 한국어, 中文, 日本語). Buong listahan: [VERSION.md](VERSION.md).
