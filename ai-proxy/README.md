# TindaMo AI server
1. `npm i -g wrangler` → `wrangler login`
2. Sa folder na ito: `wrangler secret put ANTHROPIC_API_KEY` (ilagay ang key mo; HUWAG sa app)
3. `wrangler deploy` → makukuha ang url (hal. https://tindamo-ai.xxx.workers.dev)
4. Ilagay ang url sa `js/config.js` > `TINDAMO_AI.url`, tapos `npm run android:apk`.
Voice ay dumadaan sa Workers AI Whisper (`[ai]` binding). Ang user ay kailangang naka-login sa online account (Firebase token ang beripikasyon).
Hindi pa ito nasubukan sa totoong account; subukan muna.
