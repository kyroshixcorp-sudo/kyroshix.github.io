// Public paths and the older hash links resolve to the same application views.
export const routeSegments = Object.freeze({
  inicio: 'inicio', musicas: 'musicas', recentes: 'recentes', favoritas: 'favoritas',
  studio: 'studio', perfil: 'perfil', faixa: 'track', videos: 'videos',
  assistir: 'watch', canal: 'canal', inscricoes: 'inscricoes', biblioteca: 'biblioteca'
});
const names = Object.fromEntries(Object.entries(routeSegments).map(([name, segment]) => [segment, name]));
const withArgument = new Set(['faixa', 'assistir', 'perfil', 'canal']);
const uuid = /^[0-9a-f]{8}-(?:[0-9a-f]{4}-){3}[0-9a-f]{12}$/i;

export function slugify(value) {
  return String(value || '').normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').slice(0, 48).replace(/^-+|-+$/g, '') || 'musica';
}
export function routePath(name, argument = '') {
  const segment = routeSegments[name];
  if (!segment) throw new Error('Unknown application route');
  return '/' + segment + (argument && withArgument.has(name) ? '/' + encodeURIComponent(argument) : '');
}
function mediaPath(name, item) {
  const id = String(item?.id || '');
  const readable = /^[a-z][a-z0-9-]{0,63}$/.test(id) && !id.includes('--') && !uuid.test(id);
  return routePath(name, readable ? id : slugify(item?.title) + '--' + id);
}
export const trackPath = item => mediaPath('faixa', item);
export const watchPath = item => mediaPath('assistir', item);
export function contentId(key) {
  const value = String(key || ''), marker = value.indexOf('--');
  return marker < 0 ? value : value.slice(marker + 2);
}
export function resolveTrackKey(key, tracks) {
  const exact = tracks.find(track => track.id === key || track.id === contentId(key));
  if (exact) return exact;
  const matches = tracks.filter(track => slugify(track.title) === key);
  return matches.length === 1 ? matches[0] : undefined;
}
export function readRoute(location) {
  const hash = String(location.hash || '').slice(1);
  const legacyName = hash.split('/')[0];
  const legacy = Object.hasOwn(routeSegments, legacyName);
  const parts = (legacy ? hash : String(location.pathname || '/').replace(/^\/+|\/+$/g, '')).split('/');
  const segment = parts[0];
  const name = legacy ? legacyName : !segment || segment === 'index.html' ? 'inicio' : names[segment] || (Object.hasOwn(routeSegments, segment) ? segment : 'not-found');
  let argument = '';
  try { argument = decodeURIComponent(parts[1] || ''); } catch { return {name: 'not-found', argument: '', legacy: false}; }
  if (parts.length > 2 || /[\/#?\\\u0000-\u001f\u007f]/.test(argument) ||
      (argument && !withArgument.has(name)) || (['faixa', 'assistir', 'canal'].includes(name) && !argument)) {
    return {name: 'not-found', argument: '', legacy: false};
  }
  return {name, argument, legacy};
}

export function createRouter({onChange, window: win = globalThis.window, document: doc = globalThis.document}) {
  let started = false;
  const current = () => readRoute(win.location);
  function canonicalize(path) {
    const parsed = current();
    const suffix = win.location.search + (parsed.legacy ? '' : win.location.hash);
    if (win.location.pathname !== path || parsed.legacy) win.history.replaceState(win.history.state, '', path + suffix);
  }
  function normalize() {
    const parsed = current();
    if (parsed.name !== 'not-found') canonicalize(routePath(parsed.name, parsed.argument));
  }
  function navigate(name, argument = '', {replace = false} = {}) {
    const path = routePath(name, argument);
    if (win.location.pathname === path && !win.location.hash && !win.location.search) return;
    win.history[replace ? 'replaceState' : 'pushState'](win.history.state, '', path);
    onChange();
  }
  function click(event) {
    if (event.defaultPrevented || (event.button != null && event.button !== 0) || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    const link = event.target.closest?.('a[href]');
    if (!link || link.hasAttribute('download') || (link.target && link.target !== '_self')) return;
    const url = new URL(link.getAttribute('href'), win.location.href);
    if (url.origin !== win.location.origin || url.search || (url.hash && !Object.hasOwn(routeSegments, url.hash.slice(1).split('/')[0]))) return;
    const destination = readRoute(url);
    if (destination.name === 'not-found') return;
    event.preventDefault();
    const path = url.hash ? routePath(destination.name, destination.argument) : url.pathname.replace(/\/$/, '') || '/inicio';
    if (win.location.pathname !== path || win.location.hash || win.location.search) win.history.pushState(win.history.state, '', path);
    onChange();
  }
  function pop() { normalize(); onChange(); }
  function hashChange() { if (current().legacy) pop(); }
  return {
    current, canonicalize, navigate,
    start() {
      if (started) return;
      started = true; normalize();
      doc.addEventListener('click', click);
      win.addEventListener('popstate', pop); win.addEventListener('hashchange', hashChange);
    },
    destroy() {
      started = false; doc.removeEventListener('click', click);
      win.removeEventListener('popstate', pop); win.removeEventListener('hashchange', hashChange);
    }
  };
}
