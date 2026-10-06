import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {createRouter,readRoute,routePath,trackPath,watchPath,contentId,resolveTrackKey} from '../dist/router.js';

class Events {
  listeners = new Map();
  addEventListener(type, callback, options = {}) {
    const entries = this.listeners.get(type) || [];
    entries.push({callback, once: !!options.once}); this.listeners.set(type, entries);
  }
  removeEventListener(type, callback) {
    this.listeners.set(type, (this.listeners.get(type) || []).filter(entry => entry.callback !== callback));
  }
  dispatchEvent(event) {
    for (const entry of [...(this.listeners.get(event.type) || [])]) {
      entry.callback(event);
      if (entry.once) this.removeEventListener(event.type, entry.callback);
    }
  }
}
function navigation(initial) {
  const win = new Events(), doc = new Events(), history = [new URL(initial)], state = {existing: 'state'};
  let position = 0, renders = 0;
  win.location = history[0];
  win.history = {
    state,
    replaceState(value, unused, path) {
      assert.equal(value, state); history[position] = new URL(path, win.location); win.location = history[position];
    },
    pushState(value, unused, path) {
      assert.equal(value, state); history.splice(position + 1); history.push(new URL(path, win.location));
      win.location = history[++position];
    },
    back() { if (position) {win.location = history[--position]; win.dispatchEvent({type: 'popstate'});} },
    forward() { if (position < history.length - 1) {win.location = history[++position]; win.dispatchEvent({type: 'popstate'});} }
  };
  const router = createRouter({window: win, document: doc, onChange: () => renders++});
  const click = (href, options = {}) => {
    const {download = false, target = '', ...eventOptions} = options;
    const anchor = {target, getAttribute: () => href, hasAttribute: name => name === 'download' && download};
    const event = {type: 'click', target: {closest: () => anchor}, button: 0, defaultPrevented: false,
      preventDefault() {this.defaultPrevented = true;}, ...eventOptions};
    doc.dispatchEvent(event); return event.defaultPrevented;
  };
  return {win, doc, router, click, renders: () => renders};
}

const tracks = [{id: 'remember', title: 'Remember'}, {id: '87f91ab4-9789-498f-810b-cf6035aa2efa', title: 'GÓDS (Nightcore Remix)'}];
assert.equal(trackPath(tracks[0]), '/track/remember');
const shared = trackPath(tracks[1]);
assert.equal(shared, '/track/gods-nightcore-remix--87f91ab4-9789-498f-810b-cf6035aa2efa');
assert.equal(resolveTrackKey(shared.split('/').at(-1), [{...tracks[1], title: 'Novo título'}]).id, tracks[1].id);
assert.equal(resolveTrackKey('gods-nightcore-remix', tracks), tracks[1]);
assert.equal(resolveTrackKey('remember', [...tracks, {id:'other', title:'Remember'}]), tracks[0]);
assert.equal(resolveTrackKey('same', [{id:'one',title:'Same'},{id:'two',title:'Same'}]), undefined);
assert.equal(contentId(trackPath({id:'item--version',title:'Título'}).split('/').at(-1)), 'item--version');
assert.equal(watchPath({id:tracks[1].id,title:'Meu vídeo'}), '/watch/meu-video--' + tracks[1].id);
assert.equal(routePath('perfil', 'A+B'), '/perfil/A%2BB');
for (const path of ['/track', '/watch/', '/canal', '/track/a/b', '/perfil/a%2Fb', '/track/%00', '/track/%ZZ', '/inicio/unexpected', '/missing']) {
  assert.equal(readRoute(new URL(path, 'https://site.test')).name, 'not-found', path);
}
assert.deepEqual(readRoute(new URL('/perfil', 'https://site.test')), {name:'perfil',argument:'',legacy:false});

const nav = navigation('https://site.test/?mode=signIn&oobCode=keep-me#faixa/remember');
nav.router.start(); nav.router.start();
assert.equal(nav.win.location.href, 'https://site.test/track/remember?mode=signIn&oobCode=keep-me');
assert.equal(nav.renders(), 0);
assert.equal(nav.click('/musicas'), true); assert.equal(nav.renders(), 1);
assert.equal(nav.click('/track/remember'), true);
nav.win.history.back(); assert.equal(nav.router.current().name, 'musicas');
nav.win.history.forward(); assert.equal(nav.router.current().argument, 'remember');
assert.equal(nav.renders(), 4);
nav.router.canonicalize('/track/remember'); assert.equal(nav.renders(), 4);
nav.router.navigate('perfil', 'owner', {replace:true}); assert.equal(nav.win.location.pathname, '/perfil/owner');
nav.win.history.back(); assert.equal(nav.win.location.pathname, '/musicas');
const before = nav.win.location.href, rendersBefore = nav.renders();
for (const [href, options] of [
  ['/videos',{ctrlKey:true}], ['/videos',{metaKey:true}], ['/videos',{shiftKey:true}],
  ['/videos',{altKey:true}], ['/videos',{button:1}], ['/videos',{target:'_blank'}],
  ['/assets/remember.mp3',{download:true}], ['/videos',{defaultPrevented:true}],
  ['https://other.test/inicio',{}], ['#main-content',{}], ['/auth-callback?code=keep',{}],
  ['/assets/missing.js',{}], ['mailto:creator@example.test',{}]
]) {
  const intercepted = nav.click(href, options);
  assert.equal(intercepted, !!options.defaultPrevented, href + JSON.stringify(options));
  assert.equal(nav.win.location.href, before);
}
assert.equal(nav.renders(), rendersBefore);
assert.equal(nav.click('#perfil/old-user'), true); assert.equal(nav.win.location.pathname, '/perfil/old-user');
nav.router.destroy(); assert.equal(nav.click('/inicio'), false); assert.equal(nav.win.location.pathname, '/perfil/old-user');
const callback = navigation('https://site.test/?apiKey=public&mode=verifyEmail#auth-callback');
callback.router.start(); assert.equal(callback.win.location.href, 'https://site.test/inicio?apiKey=public&mode=verifyEmail#auth-callback');
const legacy = navigation('https://site.test/'); legacy.router.start();
legacy.win.location = new URL('https://site.test/inicio#videos');
legacy.win.dispatchEvent({type:'hashchange'}); assert.equal(legacy.win.location.pathname, '/videos');
assert.equal(legacy.win.location.hash, '');
const direct = navigation('https://site.test/track/remember/'); direct.router.start();
assert.equal(direct.win.location.pathname, '/track/remember'); assert.equal(direct.router.current().argument, 'remember');

