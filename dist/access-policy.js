// A local visit marker controls the welcome screen. It never grants account access.
export const VISIT_KEY = 'krs-access-seen-v1';

export function createVisitGate(storage, href) {
  let seen = false;
  try { seen = storage?.getItem(VISIT_KEY) === '1'; } catch {}
  let callback = false;
  try {
    const url = new URL(href);
    callback = url.searchParams.has('oobCode') || url.searchParams.has('mode');
  } catch {}
  return {
    canWelcome(user, manual, emailLink) { return !seen && !user && !manual && !callback && !emailLink; },
    remember() {
      seen = true;
      try { storage?.setItem(VISIT_KEY, '1'); } catch {}
    }
  };
}

export const ACCESS_METHODS = Object.freeze([
  { id: 'google.com', name: 'Google', icon: 'google' },
  { id: 'facebook.com', name: 'Facebook', icon: 'facebook' },
  { id: 'github.com', name: 'GitHub', icon: 'github' },
  { id: 'phone', name: 'Telefone · SMS', icon: 'phone' },
  { id: 'instagram', name: 'Instagram', icon: 'instagram' },
  { id: 'twitter.com', name: 'X / Twitter', icon: 'x' }
]);

export function methodAvailable(id, client) {
  if (!client || id === 'instagram') return false;
  if (id === 'phone') return client.phoneEnabled === true;
  return (client.providers || ['google.com']).includes(id);
}

export function methodNotice(id) {
  if (id === 'instagram') return 'O Instagram não está disponível para entrar neste site. Continue com Google ou e-mail.';
  if (id === 'phone') return 'O acesso por SMS ainda não foi ativado. Continue com Google ou e-mail.';
  return 'Este método ainda não foi ativado. Continue com Google ou e-mail.';
}

const names = { 'apple.com': 'Apple', 'microsoft.com': 'Microsoft', 'yahoo.com': 'Yahoo' };
export function methodName(id) {
  return ACCESS_METHODS.find(method => method.id === id)?.name || names[id] || 'Conta institucional';
}

// Only these trusted, static paths are used to draw provider icons.
const iconPaths = {
  google: [
    { fill: '#4285f4', d: 'M21.6 12.2c0-.7-.1-1.3-.2-2H12v3.9h5.4a4.6 4.6 0 0 1-2 3v2.5h3.2c1.9-1.8 3-4.3 3-7.4Z' },
    { fill: '#34a853', d: 'M12 22c2.7 0 5-.9 6.6-2.4l-3.2-2.5c-.9.6-2 .9-3.4.9-2.6 0-4.8-1.7-5.6-4H3.1v2.6A10 10 0 0 0 12 22Z' },
    { fill: '#fbbc05', d: 'M6.4 14a6 6 0 0 1 0-4V7.4H3.1a10 10 0 0 0 0 9.2L6.4 14Z' },
    { fill: '#ea4335', d: 'M12 6c1.5 0 2.8.5 3.8 1.5l2.8-2.8A9.5 9.5 0 0 0 12 2a10 10 0 0 0-8.9 5.4L6.4 10c.8-2.3 3-4 5.6-4Z' }
  ],
  facebook: [{ d: 'M14.2 22v-9h3l.5-3.5h-3.5V7.2c0-1 .3-1.7 1.8-1.7h1.9V2.3c-.3 0-1.5-.2-2.8-.2-2.8 0-4.8 1.7-4.8 4.9v2.5H7.1V13h3.2v9Z' }],
  github: [{ d: 'M12 2a10 10 0 0 0-3.2 19.5c.5.1.7-.2.7-.5v-1.9c-2.8.6-3.4-1.2-3.4-1.2-.5-1.2-1.1-1.5-1.1-1.5-.9-.6.1-.6.1-.6 1 .1 1.6 1 1.6 1 .9 1.5 2.3 1.1 2.8.8.1-.6.4-1.1.6-1.3-2.2-.3-4.6-1.1-4.6-5A4 4 0 0 1 6.6 8.5c-.1-.3-.5-1.3.1-2.7 0 0 .8-.3 2.8 1A9.4 9.4 0 0 1 12 6.5c.9 0 1.7.1 2.5.3 2-1.3 2.8-1 2.8-1 .6 1.4.2 2.4.1 2.7 1 1 1.2 2 1.2 2.8 0 3.9-2.4 4.7-4.6 5 .4.3.7.9.7 1.8V21c0 .3.2.6.7.5A10 10 0 0 0 12 2Z' }],
  phone: [{ fill: 'none', stroke: 'currentColor', d: 'M9 2h6a2 2 0 0 1 2 2v16a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2Zm-2 15h10M11 19.5h2' }],
  instagram: [{ fill: 'none', stroke: 'currentColor', d: 'M7 3h10a4 4 0 0 1 4 4v10a4 4 0 0 1-4 4H7a4 4 0 0 1-4-4V7a4 4 0 0 1 4-4Zm9 9a4 4 0 1 1-8 0 4 4 0 0 1 8 0Zm1.5-5.5h.01' }],
  x: [{ d: 'M18.9 2H22l-6.8 7.8L23.2 22h-6.3l-4.9-7.5L5.4 22H2.2l8.3-9.5L.8 2h6.5l4.4 6.8L18.9 2Zm-1.1 18h1.7L6.3 3.9H4.5L17.8 20Z' }],
  account: [{ fill: 'none', stroke: 'currentColor', d: 'M16 8a4 4 0 1 1-8 0 4 4 0 0 1 8 0ZM4 21v-2a8 8 0 0 1 16 0v2' }]
};

export function providerIcon(doc, name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = doc.createElementNS(ns, 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.setAttribute('class', 'access-provider-icon');
  for (const spec of iconPaths[name] || iconPaths.account) {
    const path = doc.createElementNS(ns, 'path');
    path.setAttribute('fill', 'currentColor');
    path.setAttribute('stroke-width', '1.8');
    path.setAttribute('stroke-linecap', 'round');
    path.setAttribute('stroke-linejoin', 'round');
    for (const [key, value] of Object.entries(spec)) path.setAttribute(key, value);
    svg.append(path);
  }
  return svg;
}
