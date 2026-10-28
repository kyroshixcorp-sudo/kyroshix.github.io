import { FILES, APP_ROUTES } from './patches.mjs';

// Worker da KYROSHIX Records Spatial WebUI.
// Tudo que exige segredo é validado AQUI, nunca no navegador. Sem os secrets
// configurados, os endpoints respondem {ok:false, reason:'not_configured'} —
// não simulam sucesso. Veja docs/webui-v2.md para a configuração.

const METRICS_KEY = 'kx:metrics:v1';
const PRESENCE_KEY = 'kx:presence:v1';
const CATALOG_KEY = 'kx:catalog:v1';
const VIDEOS_KEY = 'kx:videos:v1';
const CHAT_KEY = 'kx:chat:v1';
const PRESENCE_WINDOW_MS = 30000;
const CODE_TTL_MS = 10 * 60 * 1000;
const TOKEN_TTL_MS = 8 * 60 * 60 * 1000;
const PLAN_BY_PRICE = { pro: 'pro', studio: 'studio' };

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  }
});
const notConfigured = detail => json({ ok: false, reason: 'not_configured', detail });
const fail = (detail, status = 400) => json({ ok: false, reason: 'invalid', detail }, status);
const validEmail = email => typeof email === 'string' && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && email.length <= 160;
const validHttps = url => { try { const u = new URL(url); return u.protocol === 'https:' && !u.username && !u.password; } catch { return false; } };
const validMedia = url => typeof url === 'string' &&
  (validHttps(url) || /^\/assets\/[A-Za-z0-9._-]+$/.test(url));
const hasCover = t => t && (/^https?:\/\//.test(t.image || '') || /^https?:\/\//.test(t.cover || '') || /^art-/.test(t.cover || ''));

async function readJson(kv, key, fallback) {
  try {
    const value = await kv.get(key);
    const parsed = value ? JSON.parse(value) : null;
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch { return fallback; }
}

async function hashText(text) {
  const bytes = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest('SHA-256', bytes);
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function signHmac(secret, payload) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret),
    { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(payload));
  return [...new Uint8Array(signature)].map(b => b.toString(16).padStart(2, '0')).join('');
}

/* ------------------------------------------------------------- métricas */
async function handleMetrics(request, env, pathname) {
  const kv = env.KX_METRICS;
  if (!kv) return json({ ok: false, reason: 'KV namespace KX_METRICS is not bound' });
  if (request.method !== 'GET' && request.method !== 'POST') return json({ ok: false, reason: 'Method not allowed' }, 405);
  let payload = {};
  if (request.method === 'POST') {
    try { payload = await request.json(); } catch { return json({ ok: false, reason: 'Invalid JSON' }, 400); }
  }
  const metrics = await readJson(kv, METRICS_KEY, { plays: { tracks: {}, total: 0 } });
  metrics.plays ||= { tracks: {}, total: 0 };
  metrics.plays.tracks ||= {};
  metrics.plays.total = Number(metrics.plays.total) || 0;
  const presence = await readJson(kv, PRESENCE_KEY, {});
  const now = Date.now();
  for (const id of Object.keys(presence)) if (now - (Number(presence[id]) || 0) > PRESENCE_WINDOW_MS) delete presence[id];

  if (request.method === 'POST' && pathname === '/api/metrics/play') {
    const track = String(payload.track || '').slice(0, 64);
    if (!/^[\w-]+$/.test(track)) return json({ ok: false, reason: 'Invalid track id' }, 400);
    metrics.plays.tracks[track] = (Number(metrics.plays.tracks[track]) || 0) + 1;
    metrics.plays.total += 1;
    await kv.put(METRICS_KEY, JSON.stringify(metrics));
  }
  if (request.method === 'POST' && pathname === '/api/metrics/presence') {
    const id = String(payload.id || '').slice(0, 80);
    if (!/^[\w-]+$/.test(id)) return json({ ok: false, reason: 'Invalid session id' }, 400);
    presence[id] = now;
    await kv.put(PRESENCE_KEY, JSON.stringify(presence));
  }
  return json({ ok: true, metrics: { listeners: Math.max(1, Object.keys(presence).length), plays: metrics.plays } });
}

/* ------------------------------------------------- códigos por e-mail */
async function sendEmail(env, to, subject, html) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return false;
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + env.RESEND_API_KEY, 'Content-Type': 'application/json' },
    body: JSON.stringify({ from: env.EMAIL_FROM, to: [to], subject, html })
  });
  return response.ok;
}
async function issueCode(env, kv, email, scope) {
  if (!env.RESEND_API_KEY || !env.EMAIL_FROM) return notConfigured('Defina RESEND_API_KEY e EMAIL_FROM (domínio verificado) no Worker.');
  // Amostragem por rejeição: evita o viés do módulo sobre 2^32.
  const range = 1000000, limit = Math.floor(4294967296 / range) * range;
  let value;
  do { value = crypto.getRandomValues(new Uint32Array(1))[0]; } while (value >= limit);
  const code = String(value % range).padStart(6, '0');
  const key = 'code:' + scope + ':' + await hashText(email);
  await kv.put(key, JSON.stringify({ code: await hashText(code + scope), at: Date.now() }), { expirationTtl: 600 });
  const sent = await sendEmail(env, email, 'Seu código de acesso KYROSHIX Records',
    `<div style="font-family:system-ui;background:#100e0d;color:#fff;padding:28px;border-radius:16px">
      <h1 style="color:#ff8a3d;font-size:20px">KYROSHIX Records</h1>
      <p>Seu código de acesso é:</p><p style="font-size:32px;letter-spacing:8px;font-weight:800">${code}</p>
      <p style="color:#aaa;font-size:12px">Válido por 10 minutos. Se não foi você, ignore este e-mail.</p></div>`);
  if (!sent) return fail('O provedor de e-mail recusou o envio. Verifique RESEND_API_KEY e EMAIL_FROM.', 502);
  return json({ ok: true });
}
async function consumeCode(kv, email, code, scope) {
  if (!/^\d{6}$/.test(String(code || ''))) return false;
  const key = 'code:' + scope + ':' + await hashText(email);
  const stored = await readJson(kv, key, null);
  if (!stored || Date.now() - (stored.at || 0) > CODE_TTL_MS) return false;
  if (stored.code !== await hashText(String(code) + scope)) return false;
  await kv.delete(key);
  return true;
}

