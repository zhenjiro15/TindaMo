# Paano ilagay ang TindaMo sa internet na may sariling domain

Resulta: bubuksan ng kahit sino ang **https://tindamo.app** (o ang domain na pipiliin mo) at lalabas ang TindaMo. Libre ang hosting (GitHub Pages). Ang bayad lang ay ang domain mismo, kada taon.

> **Pangalan**: ang app ay **TindaMo**, kaya `tindamo.app` ang ginamit sa gabay na ito. Kung `tindomo.app` (may "o") ang gusto mo, palitan lang ito sa lahat ng hakbang, pati sa file na `CNAME`. Hindi ko matitiyak kung available ang pangalan; i-search ito sa registrar bago bumili.

Ang `.app` ay laging **HTTPS** (secure). Mabuti iyon: kailangan din ng HTTPS ng camera/scanner at ng offline mode ng TindaMo, at nagbibigay ang GitHub Pages ng HTTPS nang libre.

---

## Hakbang 1: Bumili ng domain
Pumili ng registrar at hanapin ang pangalan: **Cloudflare Registrar**, **Namecheap**, **Porkbun**, **GoDaddy**, o iba pa. Ang presyo ng `.app` ay nag-iiba sa bawat registrar (karaniwang ilang USD kada taon, at kadalasang mas mahal ang renewal kaysa sa unang taon). Tingnan ang presyo bago mag-checkout.

Ang kailangan mo lang sa registrar ay ang **DNS settings** ng domain (tinatawag ding "Advanced DNS" o "Manage DNS").

## Hakbang 2: I-upload ang TindaMo sa GitHub
1. Sa GitHub, buksan ang repo mo: `github.com/zhenjiro15/TindaMo`.
2. I-upload ang **laman** ng folder na `tindamo` (hindi ang mismong folder). Dapat nasa pinakaunang antas ng repo ang `index.html`, `CNAME`, `sw.js`, `version.json`, `css/`, `js/`, atbp.
   - Sa GitHub website: **Add file > Upload files**, i-drag ang lahat ng laman, tapos **Commit changes**.
   - O gamit ang git:
     ```
     git add .
     git commit -m "TindaMo 1.0.0 website"
     git push
     ```
3. Siguraduhing kasama ang file na **`CNAME`** (laman: `tindamo.app`) at **`.nojekyll`**. Kung ibang domain ang binili mo, buksan ang `CNAME` at palitan ang laman (isang linya lang, walang `https://`).

## Hakbang 3: I-on ang GitHub Pages
1. Sa repo: **Settings > Pages**.
2. **Build and deployment > Source**: piliin **Deploy from a branch**.
3. **Branch**: `main`, folder: `/ (root)`, tapos **Save**.
4. Maghintay ng 1 hanggang 2 minuto. Lalabas ang link sa taas ng page, hal. `https://zhenjiro15.github.io/TindaMo/`. Buksan ito para masubukan na gumagana na bago ang domain.

## Hakbang 4: Ilagay ang domain sa GitHub (gawin ito BAGO ang DNS)
1. Sa **Settings > Pages > Custom domain**, i-type ang `tindamo.app` at pindutin ang **Save**.
2. Magsasabi ito ng "DNS check in progress" o "DNS check unsuccessful". Normal iyan hanggang hindi pa nakaayos ang DNS (susunod na hakbang).

(Inirerekomenda ng GitHub na ilagay muna ang domain dito bago i-set ang DNS, para walang ibang makapag-host ng site sa domain mo.)

## Hakbang 5: I-set ang DNS sa registrar
Sa DNS settings ng domain mo, **burahin muna ang mga default/parking record** (ang mga A record na nagtuturo sa parking page ng registrar), tapos idagdag ang mga ito:

| Type | Host / Name | Value |
|------|-------------|-------|
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `zhenjiro15.github.io` |

Opsyonal (IPv6), apat na AAAA record sa `@`: `2606:50c0:8000::153`, `2606:50c0:8001::153`, `2606:50c0:8002::153`, `2606:50c0:8003::153`.

Mga tala:
- Ang `@` ay ang mismong domain (`tindamo.app`). May registrar na `@` ang nilalagay, may iba na blangko.
- Ang Value ng CNAME ay `<username>.github.io` **lang** (walang `/TindaMo`).
- Kung **Cloudflare** ang DNS mo, gawing **DNS only** (grey cloud, hindi orange) ang mga record na ito.
- Huwag gumamit ng wildcard record (`*`).
- Kung ibang GitHub username ang gamit mo, palitan ang `zhenjiro15`.
- Ang mga IP address na ito ay galing sa opisyal na dokumentasyon ng GitHub Pages. Kung may nagbago, nasa docs.github.com ang bago (hanapin: "Managing a custom domain for your GitHub Pages site").

