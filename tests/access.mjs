import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mountAuth } from '../dist/auth-controller.js';
import { createVisitGate, VISIT_KEY } from '../dist/access-policy.js';
import { createFirebaseClient } from '../dist/firebase-client.js';

// DOM boundary double: exercises production handlers, not a second account implementation.
class Element extends EventTarget {
  constructor(doc, tag = 'button', attrs = {}) {
    super(); this.doc = doc; this.tagName = tag; this.children = []; this.dataset = {};
    this.attributes = {}; this.value = ''; this.textContent = ''; this.className = '';
    this.hidden = false; this.disabled = false; this.required = false; this.open = false;
    for (const [name, value] of Object.entries(attrs)) this.setAttribute(name, value);
  }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name.startsWith('data-')) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, x) => x.toUpperCase())] = value;
    if (['id', 'type', 'pattern', 'placeholder'].includes(name)) this[name] = value;
    if (name === 'class') this.className = value;
    if (['hidden', 'disabled', 'required'].includes(name)) this[name] = true;
    if (name === 'minlength') this.minLength = Number(value);
  }
  getAttribute(name) { return this.attributes[name]; }
  append(...items) { for (const child of items) { child.parentElement = this; this.children.push(child); } }
  replaceChildren(...items) { this.children = []; this.append(...items); }
  matches(selector) {
    if (selector.startsWith('#')) return this.id === selector.slice(1);
    if (selector.startsWith('.')) return this.className.split(' ').includes(selector.slice(1));
    const match = selector.match(/^\[data-([a-z-]+)\]$/);
    return !!match && Object.hasOwn(this.dataset, match[1].replace(/-([a-z])/g, (_, x) => x.toUpperCase()));
  }
  all() { return [this, ...this.children.flatMap(child => child.all())]; }
  querySelector(selector) { return this.all().slice(1).find(child => child.matches(selector)) || null; }
  closest(selector) { return this.matches(selector) ? this : this.parentElement?.closest(selector) || null; }
  setCustomValidity(text) { this.validityMessage = text; }
  reportValidity() {
    return this.all().filter(child => child.tagName === 'input' && !child.disabled).every(input => {
      if (input.validityMessage || input.required && !input.value) return false;
      if (input.value && input.minLength && input.value.length < input.minLength) return false;
      if (input.value && input.pattern && !new RegExp('^(?:' + input.pattern + ')$').test(input.value)) return false;
      return input.type !== 'email' || !input.value || /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.value);
    });
  }
  focus() { this.doc.activeElement = this; }
  showModal() { assert(!this.open); this.open = true; this.shows = (this.shows || 0) + 1; }
  close() { this.open = false; this.dispatchEvent(new Event('close')); }
  click() {
    if (this.disabled) return;
    let target = this;
    while (target) {
      const result = target.onclick?.({ target: this, preventDefault() {} });
      if (target.onclick) return result;
      target = target.parentElement;
    }
  }
  submit() { return this.onsubmit?.({ preventDefault() {} }); }
}
class DetailEvent extends Event { constructor(type, init) { super(type); this.detail = init.detail; } }
const markup = readFileSync(new URL('../dist/index.html', import.meta.url), 'utf8');
function memoryStorage(initial = {}) {
  const entries = new Map(Object.entries(initial));
  return { getItem: key => entries.get(key) ?? null, setItem: (key, value) => entries.set(key, value), removeItem: key => entries.delete(key), entries };
}
function documentDouble({ storage = memoryStorage(), href = 'https://releases.kyroshixcorp.workers.dev/inicio' } = {}) {
  const doc = new EventTarget();
  doc.defaultView = { localStorage: storage, location: { href }, CustomEvent: DetailEvent };
  doc.elements = [];
  for (const match of markup.matchAll(/<(\w+)\s+([^>]*\bid="[^"]+"[^>]*)>/g)) {
    const attrs = {};
    for (const attr of match[2].matchAll(/([\w-]+)(?:="([^"]*)")?/g)) attrs[attr[1]] = attr[2] ?? '';
    doc.elements.push(new Element(doc, match[1], attrs));
  }
  doc.all = () => [...new Set(doc.elements.flatMap(element => element.all()))];
  doc.getElementById = id => doc.all().find(element => element.id === id);
  doc.querySelectorAll = selector => doc.all().filter(element => selector.split(',').some(part => element.matches(part)));
  doc.createElement = tag => new Element(doc, tag);
  doc.createElementNS = (_ns, tag) => new Element(doc, tag);
  for (const mode of ['login', 'signup']) {
    const button = new Element(doc, 'button', { 'data-auth-mode': mode });
    doc.getElementById('auth-tabs').append(button);
  }
  for (const [form, ids] of Object.entries({
    'auth-form': ['auth-name', 'auth-email', 'auth-password', 'auth-confirm'],
    'auth-code-form': ['auth-code'], 'auth-sms-form': ['auth-sms-code']
  })) for (const id of ids) doc.getElementById(form).append(doc.getElementById(id));
  doc.el = id => doc.getElementById(id);
  doc.method = id => doc.el('auth-providers').children.find(button => button.dataset.provider === id);
  doc.mode = id => doc.querySelectorAll('[data-auth-mode]').find(button => button.dataset.authMode === id);
  doc.published = [];
  doc.addEventListener('kyro:auth', event => doc.published.push(event.detail));
  return doc;
}
const account = { uid: 'verified-firebase-uid', displayName: 'KYROSHIX', email: 'listener@example.test', emailVerified: true };
function clientDouble(options = {}) {
  const calls = [], client = {
    providers: ['google.com'], calls, phoneEnabled: false, emailLinkEnabled: false,
    observe(callback) { client.observer = callback; return () => {}; },
    hasEmailLink() { return false; }, cancelSms() { calls.push(['cancelSms']); },
    async google() { calls.push(['google']); return { user: account }; },
    async oauth(id) { calls.push(['oauth', id]); return { user: account }; },
    async signup(...args) { calls.push(['signup', ...args]); return { user: account }; },
    async login(...args) { calls.push(['login', ...args]); return { user: account }; },
    async reset(email) { calls.push(['reset', email]); }, async logout() { calls.push(['logout']); },
    async linkProvider(id) { calls.push(['link', id]); },
    async sendSms(phone) { calls.push(['sms', phone]); },
    async confirmSms(code) { calls.push(['confirmSms', code]); return { user: { ...account, email: null, phoneNumber: '+5511999999999' } }; },
    ...options
  };
  return client;
}
function fixture(settings = {}, options = {}) {
  const doc = documentDouble(settings), ui = mountAuth(doc), client = clientDouble(options);
  ui.connect(client);
  return { doc, ui, client };
}

// Welcome waits for restoration; anonymous first visit is signup once per browser.
{
  const storage = memoryStorage(), { doc, client } = fixture({ storage });
  assert.equal(doc.el('account-dialog').open, false);
  await client.observer(null);
  assert.equal(doc.el('account-dialog').open, true);
  assert.equal(doc.mode('signup').getAttribute('aria-pressed'), 'true');
  assert.equal(doc.activeElement.id, 'auth-name');
  assert.equal(storage.getItem(VISIT_KEY), '1');
  doc.el('auth-guest-continue').click();
  await client.observer(null);
  assert.equal(doc.el('account-dialog').open, false);
  const returning = fixture({ storage }); await returning.client.observer(null);
  assert.equal(returning.doc.el('account-dialog').open, false);
  assert.equal(storage.entries.size, 1); // no IP, e-mail, phone or fingerprint is recorded.
}
{
  const { doc, client } = fixture(); await client.observer(account);
  assert.equal(doc.el('account-dialog').open, false);
  assert.equal(doc.el('account-uid').textContent, account.uid);
  assert.equal(doc.published.at(-1).uid, account.uid);
  doc.el('account-open').click(); await doc.el('auth-signout').click();
  assert.equal(doc.mode('login').getAttribute('aria-pressed'), 'true');
  doc.el('account-dialog').close(); await client.observer(null);
  assert.equal(doc.el('account-dialog').open, false);
}
{
  const blocked = { getItem() { throw Error('Blocked'); }, setItem() { throw Error('Blocked'); } };
  const { doc, client } = fixture({ storage: blocked }); await client.observer(null);
  doc.el('auth-guest-continue').click(); await client.observer(null);
  assert.equal(doc.el('account-dialog').shows, 1);
  const gate = createVisitGate(blocked, 'https://example.test/?mode=resetPassword&oobCode=code');
  assert.equal(gate.canWelcome(null, false, false), false);
}
// Connecting late or receiving an anonymous callback must not discard typed passwords.
{
  const doc = documentDouble(), ui = mountAuth(doc);
  doc.el('account-open').click(); doc.mode('signup').click();
  doc.el('auth-name').value = 'Ouvinte'; doc.el('auth-password').value = 'uma-frase-longa';
  const client = clientDouble(); ui.connect(client); await client.observer(null);
  assert.equal(doc.el('auth-password').value, 'uma-frase-longa');
  assert.equal(doc.el('auth-name').value, 'Ouvinte');
  assert.equal(doc.mode('signup').getAttribute('aria-pressed'), 'true');
}
{
  const storage = memoryStorage({ 'krs-email-link': 'listener@example.test' });
  const { doc, client } = fixture({ storage, href: 'https://example.test/inicio?mode=signIn&oobCode=valid' }, { hasEmailLink: () => true });
  await client.observer(null);
  assert.equal(doc.el('auth-email').value, 'listener@example.test');
  assert.equal(doc.el('auth-password-field').hidden, true);
  assert.equal(doc.el('auth-submit').textContent, 'Confirmar e-mail e entrar');
}
{
  const doc = documentDouble(), ui = mountAuth(doc); ui.unavailable('Tente novamente.');
  assert.equal(doc.el('account-dialog').open, true);
  assert.equal(doc.el('auth-submit').disabled, true);
  doc.el('auth-guest-continue').click(); assert.equal(doc.el('account-dialog').open, false);
}
// All requested alternatives are visible. Pending ones never invoke any identity SDK.
{
  const { doc, client } = fixture(); await client.observer(null);
  assert.deepEqual(doc.el('auth-providers').children.map(button => button.dataset.provider), ['google.com', 'facebook.com', 'github.com', 'phone', 'instagram', 'twitter.com']);
  for (const id of ['facebook.com', 'github.com', 'phone', 'instagram', 'twitter.com']) {
    await doc.method(id).click(); assert.equal(doc.method(id).getAttribute('aria-disabled'), 'true');
    assert.match(doc.el('auth-message').textContent, /não|ativado/);
  }
  assert(!client.calls.some(([type]) => ['google', 'oauth', 'sms'].includes(type)));
  await doc.method('google.com').click(); assert.equal(client.calls.filter(([type]) => type === 'google').length, 1);
}
{
  let resolve; const waiting = new Promise(r => { resolve = r; }); let requests = 0;
  const { doc, client } = fixture({}, { providers: ['google.com', 'facebook.com', 'github.com', 'twitter.com'], oauth(id) { requests++; assert.equal(id, 'github.com'); return waiting; } });
  await client.observer(null);
  const operation = doc.method('github.com').click();
  assert.equal(requests, 1); // popup starts in the same click, with no pre-await network call.
  assert.equal(doc.el('account-dialog').dataset.busy, 'true');
  await doc.method('github.com').click(); assert.equal(requests, 1);
  const cancel = new Event('cancel', { cancelable: true }); doc.el('account-dialog').dispatchEvent(cancel);
  assert.equal(cancel.defaultPrevented, true);
  resolve({ user: account }); await operation;
  assert.equal(doc.el('account-dialog').dataset.busy, 'false');
  const linked = doc.el('auth-link-providers').children.find(button => button.dataset.linkProvider === 'github.com');
  await linked.click(); assert.deepEqual(client.calls.at(-1), ['link', 'github.com']);
  assert.equal(doc.el('account-uid').textContent, account.uid);
}
// Password mismatch and short signup passwords are rejected before sending credentials.
{
  const { doc, client } = fixture(); await client.observer(null);
  doc.el('auth-name').value = '  Ouvinte  '; doc.el('auth-email').value = 'listener@example.test';
  doc.el('auth-password').value = '123456789012'; doc.el('auth-confirm').value = 'different';
  await doc.el('auth-form').submit(); assert(!client.calls.some(([type]) => type === 'signup'));
  doc.el('auth-confirm').dispatchEvent(new Event('input'));
  doc.el('auth-password').value = 'short'; doc.el('auth-confirm').value = 'short';
  await doc.el('auth-form').submit(); assert(!client.calls.some(([type]) => type === 'signup'));
  doc.el('auth-password').value = 'a unique long phrase'; doc.el('auth-confirm').value = 'a unique long phrase';
  await doc.el('auth-form').submit();
  assert.deepEqual(client.calls.find(([type]) => type === 'signup'), ['signup', 'listener@example.test', 'a unique long phrase', 'Ouvinte']);
  assert.equal(doc.el('auth-password').value, ''); assert.equal(doc.el('auth-confirm').value, '');
}
{
  const { doc, client } = fixture({}, { async login() { throw { code: 'auth/invalid-credential' }; }, async reset() { throw { code: 'auth/user-not-found' }; } });
  await client.observer(null); doc.mode('login').click(); doc.el('auth-email').value = 'listener@example.test'; doc.el('auth-password').value = 'secret';
  await doc.el('auth-form').submit(); assert.match(doc.el('auth-message').textContent, /E-mail ou senha incorretos/);
  assert.equal(doc.el('auth-submit').disabled, false);
  doc.el('auth-forgot').click(); await doc.el('auth-form').submit();
  assert.match(doc.el('auth-message').textContent, /Se existir uma conta/);
  assert.equal(doc.el('auth-message').dataset.error, 'false');
}
// SMS switching, code validation, cancellation and server-verified email step-up remain separate.
{
  const { doc, client } = fixture({}, { phoneEnabled: true }); await client.observer(null);
  doc.method('phone').click(); assert.equal(doc.el('auth-phone-panel').hidden, false);
  doc.el('auth-phone-number').value = '+55 (11) 99999-9999'; await doc.el('auth-phone-send').click();
  assert(client.calls.some(([type, value]) => type === 'sms' && value === '+5511999999999'));
  doc.el('auth-sms-code').value = '1'; await doc.el('auth-sms-form').submit();
  assert(!client.calls.some(([type]) => type === 'confirmSms'));
  doc.el('auth-sms-code').value = '123456'; await doc.el('auth-sms-form').submit();
  assert.equal(doc.el('profile-verified').textContent, 'Telefone confirmado');
  assert.equal(doc.el('account-uid').textContent, account.uid);
}
{
  let verified = false;
  const { doc, client } = fixture({}, {
    requiresCode: true, async codeStatus() { return { verified }; }, async sendCode() { return { challenge: 'one-use', destination: 'li••••@example.test' }; },
    async confirmCode(challenge, code) { assert.equal(challenge, 'one-use'); assert.equal(code, '123456'); verified = true; }
  });
  await client.observer(account); assert.equal(doc.published.at(-1), null);
  assert.equal(doc.el('auth-code-panel').hidden, false); assert.equal(doc.el('account-dialog').open, true);
  await doc.el('auth-code-send').click(); doc.el('auth-code').value = '123456'; await doc.el('auth-code-form').submit();
  assert.equal(doc.published.at(-1).uid, account.uid); assert.equal(doc.el('auth-code-panel').hidden, true);
  // A late code-status result from an old identity must not reauthenticate after logout.
  let resolve; const stale = new Promise(r => { resolve = r; }); client.codeStatus = () => stale;
  const restore = client.observer(account); await client.observer(null); resolve({ verified: true }); await restore;
  assert.equal(doc.published.at(-1), null);
}

// Exercise the real Firebase adapter against SDK-boundary doubles. No credentials/network used.
globalThis.location = { href: 'https://releases.kyroshixcorp.workers.dev/inicio', pathname: '/inicio', hash: '' };
globalThis.localStorage = { setItem() { throw Error('Private storage'); }, removeItem() { throw Error('Private storage'); } };
globalThis.history = { replaceState() {} };
const sdkCalls = [], auth = { currentUser: account };
class Provider { constructor(id) { this.id = id; this.scopes = []; } addScope(scope) { this.scopes.push(scope); } setCustomParameters(parameters) { this.parameters = parameters; } }
const sdk = {
  getAuth: () => auth, browserLocalPersistence: 'local', browserSessionPersistence: 'session', inMemoryPersistence: 'memory',
  async setPersistence(_auth, persistence) { sdkCalls.push(['persistence', persistence]); if (persistence !== 'memory') throw Error('Storage blocked'); },
  GoogleAuthProvider: class extends Provider { constructor() { super('google.com'); } },
  FacebookAuthProvider: class extends Provider { constructor() { super('facebook.com'); } },
  GithubAuthProvider: class extends Provider { constructor() { super('github.com'); } },
  TwitterAuthProvider: class extends Provider { constructor() { super('twitter.com'); } }, OAuthProvider: Provider,
  signInWithPopup(_auth, provider) { sdkCalls.push(['popup', provider]); return Promise.resolve({ user: account }); },
  linkWithPopup(user, provider) { sdkCalls.push(['link', user, provider]); return Promise.resolve({ user }); },
  RecaptchaVerifier: class { clear() { sdkCalls.push(['clear']); } },
  async signInWithPhoneNumber(_auth, phone) { sdkCalls.push(['sms', phone]); return { confirm(code) { sdkCalls.push(['sms-confirm', code]); return Promise.resolve({ user: account }); } }; },
  async sendSignInLinkToEmail(_auth, email) { sdkCalls.push(['email-link', email]); },
  async signOut() {},
};
const dependencies = { loadSdk: async () => [{ initializeApp: () => ({}) }, sdk] };
{
  const client = await createFirebaseClient({}, { providers: ['google.com', 'facebook.com', 'github.com', 'twitter.com', 'instagram.com', 'google.com'] }, dependencies);
  assert.deepEqual(client.providers, ['google.com', 'facebook.com', 'github.com', 'twitter.com']);
  assert.deepEqual(sdkCalls.slice(0, 3), [['persistence', 'local'], ['persistence', 'session'], ['persistence', 'memory']]);
  await client.google(); assert.deepEqual(sdkCalls.at(-1)[1].parameters, { prompt: 'select_account' });
  await client.oauth('github.com'); assert.deepEqual(sdkCalls.at(-1)[1].scopes, ['user:email']);
  await client.oauth('facebook.com'); assert.deepEqual(sdkCalls.at(-1)[1].scopes, ['email']);
  await client.oauth('twitter.com'); assert.equal(sdkCalls.at(-1)[1].id, 'twitter.com');
  await client.linkProvider('github.com'); assert.equal(sdkCalls.at(-1)[1].uid, account.uid);
  assert.throws(() => client.oauth('instagram.com'), { code: 'auth/operation-not-allowed' });
  await assert.rejects(client.sendSms('+5511999999999'), { code: 'auth/operation-not-allowed' });
  assert(!sdkCalls.some(([type]) => type === 'sms'));
  await assert.rejects(client.sendEmailLink('listener@example.test'), { code: 'auth/operation-not-allowed' });
}
{
  const client = await createFirebaseClient({}, { phoneEnabled: true, emailLinkEnabled: true }, dependencies);
  await assert.rejects(client.sendSms('not a phone')); assert(!sdkCalls.some(([type]) => type === 'sms'));
  await client.sendSms('+5511999999999');
  assert.throws(() => client.confirmSms('bad'), { code: 'auth/invalid-verification-code' });
  await client.confirmSms('123456'); assert.equal(sdkCalls.at(-1)[1], '123456');
  client.cancelSms(); assert.throws(() => client.confirmSms('123456'), /Solicite|^Error$/);
  assert(sdkCalls.some(([type]) => type === 'clear'));
  await client.sendEmailLink('listener@example.test'); assert.equal(sdkCalls.at(-1)[0], 'email-link');
}
console.log('PASS: first-visit signup, restored sessions, blocked storage, typed-form race, callbacks, pending-provider gates, synchronous OAuth dispatch, duplicate prevention, password/reset, UID linking, SMS validation/cancellation, stale step-up results and Firebase adapter scopes/persistence. Network authentication and browser layout were not exercised.');
