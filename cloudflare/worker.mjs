import { FILES, APP_ROUTES } from './patches.mjs';

// Small text updates are served here. Existing images, audio and other assets
// stay in Cloudflare's asset store and continue to be served directly.
export default {
  async fetch(request, env) {
    const pathname = new URL(request.url).pathname;
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