## Hakbang 6: Hintayin at i-check
Ang DNS ay inaabot ng ilang minuto hanggang **24 oras**. Para i-check sa Windows (PowerShell o Command Prompt):
```
nslookup tindamo.app
```
Dapat lumabas ang apat na IP na `185.199.108.153` hanggang `185.199.111.153`. (Sa Mac/Linux: `dig tindamo.app +noall +answer`.)

Pagkatapos, balikan ang **Settings > Pages**. Kapag may berdeng "DNS check successful", pwede na ang susunod.

## Hakbang 7: I-on ang HTTPS
Sa **Settings > Pages**, i-check ang **Enforce HTTPS**. Kung naka-grey pa ito, maghintay (hanggang isang oras o higit pa) habang ginagawa ng GitHub ang certificate. Pagkatapos, buksan ang **https://tindamo.app**. Dapat lumabas ang TindaMo.

Opsyonal pero mabuti para sa seguridad: **i-verify ang domain** sa GitHub (Profile > Settings > Pages > Add a domain). Magbibigay ito ng TXT record na `_github-pages-challenge-<username>` na ilalagay mo sa DNS.

## Hakbang 8: Ayusin ang login (Firebase at Google)
Ang bagong address ay kailangang kilala ng Firebase at ng Google, kung hindi ay pwedeng pumalya ang login at ang "Continue with Google". Gawin ito nang isang beses:

1. **Firebase Console** > project mo (`tindamo-6fa91`) > **Authentication > Settings > Authorized domains > Add domain**. Idagdag ang `tindamo.app` at `www.tindamo.app`.
2. **Google Cloud Console** (parehong project) > **APIs & Services > Credentials** > buksan ang **Web client** na ginagamit ng app (ang `googleClientId` sa `js/config.js`) > **Authorized JavaScript origins > Add URI**. Idagdag ang:
   - `https://tindamo.app`
   - `https://www.tindamo.app`
   - `https://zhenjiro15.github.io` (para gumana rin ang GitHub link)
   
   Tapos **Save** (maaaring ilang minuto bago mag-bisa).
3. Kung may **restriction** ang API key mo (Credentials > API key > Application restrictions = HTTP referrers), idagdag ang `https://tindamo.app/*` at `https://www.tindamo.app/*`.

## Hakbang 9: Subukan
- Buksan ang https://tindamo.app sa phone at sa laptop.
- Mag-login (email at Google), subukan ang scanner (payagan ang camera).
- **Install bilang app**: Chrome/Edge > menu > **Install TindaMo** (o **Add to Home Screen** sa phone).
- Subukan ang offline: buksan nang isang beses online, patayin ang internet, buksan ulit.

**Mahalaga**: ang data na naka-save sa browser ay nakabase sa address. Ang bagong `tindamo.app` ay magsisimula nang walang laman. Mag-login sa parehong account para makuha ang data mula sa cloud, o gamitin ang Sync.

---

## Paano mag-update ng website pagkatapos
1. Palitan ang mga file at ang version (tingnan ang **VERSION.md** > "Paglabas ng bagong version").
2. I-push sa `main`. Sa loob ng 1 hanggang 2 minuto, live na.
3. Ang mga gumagamit ay makakakita ng **"May bagong version!"** at pipindutin lang ang **I-update**.

## Kung may problema
- **"DNS check unsuccessful"**: hindi pa tama o hindi pa nakakalat ang DNS. Tingnan ang Hakbang 5 at hintayin. Siguraduhing wala nang lumang A record ng parking page.
- **404 sa https://tindamo.app**: wala sa pinakaunang antas ng repo ang `index.html` (nasa loob ng subfolder). Ilipat sa root.
- **Nawala ang custom domain sa Settings**: nabura ang file na `CNAME` sa repo. Ibalik ito (laman: `tindamo.app`).
- **Naka-grey ang "Enforce HTTPS"**: hintayin ang certificate; kung higit sa 24 oras, tanggalin at ilagay ulit ang domain sa Custom domain.
- **"Continue with Google" ay may error**: ulitin ang Hakbang 8 (Authorized JavaScript origins), tapos subukan ulit pagkatapos ng ilang minuto.
- **Luma pa rin ang itsura pagkatapos mag-update**: pindutin ang **I-update** sa app, o Ctrl + Shift + R.
- **Gusto mo ng ibang hosting**: gumagana rin ang Cloudflare Pages o Netlify; i-upload lang ang parehong folder at ilagay ang domain sa settings nila.