async function handleAuth(request, env, pathname) {
  const kv = env.KX_DATA;
  if (!kv) return notConfigured('Vincule o namespace KV KX_DATA ao Worker.');
  if (request.method !== 'POST') return json({ ok: false, reason: 'Method not allowed' }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, reason: 'Invalid JSON' }, 400); }
  const email = String(body.email || '').trim().toLowerCase();
  if (!validEmail(email)) return fail('E-mail inválido.');
  if (pathname === '/api/auth/code') return issueCode(env, kv, email, 'auth');
  if (pathname === '/api/auth/verify') {
    if (!await consumeCode(kv, email, body.code, 'auth')) return fail('Código inválido ou expirado.');
    return json({ ok: true });
  }
  const adminEmail = String(env.ADMIN_EMAIL || 'kyroshixcorp@gmail.com').toLowerCase();
  if (email !== adminEmail) return fail('Apenas a conta do dono pode solicitar este código.', 403);
  if (pathname === '/api/admin/code') return issueCode(env, kv, email, 'admin');
  if (pathname === '/api/admin/verify') {
    if (!await consumeCode(kv, email, body.code, 'admin')) return fail('Código inválido ou expirado.');
    const token = [...crypto.getRandomValues(new Uint8Array(24))].map(b => b.toString(16).padStart(2, '0')).join('');
    await kv.put('admin:token:' + token, JSON.stringify({ email, at: Date.now() }), { expirationTtl: 8 * 3600 });
    return json({ ok: true, token, admin: true });
  }
  return json({ ok: false, reason: 'not found' }, 404);
}

async function verifyAdmin(kv, token) {
  if (!kv || typeof token !== 'string' || !/^[a-f0-9]{48}$/.test(token)) return false;
  const entry = await readJson(kv, 'admin:token:' + token, null);
  return !!entry && Date.now() - (entry.at || 0) < TOKEN_TTL_MS;
}

