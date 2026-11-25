'use strict';
/* ============================================================
   ITO PARA SA ONLINE DATABASE (Firebase)   [config.js]
   Ilagay dito ang apiKey at projectId ng Firebase project mo.
   Hakbang-hakbang: tingnan ang SETUP-CLOUD.md
   Kapag walang laman, local lang ang app (gaya ng dati).
   ============================================================ */
window.TINDAMO_CLOUD={
  apiKey:'AIzaSyBMQ7_5_olkPtZiTpww8WUiJDhPJ_mPG04',                // Firebase → Project settings → Web API Key
  projectId:'tindamo-6fa91',          // Firebase → Project settings → Project ID
  googleClientId:'428740135584-uvd69505olvnborm0mk0ptiqfkf02fq2.apps.googleusercontent.com'   // (optional) Web client ID para sa Google sign-in
};

/* ============================================================
   TindaMo AI (Message > AI Tulong)
   url = ang address ng AI server mo (tingnan ang ai-proxy/README.md). Kapag walang laman, sasabihin ng app na
   "hindi pa available ang TindaMo AI". HUWAG ilagay dito ang API key; nasa server lang ito.
   ============================================================ */
window.TINDAMO_AI={
  url:''            // hal. 'https://tindamo-ai.<pangalan-mo>.workers.dev'
};
