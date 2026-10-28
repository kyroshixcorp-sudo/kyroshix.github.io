import { FILES, APP_ROUTES } from './patches.mjs';

// Small text updates are served here. Existing images, audio and other assets
// stay in Cloudflare's asset store and continue to be served directly.
// /api/metrics is optional: with a KX_METRICS KV binding it aggregates real
// plays and active listeners across devices; without it the WebUI uses the
// counters measured locally in the browser.

const METRICS_KEY = 'kx:metrics:v1';
const PRESENCE_KEY = 'kx:presence:v1';
const PRESENCE_WINDOW_MS = 30000;

const json = (data, status = 200) => new Response(JSON.stringify(data), {
  status,
  headers: {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff'
  }
});

async function readJson(kv, key, fallback) {
  try {
    const value = await kv.get(key);
    const parsed = value ? JSON.parse(value) : null;
    return parsed && typeof parsed === 'object' ? parsed : fallback;
  } catch { return fallback; }
}

async function handleMetrics(request, env) {
  const kv = env.KX_METRICS;
  if (!kv) return json({ ok: false, reason: 'KV namespace KX_METRICS is not bound' });
  if (request.method !== 'GET' && request.method !== 'POST') {
    return json({ ok: false, reason: 'Method not allowed' }, 405);
  }

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
  for (const id of Object.keys(presence)) {
    if (now - (Number(presence[id]) || 0) > PRESENCE_WINDOW_MS) delete presence[id];
  }

  const pathname = new URL(request.url).pathname;
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

  return json({
    ok: true,
    metrics: {
      listeners: Math.max(1, Object.keys(presence).length),
      plays: metrics.plays
    }
  });
}

export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
    if (pathname === '/api/metrics' || pathname === '/api/metrics/play' || pathname === '/api/metrics/presence') {
      return handleMetrics(request, env);
    }
    const documentRoute = APP_ROUTES.some(route => route.endsWith('*')
      ? pathname.startsWith(route.slice(0, -1)) : pathname === route);
    const path = pathname === '/' || documentRoute ? '/index.html' : pathname;
    if (!Object.hasOwn(FILES, path)) return env.ASSETS.fetch(request);
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', {
        status: 405, headers: { Allow: 'GET, HEAD' }
      });
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
    if (tags.includes('*') || tags.includes(file.etag)) {
      return new Response(null, { status: 304, headers });
    }
    headers['Content-Length'] = String(file.size);
    return new Response(request.method === 'HEAD' ? null : file.body, { headers });
  }
};