/* ------------------------------------------------------------- Stripe */
async function stripeRequest(env, path, params, method = 'POST') {
  const response = await fetch('https://api.stripe.com/v1/' + path, {
    method,
    headers: {
      Authorization: 'Bearer ' + env.STRIPE_SECRET_KEY,
      'Content-Type': 'application/x-www-form-urlencoded',
      'Idempotency-Key': crypto.randomUUID()
    },
    body: method === 'POST' ? new URLSearchParams(params).toString() : undefined
  });
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, data };
}
const priceFor = (env, planId) => planId === 'pro' ? env.STRIPE_PRICE_PRO : planId === 'studio' ? env.STRIPE_PRICE_STUDIO : '';

async function handleBilling(request, env, pathname) {
  if (pathname === '/api/billing/webhook') return handleStripeWebhook(request, env);
  const kv = env.KX_DATA;
  if (!env.STRIPE_SECRET_KEY || !kv) return notConfigured('Defina STRIPE_SECRET_KEY, STRIPE_PRICE_PRO, STRIPE_PRICE_STUDIO e vincule KX_DATA no Worker.');
  const url = new URL(request.url);
  if (pathname === '/api/billing/status' && request.method === 'GET') {
    const email = (url.searchParams.get('email') || '').toLowerCase();
    const sub = await readJson(kv, 'sub:' + await hashText(email), null);
    return json({ ok: true, plan: sub?.plan || 'free', active: !!sub });
  }
  if (request.method !== 'POST') return json({ ok: false, reason: 'Method not allowed' }, 405);
  let body;
  try { body = await request.json(); } catch { return json({ ok: false, reason: 'Invalid JSON' }, 400); }

  if (pathname === '/api/billing/checkout') {
    const planId = String(body.plan || '');
    const email = String(body.email || '').trim().toLowerCase();
    const price = priceFor(env, planId);
    if (!PLAN_BY_PRICE[planId] || !price) return fail('Plano inválido ou preço Stripe não configurado.');
    if (!validEmail(email)) return fail('Entre na sua conta para assinar.');
    const origin = url.origin;
    const params = {
      'mode': 'subscription',
      'line_items[0][price]': price,
      'line_items[0][quantity]': '1',
      'customer_email': email,
      'client_reference_id': await hashText(email),
      'success_url': origin + '/?session_id={CHECKOUT_SESSION_ID}',
      'cancel_url': origin + '/?billing=cancelled',
      'metadata[plan]': planId,
      'metadata[email]': email
    };
    const created = await stripeRequest(env, 'checkout/sessions', params);
    if (!created.ok || !created.data?.url) return fail(created.data?.error?.message || 'O Stripe recusou a criação do checkout.', 502);
    return json({ ok: true, url: created.data.url, id: created.data.id });
  }
  if (pathname === '/api/billing/confirm') {
    const sessionId = String(body.sessionId || '');
    if (!/^cs_[A-Za-z0-9_]+$/.test(sessionId)) return fail('Sessão inválida.');
    const result = await stripeRequest(env, 'checkout/sessions/' + encodeURIComponent(sessionId), {}, 'GET');
    if (!result.ok) return fail('Não foi possível confirmar a sessão.', 502);
    const session = result.data;
    if (session.payment_status !== 'paid' && session.status !== 'complete') return fail('Pagamento ainda não confirmado.');
    const email = String(session.customer_email || session.metadata?.email || '').toLowerCase();
    const planId = PLAN_BY_PRICE[session.metadata?.plan] || 'pro';
    if (!validEmail(email)) return fail('A sessão não contém um e-mail válido.');
    await kv.put('sub:' + await hashText(email), JSON.stringify({ plan: planId, email, sessionId, at: Date.now() }));
    return json({ ok: true, plan: planId });
  }
  return json({ ok: false, reason: 'not found' }, 404);
}

