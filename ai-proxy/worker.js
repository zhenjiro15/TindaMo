// TindaMo AI server (Cloudflare Worker). Tinatawag ng app (config.js > TINDAMO_AI.url).
// Nasa server lang ang API key. HINDI pa ito nasubukan sa totoong Cloudflare/Anthropic account; subukan muna bago i-release.
const SYSTEM = `Ikaw si TindaMo AI, magiliw na katulong ng mga may-ari ng sari-sari store sa Pilipinas na gumagamit ng TindaMo app.
Sumagot sa wika ng user (Tagalog/Taglish/English), maikli at malinaw, madaling intindihin.
Kaya mong tumulong sa: presyo at tubo (cost + margin, tantiya lang; sabihing tantiya at maaaring iba sa lugar nila), stock, utang ng suki, tips sa pagpapalago ng tindahan, paggamit ng TindaMo (Sell, Inventory, Utang, Benta, GCash, Cashier, Sync, Message), at pwede ring makipagkwentuhan o magkwento.
Kung may larawan, ilarawan at gamitin para sa tanong (hal. produkto, resibo, shelf). Kung may reply na sinipi, sagutin ito.
Huwag magkunwaring may live na presyo sa palengke. Huwag humingi ng password o PIN. Para sa problema sa account/VIP/bayad, ituro ang Message sa Admin.
Gumamit ng payak na text; **bold** at "- " na listahan lang kung kailangan.`;

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'Content-Type, Authorization', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const J = (o, s = 200) => new Response(JSON.stringify(o), { status: s, headers: { 'Content-Type': 'application/json', ...cors } });

async function verify(token, env) {
  if (!token) return null;
  const r = await fetch('https://identitytoolkit.googleapis.com/v1/accounts:lookup?key=' + env.FIREBASE_API_KEY, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ idToken: token }) });
  if (!r.ok) return null;
  const j = await r.json();
  return j.users && j.users[0] ? j.users[0].localId : null;
}

export default {
  async fetch(req, env) {
    if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: cors });
    if (req.method !== 'POST') return J({ error: 'POST lang' }, 405);
    const uid = await verify((req.headers.get('Authorization') || '').replace(/^Bearer /, ''), env);
    if (!uid && env.ALLOW_ANON !== '1') return J({ error: 'auth' }, 401);
    if (env.KV && uid) {                                   // limit bawat araw (opsyonal, KV binding)
      const k = 'rl:' + uid + ':' + new Date().toISOString().slice(0, 10), n = parseInt((await env.KV.get(k)) || '0', 10);
      if (n >= parseInt(env.DAILY_LIMIT || '60', 10)) return J({ error: 'limit' }, 429);
      await env.KV.put(k, String(n + 1), { expirationTtl: 172800 });
    }
    let b; try { b = await req.json(); } catch (e) { return J({ error: 'bad' }, 400); }
    let text = String(b.text || '').slice(0, 1000), transcript;
    if (b.audio && b.audio.b64) {                          // voice -> text (Workers AI Whisper; i-bind ang AI)
      if (!env.AI) return J({ error: 'no-stt' }, 501);
      const bin = Uint8Array.from(atob(b.audio.b64), c => c.charCodeAt(0));
      const w = await env.AI.run('@cf/openai/whisper', { audio: [...bin] });
      transcript = (w && w.text || '').trim(); text = transcript;
      if (!text) return J({ reply: 'Hindi ko narinig nang malinaw. Pakiulit po.', transcript: '' });
    }
    const ctx = 'Tindahan: ' + (b.store || '?') + '\nMga item (pangalan, presyo ₱, stock): ' + JSON.stringify((b.items || []).slice(0, 40)) + '\nWika ng app: ' + (b.lang || 'fil');
    const msgs = (b.hist || []).slice(-12).map(m => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: String(m.text || '').slice(0, 600) }));
    const q = b.reply && b.reply.text ? '[Sinasagot ang: "' + String(b.reply.text).slice(0, 300) + '"]\n' : '';
    const content = [];
    const m = b.img && /^data:(image\/(jpeg|png|webp));base64,(.+)$/.exec(b.img);
    if (m) content.push({ type: 'image', source: { type: 'base64', media_type: m[1], data: m[3] } });
    content.push({ type: 'text', text: q + (text || 'Ano ang nasa larawan? Paano ito makakatulong sa tindahan ko?') });
    const merged = []; for (const x of msgs.concat([{ role: 'user', content }])) { const l = merged[merged.length - 1]; if (l && l.role === x.role && typeof l.content === 'string' && typeof x.content === 'string') l.content += '\n' + x.content; else merged.push(x); }
    if (merged[0] && merged[0].role !== 'user') merged.shift();
    const r = await fetch('https://api.anthropic.com/v1/messages', { method: 'POST', headers: { 'content-type': 'application/json', 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
      body: JSON.stringify({ model: env.MODEL || 'claude-haiku-5-5', max_tokens: 700, system: SYSTEM + '\n\n' + ctx, messages: merged }) });
    if (!r.ok) return J({ error: 'upstream' }, 502);
    const j = await r.json();
    const reply = (j.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n').trim();
    return J({ reply, transcript });
  }
};