function theme({saved = null, systemDark = false, reduced = false, blockedStorage = false} = {}) {
  const doc = new Events(), win = new Events(), button = new Events(), attrs = {}, classes = new Set(), timers = new Map();
  const root = {dataset:{},style:{},classList:{add:x=>classes.add(x),remove:x=>classes.delete(x)}};
  const meta = {setAttribute:(key,value)=>attrs[key]=value}, attributes = {}, changes = [];
  const media = new Events(); media.matches = systemDark;
  button.setAttribute = (key,value) => attributes[key] = value;
  doc.readyState = 'loading'; doc.documentElement = root;
  let mounted = false, stored = saved, nextTimer = 0;
  doc.querySelectorAll = () => mounted ? [button] : [];
  doc.querySelector = () => meta;
  doc.addEventListener('kyro:theme', event => changes.push(event.detail.theme));
  win.matchMedia = query => query.includes('color-scheme') ? media : {matches:reduced};
  vm.runInNewContext(readFileSync(new URL('../dist/theme.js', import.meta.url), 'utf8'), {
    document:doc,window:win,
    localStorage:{getItem(){if(blockedStorage)throw Error('Blocked');return stored;},setItem(key,value){if(blockedStorage)throw Error('Blocked');assert.equal(key,'kyroshix-theme');stored=value;}},
    CustomEvent:class {constructor(type, data){this.type=type;this.detail=data.detail;}},
    setTimeout(fn){timers.set(++nextTimer,fn);return nextTimer;},clearTimeout:id=>timers.delete(id)
  });
  return {root,classes,attributes,attrs,changes,button,stored:()=>stored,
    mount(){mounted=true;doc.readyState='interactive';doc.dispatchEvent({type:'DOMContentLoaded'});},
    click(){button.dispatchEvent({type:'click'});},
    system(value){media.matches=value;media.dispatchEvent({type:'change'});},
    storage(value){win.dispatchEvent({type:'storage',key:'kyroshix-theme',newValue:value});},
    finish(){for(const fn of timers.values())fn();timers.clear();}
  };
}
const automatic = theme({systemDark:true});
assert.equal(automatic.root.dataset.theme, 'dark'); assert.equal(automatic.root.style.colorScheme, 'dark');
automatic.mount(); assert.equal(automatic.attributes['aria-checked'], 'true');
automatic.system(false); assert.equal(automatic.root.dataset.theme, 'light');
automatic.click(); assert.equal(automatic.stored(), 'dark'); assert.equal(automatic.attributes['aria-checked'], 'true');
assert.equal(automatic.button.title, 'Ativar tema claro'); assert.equal(automatic.attrs.content, '#1d1d25');
assert(automatic.classes.has('theme-changing')); automatic.finish(); assert(!automatic.classes.has('theme-changing'));
automatic.system(false); assert.equal(automatic.root.dataset.theme, 'dark');
automatic.storage('light'); assert.equal(automatic.root.dataset.theme, 'light');
automatic.system(true); assert.equal(automatic.root.dataset.theme, 'light');
automatic.storage(null); assert.equal(automatic.root.dataset.theme, 'dark');
const persisted = theme({saved:'light',systemDark:true});
assert.equal(persisted.root.dataset.theme,'light'); persisted.mount(); persisted.click(); assert.equal(persisted.stored(),'dark');
assert.equal(theme({saved:persisted.stored(),systemDark:false}).root.dataset.theme,'dark');
const accessible = theme({saved:'invalid',reduced:true}); accessible.mount(); accessible.click();
assert.equal(accessible.root.dataset.theme,'dark'); assert(!accessible.classes.has('theme-changing'));
const privateMode = theme({blockedStorage:true}); privateMode.mount(); privateMode.click();
assert.equal(privateMode.root.dataset.theme,'dark'); privateMode.system(false); assert.equal(privateMode.root.dataset.theme,'dark');

console.log('PASS: deep links, stable IDs after title edits, legacy links, browser history, OAuth query preservation, native download/new-tab links; pre-paint theme, saved/system preferences, cross-tab changes, accessible switch and reduced motion.');