async function handleStripeWebhook(request, env) {
  const secret = env.STRIPE_WEBHOOK_SECRET, kv = env.KX_DATA;
  if (!secret || !kv) return notConfigured('Defina STRIPE_WEBHOOK_SECRET e vincule KX_DATA para receber webhooks.');
  if (request.method !== 'POST') return json({ ok: false, reason: 'Method not allowed' }, 405);
  const raw = await request.text();
  const header = request.headers.get('Stripe-Signature') || '';
  const parts = Object.fromEntries(header.split(',').map(p => p.split('=')).filter(p => p.length === 2));
  const timestamp = parts.t, signature = parts.v1;
  if (!timestamp || !signature || Math.abs(Date.now() / 1000 - Number(timestamp)) > 300)
    return fail('Assinatura do webhook ausente ou expirada.', 401);
  const expected = await signHmac(secret, timestamp + '.' + raw);
  if (expected !== signature) return fail('Assinatura do webhook inválida.', 401);
  let event;
  try { event = JSON.parse(raw); } catch { return fail('JSON inválido.', 400); }
  const object = event.data?.object || {};
  const email = String(object.customer_email || object.metadata?.email || '').toLowerCase();
  const planId = PLAN_BY_PRICE[object.metadata?.plan];
  if (validEmail(email) && (event.type === 'checkout.session.completed' || event.type === 'customer.subscription.updated')) {
    await kv.put('sub:' + await hashText(email), JSON.stringify({ plan: planId || 'pro', email, at: Date.now() }));
  }
  if (event.type === 'customer.subscription.deleted' && validEmail(email)) {
    await kv.put('sub:' + await hashText(email), JSON.stringify({ plan: 'free', email, at: Date.now() }));
  }
  return json({ ok: true, received: event.type });
}

/* -------------------------------------------------- catálogo, vídeos, chat */
async function handleData(request, env, pathname) {
  const kv = env.KX_DATA;
  const url = new URL(request.url);
  if (!kv) {
    if (request.method === 'GET' && (pathname === '/api/catalog' || pathname === '/api/videos' || pathname === '/api/chat'))
      return json({ ok: true, tracks: null, videos: [], messages: [], updatedAt: 0, local: true });
    return notConfigured('Vincule o namespace KV KX_DATA ao Worker para persistir dados entre dispositivos.');
  }
  if (pathname === '/api/catalog' && request.method === 'GET') {
    const stored = await readJson(kv, CATALOG_KEY, null);
    return json({ ok: true, tracks: stored?.tracks || null, updatedAt: stored?.updatedAt || 0 });
  }
  if (pathname === '/api/catalog' && request.method === 'POST') {
    let body; try { body = await request.json(); } catch { return fail('JSON inválido.'); }
    if (!await verifyAdmin(kv, body.token)) return fail('Sessão de administrador inválida.', 403);
    const list = body.tracks;
    if (!Array.isArray(list) || list.length > 200 || !list.every(hasCover)) return fail('Catálogo inválido: toda faixa precisa de capa.');
    const clean = list.slice(0, 200).map(t => ({
      id: String(t.id || '').slice(0, 64), title: String(t.title || '').slice(0, 120),
      artist: String(t.artist || '').slice(0, 160), description: String(t.description || '').slice(0, 300),
      image: String(t.image || t.cover || '').slice(0, 500), audio: String(t.audio || '').slice(0, 500),
      cover: 'art-custom', duration: Number(t.duration) || 180, tag: String(t.tag || '#Nightcore').slice(0, 40),
      note: String(t.note || 'KYROSHIX').slice(0, 80), color: String(t.color || '#ff8a3d').slice(0, 20),
      credits: String(t.credits || '').slice(0, 300), story: String(t.story || '').slice(0, 300)
    })).filter(t => t.id && t.title && t.image && validMedia(t.image) && validMedia(t.audio));
    if (!clean.length) return fail('Nenhuma faixa válida com capa https.');
    const updatedAt = Date.now();
    await kv.put(CATALOG_KEY, JSON.stringify({ tracks: clean, updatedAt }));
    return json({ ok: true, tracks: clean, updatedAt });
  }
  if (pathname === '/api/videos' && request.method === 'GET') {
    const stored = await readJson(kv, VIDEOS_KEY, { videos: [] });
    return json({ ok: true, videos: stored.videos || [] });
  }
  if (pathname === '/api/admin/videos' && request.method === 'POST') {
    let body; try { body = await request.json(); } catch { return fail('JSON inválido.'); }
    if (!await verifyAdmin(kv, body.token)) return fail('Sessão de administrador inválida.', 403);
    const videos = (Array.isArray(body.videos) ? body.videos : []).slice(0, 100)
      .map(v => ({ id: String(v.id || ''), title: String(v.title || '').slice(0, 120), description: String(v.description || '').slice(0, 200) }))
      .filter(v => /^[A-Za-z0-9_-]{11}$/.test(v.id));
    await kv.put(VIDEOS_KEY, JSON.stringify({ videos, updatedAt: Date.now() }));
    return json({ ok: true, videos });
  }
  if (pathname === '/api/profile') {
    let email = String(url.searchParams.get('email') || '').toLowerCase();
    let profileData = null;
    if (request.method === 'POST') {
      let body; try { body = await request.json(); } catch { return fail('JSON inválido.'); }
      email = String(body.email || '').toLowerCase();
      profileData = body.profile;
    }
    if (!validEmail(email)) return fail('E-mail inválido.');
    const key = 'profile:' + await hashText(email);
    if (request.method === 'GET') return json({ ok: true, profile: await readJson(kv, key, null) });
    if (!profileData || typeof profileData !== 'object') return fail('Perfil inválido.');
    const clean = {
      name: String(profileData.name || '').slice(0, 40), bio: String(profileData.bio || '').slice(0, 240),
      avatar: validMedia(String(profileData.avatar || '')) ? String(profileData.avatar) : '',
      accent: /^#[0-9a-fA-F]{6}$/.test(profileData.accent || '') ? profileData.accent : '#ff8a3d',
      theme: ['dark', 'darker', 'warm'].includes(profileData.theme) ? profileData.theme : 'dark'
    };
    await kv.put(key, JSON.stringify(clean));
    return json({ ok: true, profile: clean });
  }
  if (pathname === '/api/chat') {
    const stored = await readJson(kv, CHAT_KEY, { messages: [] });
    if (request.method === 'GET') return json({ ok: true, messages: stored.messages || [], serverTime: Date.now() });
    let body; try { body = await request.json(); } catch { return fail('JSON inválido.'); }
    const text = String(body.text || '').trim().slice(0, 1000);
    if (!text) return fail('Mensagem vazia.');
    const messages = [...(stored.messages || []), {
      id: crypto.randomUUID(), author: String(body.author || 'Visitante').slice(0, 60),
      text, room: String(body.room || 'geral').slice(0, 40), at: Date.now()
    }].slice(-200);
    await kv.put(CHAT_KEY, JSON.stringify({ messages }));
    return json({ ok: true, messages, serverTime: Date.now() });
  }
  return json({ ok: false, reason: 'not found' }, 404);
}
/* ------------------------------------------------------------------ fetch */
export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (pathname === '/api/metrics' || pathname === '/api/metrics/play' || pathname === '/api/metrics/presence')
      return handleMetrics(request, env, pathname);
    if (pathname.startsWith('/api/auth/') || (pathname.startsWith('/api/admin/') && pathname !== '/api/admin/videos'))
      return handleAuth(request, env, pathname);
    if (pathname.startsWith('/api/billing/')) return handleBilling(request, env, pathname);
    if (pathname.startsWith('/api/')) return handleData(request, env, pathname);

    const documentRoute = APP_ROUTES.some(route => route.endsWith('*')
      ? pathname.startsWith(route.slice(0, -1)) : pathname === route);
    const path = pathname === '/' || documentRoute ? '/index.html' : pathname;
    if (!Object.hasOwn(FILES, path)) return env.ASSETS.fetch(request);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { Allow: 'GET, HEAD' } });
    }
    const file = FILES[path];
    const headers = {
      'Content-Type': file.type,
      'Cache-Control': 'no-cache',
      ETag: file.etag,
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'strict-origin-when-cross-origin',
      'Cross-Origin-Opener-Policy': 'same-origin-allow-popups'
    };
    const tags = (request.headers.get('If-None-Match') || '')
      .split(',').map(tag => tag.trim().replace(/^W\//, ''));
    if (tags.includes('*') || tags.includes(file.etag)) return new Response(null, { status: 304, headers });
    headers['Content-Length'] = String(file.size);
    return new Response(request.method === 'HEAD' ? null : file.body, { headers });
  }
};
