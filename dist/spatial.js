/* KYROSHIX Records — Spatial WebUI
   Página independente: player, comentários, contas/planos, bastidores e métricas.
   Nenhum pagamento real é processado; todos os dados ficam no navegador, com
   agregação opcional via KV no Worker (/api/metrics). */
(() => {
  'use strict';

  /* ---------------------------------------------------------------- utils */
  const $ = (s, root = document) => root.querySelector(s);
  const $$ = (s, root = document) => [...root.querySelectorAll(s)];
  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (n, extra = '') => `<svg class="icon ${extra}" aria-hidden="true"><use href="#i-${n}"/></svg>`;
  const fmt = s => { const x = Math.max(0, Math.floor(Number(s) || 0)); return Math.floor(x / 60) + ':' + String(x % 60).padStart(2, '0'); };
  const num = n => new Intl.NumberFormat('pt-BR').format(Number(n) || 0);
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36));
  const relTime = ts => {
    const d = Date.now() - (Number(ts) || 0);
    if (d < 60000) return 'agora';
    if (d < 3600000) return Math.floor(d / 60000) + ' min';
    if (d < 86400000) return Math.floor(d / 3600000) + ' h';
    return Math.floor(d / 86400000) + ' d';
  };
  const read = (key, fallback) => { try { const v = JSON.parse(localStorage.getItem(key)); return v == null ? fallback : v; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* cota cheia */ } };
  const rand = seed => () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  let toastTimer;
  function toast(message) {
    const el = $('#toast');
    el.textContent = message; el.hidden = false;
    requestAnimationFrame(() => el.classList.add('show'));
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => {
      el.classList.remove('show');
      setTimeout(() => { el.hidden = true; }, 260);
    }, 2800);
  }
  function openDialog(dlg) { if (dlg && !dlg.open) dlg.showModal(); }
  function closeDialog(dlg) { if (dlg && dlg.open) dlg.close(); }

  /* ------------------------------------------------------- URLs seguras */
  // Nunca deixe um valor vindo de localStorage/KV virar esquema javascript:,
  // data:text/html ou quebrar a declaração CSS url().
  const cssSafe = u => String(u || '').replace(/["'()\\\s<>]/g, '');
  function safeMediaUrl(value) {
    const raw = String(value || '');
    if (/^\/assets\/[A-Za-z0-9._-]+$/.test(raw)) return raw;
    try {
      const u = new URL(raw, location.href);
      return u.protocol === 'https:' && !u.username && !u.password ? u.href : '';
    } catch { return ''; }
  }
  function safeImageUrl(value) {
    const raw = String(value || '');
    if (/^\/assets\/[A-Za-z0-9._-]+$/.test(raw)) return raw;
    if (/^data:image\/(png|jpe?g|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(raw)) return raw;
    try {
      const u = new URL(raw, location.href);
      return u.protocol === 'https:' && !u.username && !u.password ? u.href : '';
    } catch { return ''; }
  }

  /* -------------------------------------------------- configuração pública */
  const OWNER_EMAIL = 'kyroshixcorp@gmail.com';
  const DEFAULT_CONFIG = {
    ownerEmail: OWNER_EMAIL,
    billing: { provider: 'stripe', enabled: false, publishableKey: '' },
    auth: { google: false, emailCode: false },
    ads: { enabled: false, publisherId: '' },
    chat: { enabled: false },
    youtube: { videos: [] },
    realtime: { enabled: false, pollMs: 4000 }
  };
  let appConfig = DEFAULT_CONFIG;
  async function loadAppConfig() {
    try {
      const response = await fetch('/app-config.json', { cache: 'no-store' });
      if (response.ok) {
        const data = await response.json();
        appConfig = { ...DEFAULT_CONFIG, ...data,
          billing: { ...DEFAULT_CONFIG.billing, ...(data.billing || {}) },
          auth: { ...DEFAULT_CONFIG.auth, ...(data.auth || {}) },
          ads: { ...DEFAULT_CONFIG.ads, ...(data.ads || {}) },
          youtube: { ...DEFAULT_CONFIG.youtube, ...(data.youtube || {}) } };
      }
    } catch { /* usa os padrões seguros */ }
    window.KYROSHIX_ADS_CONFIG = appConfig.ads;
    try { await import('/ads.js'); } catch { /* AdSense é opcional */ }
    return appConfig;
  }
  async function api(path, payload, method) {
    const options = { method: method || (payload === undefined ? 'GET' : 'POST'), cache: 'no-store', credentials: 'same-origin' };
    if (payload !== undefined) {
      options.headers = { 'Content-Type': 'application/json' };
      options.body = JSON.stringify(payload);
    }
    try {
      const response = await fetch(path, options);
      const data = await response.json().catch(() => ({}));
      return { ...data, status: response.status };
    } catch {
      return { ok: false, reason: 'offline', detail: 'Não foi possível contactar o servidor.' };
    }
  }
  const configured = (result, feature) => result?.ok !== false || result?.reason !== 'not_configured'
    ? true : (toast(feature + ': configure os segredos no Worker.'), false);

  /* ---------------------------------------------------------------- dados */
  /* Só entram no catálogo faixas com cover art publicada. As duas referências
     visuais antigas (capas geradas em CSS) foram removidas a pedido do dono. */
  const DEFAULT_TRACKS = [
    { id: 'remember', initial: 'K', group: 'release', artist: 'Levianth & Axol feat. The Tech Thieves', title: 'Remember', who: 'KYROSHIX', action: 'publicou um remix', when: 'há 1 dia',
      tag: '#Nightcore', likes: 412, reposts: 64, duration: 171.936, audio: '/assets/remember.mp3', cover: 'art-remember', image: '/assets/hero.webp', seed: 41,
      avatar: 'linear-gradient(135deg,#f0a15c,#d23b5c)', note: 'KYROSHIX · Nightcore Remix', color: '#ff8a3d',
      description: 'O som que fica. Nightcore acelerado, vocais em evidência e a energia que abriu o catálogo.',
      credits: 'Obra original: Remember — Levianth & Axol feat. The Tech Thieves. Remix: KYROSHIX.',
      story: 'O som que fica. Nightcore acelerado, vocais em evidência e a energia que abriu o catálogo.' },
    { id: 'legends', initial: 'K', group: 'release', artist: 'Against The Current · League of Legends', title: 'Legends Never Die', who: 'KYROSHIX', action: 'publicou um remix', when: 'há 3 dias',
      tag: '#Nightcore', likes: 388, reposts: 51, duration: 207.744, audio: '/assets/legends.mp3', cover: 'art-legends', image: '/assets/covers.webp', seed: 53,
      avatar: 'linear-gradient(135deg,#a35bff,#ff6f91)', note: 'KYROSHIX · Nightcore Remix', color: '#ff6f91',
      description: 'A energia de Worlds em nova velocidade. Um hino que continua de pé depois do último refrão.',
      credits: 'Obra original: Legends Never Die — Worlds 2017, League of Legends feat. Against The Current. Remix: KYROSHIX.',
      story: 'A energia de Worlds em nova velocidade. Um hino que continua de pé depois do último refrão.' },
    { id: 'darkness', initial: 'K', group: 'release', artist: 'Lost Sky × She Is Jules', title: 'Darkness', who: 'KYROSHIX', action: 'publicou um remix', when: 'há 5 dias',
      tag: '#Synthwave', likes: 301, reposts: 43, duration: 200.616, audio: '/assets/darkness.mp3', cover: 'art-darkness', image: '/assets/covers.webp', seed: 67,
      avatar: 'linear-gradient(135deg,#4f7bff,#9b5cff)', note: 'KYROSHIX · Synthwave / Nightcore', color: '#6f8bff',
      description: 'Entre luzes de neon e noites de synthwave. A faixa que puxa o catálogo para o lado mais escuro.',
      credits: 'Obra original: Darkness — Lost Sky & She Is Jules. Remix: KYROSHIX.',
      story: 'Entre luzes de neon e noites de synthwave. A faixa que puxa o catálogo para o lado mais escuro.' },
    { id: 'blindfold', initial: 'K', group: 'release', artist: 'Warriyo feat. Laura Brehm', title: 'Blindfold', who: 'KYROSHIX', action: 'publicou um remix', when: 'há 1 semana',
      tag: '#Nightcore', likes: 276, reposts: 38, duration: 189.579, audio: '/assets/blindfold.mp3', cover: 'art-blindfold', image: '/assets/covers.webp', seed: 83,
      avatar: 'linear-gradient(135deg,#39c7c7,#4f6bff)', note: 'KYROSHIX · Nightcore Remix', color: '#57d6c4',
      description: 'Feche os olhos. Entre na frequência. Uma viagem noturna em forma de remix.',
      credits: 'Obra original: Blindfold — Warriyo feat. Laura Brehm. Remix: KYROSHIX.',
      story: 'Feche os olhos. Entre na frequência. Uma viagem noturna em forma de remix.' }
  ];
  const hasCover = t => t && typeof t === 'object' &&
    (/^art-/.test(t.cover || '') || /^https?:\/\/\S+/.test(t.cover || '') || /^https?:\/\/\S+/.test(t.image || '') || /^data:image\//.test(t.image || ''));
  let tracks = (() => {
    const saved = read('kx.catalog.v2', null);
    const list = Array.isArray(saved) ? saved.filter(hasCover) : DEFAULT_TRACKS.map(t => ({ ...t }));
    return list.length ? list : DEFAULT_TRACKS.map(t => ({ ...t }));
  })();
  const byId = id => tracks.find(t => t.id === id) || tracks[0];
  const saveCatalog = () => write('kx.catalog.v2', tracks);

  const statusDots = [
    { id: 'remember', ring: 'conic-gradient(#ff8a3d,#ffd06b,#ff8a3d)', face: 'radial-gradient(circle at 35% 30%,#ffe0b6,#d2533b)' },
    { id: 'legends', ring: 'conic-gradient(#a35bff,#ff6f91,#a35bff)', face: 'radial-gradient(circle at 35% 30%,#f3d7ff,#7830a8)' },
    { id: 'darkness', ring: 'conic-gradient(#4f7bff,#81e6ff,#4f7bff)', face: 'radial-gradient(circle at 35% 30%,#d9ecff,#3054b8)' },
    { id: 'blindfold', ring: 'conic-gradient(#39c7c7,#81e6ff,#39c7c7)', face: 'radial-gradient(circle at 35% 30%,#d7fffb,#2b9f9f)' }
  ];

  const PLANS = [
    { id: 'free', name: 'Free', price: 'R$ 0', period: 'para sempre', badge: '', features: ['Stream ilimitado', 'Comentários e curtidas', 'Fila e histórico'] },
    { id: 'pro', name: 'Pro', price: 'R$ 14,90', period: '/mês', badge: 'POPULAR', features: ['Tudo do Free', 'Download em MP3', 'Equalizador de 3 bandas', 'Alta qualidade', 'Sem anúncios'] },
    { id: 'studio', name: 'Studio', price: 'R$ 39,90', period: '/mês', badge: 'COMPLETO', features: ['Tudo do Pro', 'Presets de som', 'Velocidade de reprodução', 'Bastidores ilimitados', 'Selo de apoiador'] }
  ];
  const OWNER_PLAN = { id: 'owner', name: 'Owner', price: 'Premium', period: ' vitalício', badge: 'DONO' };
  const planById = id => PLANS.find(p => p.id === id) || (id === 'owner' ? OWNER_PLAN : PLANS[0]);
  const planName = id => planById(id).name;
  const BENEFITS = {
    download: ['pro', 'studio', 'owner'], eq: ['pro', 'studio', 'owner'], hq: ['pro', 'studio', 'owner'],
    noads: ['pro', 'studio', 'owner'], presets: ['studio', 'owner'], speed: ['pro', 'studio', 'owner'],
    supporter: ['studio', 'owner'], admin: ['owner']
  };

  const VIEWS = {
    home: { title: 'Sua música, do seu jeito.', note: 'Retome de onde parou, descubra algo novo e acompanhe sua audiência em tempo real.' },
    discover: { title: 'Descobrir', note: 'Histórias verticais, bastidores de cada faixa e curadoria por estilo.' },
    stream: { title: 'Stream', note: 'O fluxo completo do catálogo — toque em uma capa, título ou forma de onda para ouvir.' },
    library: { title: 'Sua biblioteca', note: 'Curtidas, playlists, álbuns, artistas seguidos e estações em um só lugar.' },
    planos: { title: 'Assinaturas', note: 'Escolha seu plano e pague com segurança pelo Stripe.' },
    videos: { title: 'Vídeos', note: 'Clipes oficiais via YouTube, reproduzidos sob consentimento.' },
    chat: { title: 'Conversas', note: 'Mensagens em tempo real entre ouvintes.' },
    perfil: { title: 'Meu perfil', note: 'Personalize nome, avatar, bio e aparência.' },
    admin: { title: 'Painel do dono', note: 'Edite o catálogo, as capas e as descrições em tempo real.' },
    likes: { title: 'Curtidas', note: 'Faixas que você marcou com coração.' },
    recent: { title: 'Recentes', note: 'Faixas que você ouviu nesta sessão.' },
    queue: { title: 'A seguir', note: 'A fila começa pela próxima faixa depois da atual.' },
    playlists: { title: 'Playlists', note: 'Coleções montadas a partir dos estilos do catálogo.' },
    albums: { title: 'Álbuns e lançamentos', note: 'Os lançamentos oficiais KYROSHIX Records.' },
    following: { title: 'Seguindo', note: 'Artistas e canais que você acompanha.' },
    stations: { title: 'Stations', note: 'Rádios contínuas a partir de uma faixa.' }
  };

  /* ------------------------------------------------------------- métricas */
  const METRICS_KEY = 'kx.metrics.v2';
  const PRESENCE_KEY = 'kx.presence.v2';
  const SESSION = uid();
  let metrics = read(METRICS_KEY, { plays: {}, likes: {}, reposts: {}, commentsPosted: 0 });
  if (!metrics || typeof metrics !== 'object') metrics = { plays: {}, likes: {}, reposts: {}, commentsPosted: 0 };
  metrics.plays ||= {}; metrics.likes ||= {}; metrics.reposts ||= {}; metrics.commentsPosted ||= 0;
  let presence = read(PRESENCE_KEY, {});
  let serverMetrics = null;

  function heartbeat() {
    presence[SESSION] = Date.now();
    for (const key of Object.keys(presence)) if (Date.now() - presence[key] > 30000) delete presence[key];
    write(PRESENCE_KEY, presence);
    syncServer('presence', { id: SESSION });
    renderInsights();
  }
  function listeners() {
    const now = Date.now();
    const ids = Object.keys(presence).filter(k => now - (presence[k] || 0) < 30000);
    return Math.max(1, ids.length); // esta aba é sempre uma sessão real
  }
  function totalPlays() { return Object.values(metrics.plays).reduce((a, b) => a + (Number(b) || 0), 0); }
  function playCount(trackId) {
    const remote = serverMetrics?.plays?.tracks?.[trackId];
    return Number(remote ?? metrics.plays[trackId] ?? 0) || 0;
  }
  function currentNumbers() {
    if (serverMetrics) return {
      listeners: serverMetrics.listeners != null ? (Number(serverMetrics.listeners) || 0) : listeners(),
      plays: serverMetrics.plays?.total != null ? (Number(serverMetrics.plays.total) || 0) : totalPlays(),
      comments: commentCount(), accounts: accounts().length, source: 'servidor'
    };
    return { listeners: listeners(), plays: totalPlays(), comments: commentCount(), accounts: accounts().length, source: 'navegador' };
  }
  function bumpPlay(trackId) {
    metrics.plays[trackId] = (Number(metrics.plays[trackId]) || 0) + 1;
    write(METRICS_KEY, metrics);
    syncServer('play', { track: trackId });
    renderInsights();
  }
  async function syncServer(kind, payload) {
    try {
      const options = kind === 'get'
        ? { cache: 'no-store' }
        : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload || {}) };
      const response = await fetch(kind === 'get' ? '/api/metrics' : '/api/metrics/' + kind, options);
      if (!response.ok) return;
      const data = await response.json();
      if (data && data.ok && data.metrics) { serverMetrics = data.metrics; renderInsights(); }
    } catch { /* Worker sem KV ou offline: usa métricas locais */ }
  }

  /* ------------------------------------------------------------- comentários */
  const COMMENTS_KEY = 'kx.comments.v2';
  // Sem exemplos inventados: os comentários começam vazios e só crescem com
  // mensagens reais de contas autenticadas.
  let comments = read(COMMENTS_KEY, null);
  if (!comments || typeof comments !== 'object' || Array.isArray(comments)) comments = {};
  for (const key of Object.keys(comments)) if (comments[key]?.demo) delete comments[key];
  const getComments = trackId => comments[trackId] || [];
  function commentCount() { return Object.values(comments).reduce((a, list) => a + (Array.isArray(list) ? list.length : 0), 0); }
  function saveComments() { write(COMMENTS_KEY, comments); metrics.commentsPosted = commentCount(); write(METRICS_KEY, metrics); }
  function addComment(trackId, text, replyTo = null) {
    const account = currentAccount();
    const clean = String(text || '').trim().slice(0, 600);
    if (!clean) return null;
    const entry = {
      id: uid(), author: account ? account.name : 'Visitante', initial: (account ? account.name : 'V').trim().charAt(0).toUpperCase(),
      text: clean, at: Date.now(), replyTo, demo: false, likes: 0, likedBy: [], owner: account?.id || null
    };
    (comments[trackId] ||= []).push(entry);
    saveComments();
    renderInsights();
    return entry;
  }
  function toggleCommentLike(trackId, commentId) {
    const item = getComments(trackId).find(c => c.id === commentId);
    if (!item) return;
    item.likedBy ||= [];
    const key = currentAccount()?.id || SESSION;
    const i = item.likedBy.indexOf(key);
    if (i >= 0) { item.likedBy.splice(i, 1); item.likes = Math.max(0, item.likes - 1); }
    else { item.likedBy.push(key); item.likes = (item.likes || 0) + 1; }
    saveComments();
  }
  function deleteComment(trackId, commentId) {
    const list = getComments(trackId);
    const item = list.find(c => c.id === commentId);
    if (!item) return false;
    const account = currentAccount();
    if (item.demo || !account || item.owner !== account.id) return false;
    // Remove também as respostas diretas: caso contrário ficam invisíveis no painel,
    // mas continuam inflando o contador real de comentários.
    comments[trackId] = list.filter(c => c.id !== commentId && c.replyTo !== commentId);
    saveComments();
    renderInsights();
    return true;
  }

  /* ------------------------------------------------------------- contas */
  const ACCOUNTS_KEY = 'kx.accounts.v2';
  const SESSION_KEY = 'kx.session.v2';
  const accounts = () => read(ACCOUNTS_KEY, []);
  const saveAccounts = list => write(ACCOUNTS_KEY, list);
  const session = () => read(SESSION_KEY, null);
  function currentAccount() {
    const s = session();
    return s ? accounts().find(a => a.id === s.id) || null : null;
  }
  const plan = () => currentAccount()?.plan || 'free';
  const can = key => (BENEFITS[key] || []).includes(plan());
  const isOwner = () => !!currentAccount() && currentAccount().email === OWNER_EMAIL && currentAccount().plan === 'owner';
  const profile = () => read('kx.profile.v2', { name: '', bio: '', avatar: '', accent: '#ff8a3d', theme: 'dark' });
  const saveProfile = data => write('kx.profile.v2', { ...profile(), ...data });

  const hex = bytes => [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  const fromHex = h => new Uint8Array((h.match(/../g) || []).map(x => parseInt(x, 16)));
  async function derive(password, saltHex) {
    try {
      if (!crypto.subtle) throw new Error('no subtle');
      const enc = new TextEncoder();
      const key = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveBits']);
      const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', salt: fromHex(saltHex), iterations: 120000, hash: 'SHA-256' }, key, 256);
      return hex(new Uint8Array(bits));
    } catch {
      // Fallback sem Web Crypto: hash determinístico simples (ainda sem senha em texto puro).
      let h = 2166136261;
      for (const ch of saltHex + ':' + password) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
      return (h >>> 0).toString(16) + (password.length * 31).toString(16);
    }
  }
  async function createAccount(name, email, password) {
    const salt = hex(crypto.getRandomValues ? crypto.getRandomValues(new Uint8Array(16)) : new Uint8Array(16).map(() => Math.floor(Math.random() * 256)));
    const hash = await derive(password, salt);
    const account = { id: uid(), name: name.trim(), email: email.trim().toLowerCase(), salt, hash, plan: 'free', planSince: null, createdAt: Date.now() };
    const list = accounts(); list.push(account); saveAccounts(list);
    write(SESSION_KEY, { id: account.id, at: Date.now() });
    return account;
  }
  async function loginAccount(email, password) {
    const account = accounts().find(a => a.email === email.trim().toLowerCase());
    if (!account) return null;
    const hash = await derive(password, account.salt);
    if (hash !== account.hash) return null;
    write(SESSION_KEY, { id: account.id, at: Date.now() });
    return account;
  }
  function logout() {
    localStorage.removeItem(SESSION_KEY);
    state.authMode = 'login'; state.pendingAction = null;
    renderAll(); renderAuth();
    toast('Você saiu da conta.');
  }
  function setPlan(id) {
    const account = currentAccount();
    if (!account) return false;
    const list = accounts();
    const target = list.find(a => a.id === account.id);
    if (!target) return false;
    target.plan = id;
    target.planSince = id === 'free' ? null : Date.now();
    saveAccounts(list);
    renderAll();
    return true;
  }

  /* ------------------------------------------------------------- estado */
  const audio = $('#audio');
  const asSet = v => new Set(Array.isArray(v) ? v : []);
  const asArray = v => Array.isArray(v) ? v : [];
  const state = {
    track: tracks[0], duration: tracks[0].duration, playing: false, countedPlay: false,
    view: 'home', tab: 'all', query: '', tag: '', nowTab: 'queue', behindIndex: 0,
    liked: asSet(read('kx.liked.v2', [])), reposted: asSet(read('kx.reposted.v2', [])),
    history: asArray(read('kx.history.v2', [])), shuffled: false, repeating: false,
    selectedPlan: 'pro', authMode: 'login', eq: { bass: 0, mid: 0, treble: 0 }, pendingAction: null,
    codeVerified: false, codePending: null, ownerToken: read('kx.owner.token', null),
    chatMessages: [], videos: [], catalogUpdatedAt: 0, billingNotice: '', adsReady: false
  };
  const persistSets = () => {
    write('kx.liked.v2', [...state.liked]); write('kx.reposted.v2', [...state.reposted]); write('kx.history.v2', state.history);
  };

  /* ------------------------------------------------------------- áudio / EQ */
  let audioCtx = null, bassNode = null, midNode = null, trebleNode = null;
  function initAudioGraph() {
    if (audioCtx) return true;
    try {
      const Ctx = window.AudioContext || window.webkitAudioContext;
      if (!Ctx) return false;
      audioCtx = new Ctx();
      const source = audioCtx.createMediaElementSource(audio);
      bassNode = audioCtx.createBiquadFilter(); bassNode.type = 'lowshelf'; bassNode.frequency.value = 180;
      midNode = audioCtx.createBiquadFilter(); midNode.type = 'peaking'; midNode.frequency.value = 1200; midNode.Q.value = .8;
      trebleNode = audioCtx.createBiquadFilter(); trebleNode.type = 'highshelf'; trebleNode.frequency.value = 4200;
      source.connect(bassNode); bassNode.connect(midNode); midNode.connect(trebleNode); trebleNode.connect(audioCtx.destination);
      applyEq();
      return true;
    } catch { return false; }
  }
  function applyEq() {
    if (!audioCtx) return;
    bassNode.gain.value = can('eq') ? state.eq.bass : 0;
    midNode.gain.value = can('eq') ? state.eq.mid : 0;
    trebleNode.gain.value = can('eq') ? state.eq.treble : 0;
  }

  /* ------------------------------------------------------------- ondas */
  function buildWave(el, track, count) {
    if (!el) return;
    const next = rand(track.seed);
    let html = '';
    for (let i = 0; i < count; i++) {
      const envelope = Math.sin((i / count) * Math.PI) * .72 + .28;
      const pulse = .72 + .34 * Math.abs(Math.sin(i * .22 + track.seed));
      const height = Math.min(100, 10 + (14 + next() * 76) * envelope * pulse);
      html += `<i style="height:${height.toFixed(1)}%"></i>`;
    }
    el.innerHTML = html;
  }
  function paintWave(el, ratio, duration = state.duration) {
    if (!el) return;
    const bars = el.children, pos = Math.min(1, Math.max(0, ratio));
    const cut = Math.round(pos * bars.length);
    for (let i = 0; i < bars.length; i++) bars[i].classList.toggle('p', i < cut);
    el.setAttribute('aria-valuenow', String(Math.round(pos * 100)));
    el.setAttribute('aria-valuetext', fmt(pos * duration) + ' de ' + fmt(duration));
  }
  function initWaves() {
    $$('.wave[data-wave]').forEach(el => {
      const track = byId(el.dataset.id);
      buildWave(el, track, 90);
      paintWave(el, el.dataset.id === state.track.id ? currentRatio() : 0, track.duration);
    });
    buildWave($('#mini-wave'), state.track, 110);
    buildWave($('#big-wave'), state.track, 110);
    updateProgress();
  }
  const currentRatio = () => state.duration ? Math.min(1, Math.max(0, (audio.currentTime || 0) / state.duration)) : 0;
  function updateProgress() {
    const ratio = currentRatio();
    paintWave($('#mini-wave'), ratio);
    paintWave($('#big-wave'), ratio);
    const active = $(`.wave[data-id="${state.track.id}"]`);
    if (active) paintWave(active, ratio, state.track.duration);
    $('#cur').textContent = fmt(audio.currentTime || 0);
    const nc = $('#now-cur'); if (nc) nc.textContent = fmt(audio.currentTime || 0);
    const nd = $('#now-dur'); if (nd) nd.textContent = fmt(state.duration);
  }
  let pendingSeek = null, seekAttempts = 0;
  function seekTo(ratio) {
    const position = Math.min(1, Math.max(0, ratio)) * state.duration;
    // Guarda sempre: durante um load() o Chromium aceita a atribuição mas
    // descarta o seek quando os metadados chegam. Só limpamos no evento seeked.
    pendingSeek = position; seekAttempts = 0;
    try { audio.currentTime = position; } catch { /* aplica no loadedmetadata */ }
    updateProgress();
  }
  const ratioFromEvent = (el, event) => (event.clientX - el.getBoundingClientRect().left) / el.getBoundingClientRect().width;

  /* ------------------------------------------------------------- player */
  function visibleTracks() {
    let list = tracks.slice();
    if (state.tab === 'releases') list = list.filter(t => t.group === 'release');
    if (state.view === 'likes') list = list.filter(t => state.liked.has(t.id));
    if (state.view === 'recent') list = list.filter(t => state.history.includes(t.id))
      .sort((a, b) => state.history.lastIndexOf(b.id) - state.history.lastIndexOf(a.id));
    if (state.view === 'queue') {
      const i = list.findIndex(t => t.id === state.track.id);
      if (i >= 0) list = list.slice(i + 1).concat(list.slice(0, i + 1));
    }
    if (state.tag) list = list.filter(t => t.tag.toLowerCase() === state.tag.toLowerCase());
    if (state.query) {
      const q = state.query.toLowerCase();
      list = list.filter(t => `${t.title} ${t.artist} ${t.tag} ${t.who} ${t.note}`.toLowerCase().includes(q));
    }
    return list;
  }
  function loadTrack(track, autoplay = true) {
    if (!track) return;
    pendingSeek = null; seekAttempts = 0; // um seek da faixa anterior não deve vazar para esta
    state.track = track; state.duration = track.duration; state.countedPlay = false;
    state.history = [track.id, ...state.history.filter(id => id !== track.id)].slice(0, 12);
    persistSets();
    audio.src = safeMediaUrl(track.audio) || '/assets/remember.mp3'; audio.load();
    renderAll();
    if (autoplay) play(); else { state.playing = false; updatePlayButton(); }
  }
  function play() {
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
    const attempt = audio.play();
    if (attempt && typeof attempt.then === 'function') {
      attempt.then(() => { state.playing = true; updatePlayButton(); })
        .catch(() => toast('Não foi possível iniciar o áudio. Toque em reproduzir novamente.'));
    }
  }
  function pause() { audio.pause(); state.playing = false; updatePlayButton(); }
  function togglePlay() { state.playing ? pause() : play(); }
  function step(direction, autoplay = state.playing) {
    let list = visibleTracks();
    if (!list.length) list = tracks;
    let index = list.findIndex(t => t.id === state.track.id);
    if (index < 0) index = 0;
    let next;
    if (state.shuffled && list.length > 1) {
      const rest = list.filter(t => t.id !== state.track.id);
      next = rest[Math.floor(Math.random() * rest.length)];
    } else next = list[(index + direction + list.length) % list.length];
    loadTrack(next, autoplay);
  }
  function updatePlayButton() {
    const use = state.playing ? 'i-pause' : 'i-play';
    const pi = $('#play-icon'), ni = $('#now-play-icon');
    if (pi) pi.innerHTML = `<use href="#${use}"/>`;
    if (ni) ni.innerHTML = `<use href="#${use}"/>`;
    $('#play').setAttribute('aria-label', state.playing ? 'Pausar' : 'Reproduzir');
    const np = $('#now-play'); if (np) np.setAttribute('aria-label', state.playing ? 'Pausar' : 'Reproduzir');
    document.body.classList.toggle('is-playing', state.playing);
  }
  async function shareTrack(track) {
    const url = new URL(location.href); url.hash = 'track-' + track.id;
    const text = `${track.artist} — ${track.title} · KYROSHIX Records`;
    try {
      if (navigator.share) await navigator.share({ title: text, url: url.href });
      else { await navigator.clipboard.writeText(url.href); toast('Link copiado para a área de transferência.'); }
    } catch { /* cancelado */ }
  }
  function downloadTrack(track) {
    if (!can('download')) { openPlans(); toast('Downloads disponíveis nos planos Pro e Studio.'); return; }
    const href = safeMediaUrl(track.audio);
    if (!href) { toast('Endereço de áudio inválido.'); return; }
    const a = document.createElement('a'); a.href = href; a.download = track.title.replace(/[^\w\s-]/g, '') + '.mp3';
    document.body.appendChild(a); a.click(); a.remove();
    toast('Download iniciado.');
  }

  /* ------------------------------------------------------------- capas */
  function artInner(track) {
    const custom = safeImageUrl(track.image || (/^https?:|^data:image\//.test(track.cover || '') ? track.cover : ''));
    if (custom) return `<span class="art art-custom" style="background-image:url(&quot;${esc(cssSafe(custom))}&quot;)"></span><span class="art-shade"></span><span class="photo-caption">KYROSHIX</span>`;
    return `<span class="art ${esc(track.cover || 'art-remember')}"></span><span class="art-shade"></span><span class="photo-caption">KYROSHIX</span>`;
  }
  function avatarHTML(track, extra = '') {
    return `<span class="avatar ${extra}" style="--face:${track.avatar}">${esc(track.initial)}</span>`;
  }

  /* ------------------------------------------------------------- comentários UI */
  function commentHTML(track, c, isReply = false) {
    const replies = isReply ? [] : getComments(track.id).filter(r => r.replyTo === c.id);
    const liked = (c.likedBy || []).includes(currentAccount()?.id || SESSION);
    const mine = !c.demo && currentAccount() && c.owner === currentAccount().id;
    return `<div class="comment" data-comment="${c.id}">
      <span class="avatar" style="--face:linear-gradient(135deg,#5b6cff,#b06bff)">${esc(c.initial || '?')}</span>
      <div class="comment-body">
        <div class="comment-top"><b>${esc(c.author)}</b><time>${relTime(c.at)}</time></div>
        <p>${esc(c.text)}</p>
        <div class="comment-actions">
          <button type="button" data-action="comment-like" data-id="${track.id}" data-comment-id="${c.id}" class="${liked ? 'on' : ''}">${icon('heart')} ${c.likes || 0}</button>
          ${!isReply ? `<button type="button" data-action="comment-reply" data-comment-id="${c.id}">${icon('comment')} Responder</button>` : ''}
          ${mine ? `<button type="button" data-action="comment-delete" data-id="${track.id}" data-comment-id="${c.id}">${icon('trash')} Excluir</button>` : ''}
        </div>
        <form class="reply-form" data-reply-form="${c.id}" hidden>
          <textarea class="comment-form-textarea" rows="2" maxlength="600" placeholder="Responder ${esc(c.author)}…" aria-label="Resposta"></textarea>
          <div class="comment-form-row"><button class="btn btn-primary btn-sm" type="submit">Responder</button></div>
        </form>
        ${replies.length ? `<div class="replies">${replies.map(r => commentHTML(track, r, true)).join('')}</div>` : ''}
      </div>
    </div>`;
  }
  function commentsPanel(track) {
    const list = getComments(track.id);
    const roots = list.filter(c => !c.replyTo).sort((a, b) => b.at - a.at);
    return `<div class="comment-form">
        ${avatarHTML(track)}
        <div class="comment-form-body">
          <textarea id="new-comment" rows="2" maxlength="600" placeholder="O que você achou de ${esc(track.title)}?" aria-label="Novo comentário"></textarea>
          <div class="comment-form-row">
            <span>${currentAccount() ? 'Comentando como ' + esc(currentAccount().name) : 'Entre para comentar com seu nome'}</span>
            <button class="btn btn-primary btn-sm" type="button" data-action="comment-submit" data-id="${track.id}">${icon('send')} Comentar</button>
          </div>
        </div>
      </div>
      <div id="comment-list">${roots.length ? roots.map(c => commentHTML(track, c)).join('') : '<p class="field-hint">Nenhum comentário ainda. Entre na sua conta e seja o primeiro.</p>'}</div>`;
  }

  /* ------------------------------------------------------------- feed */
  function cardHTML(track) {
    const liked = state.liked.has(track.id), reposted = state.reposted.has(track.id);
    const likeCount = track.likes + (liked ? 1 : 0) + (metrics.likes[track.id] || 0);
    const repostCount = track.reposts + (reposted ? 1 : 0);
    const plays = playCount(track.id);
    const list = getComments(track.id);
    const last = [...list].sort((a, b) => b.at - a.at).slice(0, 2);
    return `<article class="track glass${track.id === state.track.id ? ' is-current' : ''}" data-id="${track.id}">
      <button class="cover" type="button" data-action="play-track" data-id="${track.id}" aria-label="Ouvir ${esc(track.title)}">${artInner(track)}<span class="cover-play">${icon('play', 'fill')}</span></button>
      <div class="t-info">
        <div class="frow">${avatarHTML(track)}<span class="who"><b>${esc(track.who)}</b> ${esc(track.action)}</span><time>${esc(track.when)}</time></div>
        <p class="t-artist">${esc(track.artist)}</p>
        <button class="t-title" type="button" data-action="play-track" data-id="${track.id}">${esc(track.title)}</button>
        <div class="wave" data-wave data-id="${track.id}" role="slider" tabindex="0" aria-label="Posição de ${esc(track.title)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"></div>
        <div class="t-meta">
          <button class="badge" type="button" data-action="filter-tag" data-tag="${esc(track.tag)}">${esc(track.tag)}</button>
          <button class="pill" type="button" data-action="like" data-id="${track.id}" aria-pressed="${liked}" aria-label="Curtir ${esc(track.title)}">${icon('heart')}<span class="lv">${num(likeCount)}</span></button>
          ${repostCount ? `<button class="pill" type="button" data-action="repost" data-id="${track.id}" aria-pressed="${reposted}" aria-label="Repostar">${icon('repost')}<span class="lv">${num(repostCount)}</span></button>` : ''}
          <button class="pill" type="button" data-action="open-comments" data-id="${track.id}">${icon('comment')}<span class="lv">${list.length}</span></button>
          <button class="pill" type="button" data-action="open-behind" data-id="${track.id}">${icon('eye')} Bastidores</button>
          <div class="t-stats">
            <span title="Reproduções reais medidas"><span class="real-badge"></span>${num(plays)} plays</span>
            <span>${icon('comment')}${list.length}</span>
            <span>${fmt(track.duration)}</span>
          </div>
        </div>
        ${last.length ? `<div class="comment-preview">${last.map(c => `<div class="cp-line"><b>${esc(c.author)}</b> ${esc(c.text.slice(0, 96))}${c.text.length > 96 ? '…' : ''}</div>`).join('')}
          <button class="cp-more" type="button" data-action="open-comments" data-id="${track.id}">Ver todos os ${list.length} comentários →</button></div>` : ''}
      </div>
    </article>`;
  }
  function feedHTML() {
    const list = visibleTracks();
    const note = VIEWS[state.view]?.note || VIEWS.stream.note;
    return `<section class="panel glass">
      <div class="feed-head">
        <div class="tabs" role="tablist" aria-label="Tipo de faixa">
          <button class="tab ${state.tab === 'all' ? 'on' : ''}" type="button" role="tab" aria-selected="${state.tab === 'all'}" data-action="set-tab" data-tab="all">Todas as faixas</button>
          <button class="tab ${state.tab === 'releases' ? 'on' : ''}" type="button" role="tab" aria-selected="${state.tab === 'releases'}" data-action="set-tab" data-tab="releases">Lançamentos</button>
        </div>
        <span class="feed-count">${list.length} ${list.length === 1 ? 'faixa' : 'faixas'}</span>
      </div>
      <p class="feed-note">${esc(note)}${state.tag ? ` Filtro: <b>${esc(state.tag)}</b> <button class="link-btn" data-action="clear-tag">limpar</button>.` : ''}${state.query ? ` Busca: “${esc(state.query)}”.` : ''}</p>
      <div id="track-list">${list.map(cardHTML).join('')}</div>
      ${list.length ? '' : `<div class="empty"><h2>Nada por aqui ainda</h2><p>Curta uma faixa, ouça algo novo ou limpe os filtros para ver o catálogo completo.</p><button class="btn btn-ghost" type="button" data-action="reset-filters">Mostrar todas</button></div>`}
    </section>`;
  }
  function tilesHTML(list, title) {
    return `<section class="panel glass"><div class="section-title"><h2>${esc(title)}</h2><button class="more" type="button" data-action="set-view" data-view="stream">Ver tudo →</button></div>
      <div class="card-grid">${list.map(t => `<button class="tile" type="button" data-action="play-track" data-id="${t.id}">
        <div class="tile-art">${artInner(t)}</div><h3>${esc(t.title)}</h3><p>${esc(t.artist)}</p>
        <div class="tile-meta"><span>${num(playCount(t.id))} plays</span><span>${fmt(t.duration)}</span></div></button>`).join('')}</div></section>`;
  }
  function homeHTML() {
    const n = currentNumbers();
    const recent = state.history.length ? state.history.map(byId) : tracks.slice(0, 4);
    const hero = `<section class="hero glass">
      <p class="eyebrow">KYROSHIX RECORDS · SPATIAL WEBUI</p>
      <h1>Sua música, <em>flutuando</em> no espaço.</h1>
      <p>Vidro fosco, profundidade real e um player completo. Ouça, comente, acompanhe sua audiência e faça parte do catálogo.</p>
      <div class="hero-actions">
        <button class="btn btn-primary" type="button" data-action="play-track" data-id="${tracks[2].id}">${icon('play', 'fill')} Ouvir agora</button>
        <button class="btn btn-ghost" type="button" data-action="set-view" data-view="discover">${icon('compass')} Explorar bastidores</button>
        <button class="btn btn-dark" type="button" data-action="open-player" data-tab="sound">${icon('sliders')} Abrir player</button>
      </div>
      <div class="hero-stats">
        <div class="hero-stat"><strong><span class="live-dot"></span>${num(n.listeners)}</strong><span>ouvintes agora</span></div>
        <div class="hero-stat"><strong>${num(n.plays)}</strong><span>reproduções reais</span></div>
        <div class="hero-stat"><strong>${num(n.comments)}</strong><span>comentários</span></div>
        <div class="hero-stat"><strong>${tracks.length}</strong><span>faixas no catálogo</span></div>
      </div>
    </section>`;
    return hero + tilesHTML(recent, 'Get back to it') + tilesHTML(tracks.filter(t => t.group === 'release'), 'Feito para você') +
      `<section class="panel glass"><div class="section-title"><h2>Mais do que você curte</h2>${icon('spark')}</div>
        <div class="chips">${['#Nightcore', '#Synthwave'].map(tag => `<button class="chip ${state.tag === tag ? 'active' : ''}" type="button" data-action="filter-tag" data-tag="${esc(tag)}">${esc(tag)}</button>`).join('')}</div>
        <div style="margin-top:14px">${tilesHTML(tracks.slice(0, 4), 'No seu radar').replace(/^<section class="panel glass">|<\/section>$/g, '')}</div>
      </section>`;
  }
  function discoverHTML() {
    const tags = ['#Nightcore', '#Synthwave'];
    return `<section class="panel glass">
      <div class="panel-head"><div><p class="eyebrow">DESCOBRIR</p><h1>Bastidores de cada faixa.</h1><p>Toque em uma história para ouvir e comentar.</p></div></div>
      <div class="chips" style="margin-bottom:16px">${tags.map(tag => `<button class="chip ${state.tag === tag ? 'active' : ''}" type="button" data-action="filter-tag" data-tag="${esc(tag)}">${esc(tag)}</button>`).join('')}</div>
      <div class="story-grid">${tracks.filter(t => !state.tag || t.tag === state.tag).map((t, i) => `<button class="story" type="button" data-action="open-behind" data-id="${t.id}">
        <span class="story-bg" style="background-image:${storyBackground(t)}"></span>
        <span class="story-bars">${tracks.map((_, j) => `<i class="${j <= i ? 'on' : ''}"></i>`).join('')}</span>
        <span class="story-top">${avatarHTML(t)}<span>${esc(t.who)}</span></span>
        <span class="story-tap">Toque para ouvir</span>
        <span class="story-body"><span class="kicker">Behind the track</span><h3>${esc(t.title)}</h3><p>${esc(t.artist)}</p></span>
      </button>`).join('') || '<p class="field-hint">Nenhuma faixa com essa tag.</p>'}</div>
    </section>` + tilesHTML(tracks.slice(2), 'Lançamentos para descobrir');
  }
  function storyBackground(t) {
    const custom = safeImageUrl(t.image || (/^https?:|^data:image\//.test(t.cover || '') ? t.cover : ''));
    if (custom) return `url(&quot;${esc(cssSafe(custom))}&quot;)`;
    return t.cover === 'art-remember' ? "url('/assets/hero.webp')" : "url('/assets/covers.webp')";
  }
  function libraryHTML() {
    const liked = tracks.filter(t => state.liked.has(t.id));
    const recent = state.history.map(byId);
    const playlists = [
      { name: 'Nightcore Essentials', tag: '#Nightcore', ids: ['remember', 'legends', 'blindfold'] },
      { name: 'Neon Drive', tag: '#Synthwave', ids: ['darkness', 'blindfold'] },
      { name: 'KYROSHIX Completo', tag: '#Nightcore', ids: tracks.map(t => t.id) }
    ];
    return `<section class="panel glass"><div class="panel-head"><div><p class="eyebrow">BIBLIOTECA</p><h1>Tudo o que é seu.</h1><p>${esc(VIEWS.library.note)}</p></div></div>
      <div class="kpi-grid" style="grid-template-columns:repeat(4,1fr)">
        <div class="kpi"><div class="kpi-k">Curtidas</div><div class="kpi-v">${liked.length}</div></div>
        <div class="kpi"><div class="kpi-k">Ouvidas</div><div class="kpi-v">${state.history.length}</div></div>
        <div class="kpi"><div class="kpi-k">Comentários</div><div class="kpi-v">${commentCount()}</div></div>
        <div class="kpi"><div class="kpi-k">Plays reais</div><div class="kpi-v">${num(totalPlays())}</div></div>
      </div></section>
      ${tilesHTML(liked.length ? liked : tracks.slice(0, 3), 'Músicas curtidas')}
      ${tilesHTML(recent.length ? recent : tracks.slice(2, 5), 'Ouvidas recentemente')}
      <section class="panel glass"><div class="section-title"><h2>Playlists</h2>${icon('list')}</div><div class="card-grid">
        ${playlists.map(p => `<button class="tile" type="button" data-action="play-playlist" data-ids="${p.ids.join(',')}">
          <div class="tile-art" style="background:linear-gradient(140deg,${byId(p.ids[0]).color},rgba(0,0,0,.6))"><span class="art-shade"></span><span class="photo-caption">${p.ids.length} FAIXAS</span></div>
          <h3>${esc(p.name)}</h3><p>${esc(p.tag)}</p></button>`).join('')}
      </div></section>
      ${tilesHTML(tracks.filter(t => t.group === 'release'), 'Álbuns e lançamentos')}
      <section class="panel glass"><div class="section-title"><h2>Seguindo</h2>${icon('users')}</div>
        <div class="card-grid">${['KYROSHIX', 'Washed Out', 'Small Black', 'Mt. Si'].map(name => `<div class="tile" style="cursor:default"><div class="tile-art" style="background:linear-gradient(140deg,#4a3b6e,#1b1726)"></div><h3>${esc(name)}</h3><p>Artista</p></div>`).join('')}</div></section>`;
  }
  function renderStage() {
    const stage = $('#stage');
    if (state.query) { stage.innerHTML = feedHTML(); return; }
    switch (state.view) {
      case 'discover': stage.innerHTML = discoverHTML(); break;
      case 'library': stage.innerHTML = libraryHTML(); break;
      case 'planos': stage.innerHTML = planosHTML(); break;
      case 'videos': stage.innerHTML = videosHTML(); break;
      case 'chat': stage.innerHTML = chatHTML(); renderChatLog(); break;
      case 'perfil': stage.innerHTML = profileHTML(); break;
      case 'admin': stage.innerHTML = adminHTML(); break;
      case 'stream': case 'likes': case 'recent': case 'queue':
      case 'playlists': case 'albums': case 'following': case 'stations':
        stage.innerHTML = feedHTML(); break;
      default: stage.innerHTML = homeHTML();
    }
  }

  /* ------------------------------------------------------------- rail */
  const RAIL_MAIN = [
    { view: 'home', icon: 'home', label: 'Início' }, { view: 'discover', icon: 'compass', label: 'Descobrir' },
    { view: 'stream', icon: 'wave', label: 'Stream' }, { view: 'videos', icon: 'play', label: 'Vídeos' },
    { view: 'chat', icon: 'comment', label: 'Chat' }, { view: 'library', icon: 'library', label: 'Biblioteca' },
    { view: 'perfil', icon: 'user', label: 'Meu perfil' }, { view: 'planos', icon: 'crown', label: 'Assinaturas' }
  ];
  const RAIL_LIBRARY = [
    { view: 'likes', icon: 'heart', label: 'Curtidas' }, { view: 'recent', icon: 'clock', label: 'Recentes' },
    { view: 'queue', icon: 'list', label: 'A seguir' }, { view: 'playlists', icon: 'grid', label: 'Playlists' },
    { view: 'albums', icon: 'disc', label: 'Álbuns' }, { view: 'following', icon: 'users', label: 'Seguindo' },
    { view: 'stations', icon: 'headphones', label: 'Stations' }
  ];
  function renderRail() {
    $('#rail-main').innerHTML = RAIL_MAIN.map(i => `<button class="nav-item ${state.view === i.view ? 'active' : ''}" type="button" data-action="set-view" data-view="${i.view}">${icon(i.icon)}${i.label}</button>`).join('');
    $('#rail-library').innerHTML = RAIL_LIBRARY.map(i => `<button class="nav-item ${state.view === i.view ? 'active' : ''}" type="button" data-action="set-view" data-view="${i.view}">${icon(i.icon)}${i.label}${i.view === 'likes' ? `<span class="count">${state.liked.size}</span>` : ''}</button>`).join('');
    $('#status-dots').innerHTML = statusDots.map(d => {
      const t = byId(d.id);
      return `<button class="status-dot" type="button" data-action="play-track" data-id="${d.id}" style="--ring:${d.ring};--face:${d.face}" aria-label="Ouvir ${esc(t.title)}" title="${esc(t.artist)} — ${esc(t.title)}"><i></i></button>`;
    }).join('');
    $('#rail-main').innerHTML += `<button class="nav-item owner-link ${isOwner() ? 'unlocked' : ''}" type="button" data-action="set-view" data-view="admin">${icon(isOwner() ? 'shield' : 'edit')} Painel do dono ${isOwner() ? '' : '<span class="count">🔒</span>'}</button>`;
    const p = plan();
    $('#rail-plan').innerHTML = `<div class="pc-kicker">SEU PLANO</div><h4>${esc(planName(p))}${p !== 'free' ? ' ✦' : ''}</h4>
      <p>${p === 'free' ? 'Desbloqueie downloads, equalizador e áudio de alta qualidade.' : 'Recursos Pro/Studio ativos na sua conta.'}</p>
      <button type="button" data-action="open-plans">${p === 'free' ? 'Ver planos' : 'Gerenciar plano'}</button>`;
  }

  /* ------------------------------------------------------------- insights */
  function renderGraph() {
    const edges = tracks.map((t, i) => {
      const a = (i / tracks.length) * Math.PI * 2 - Math.PI / 2;
      return `<line x1="150" y1="75" x2="${(150 + Math.cos(a) * 95).toFixed(1)}" y2="${(75 + Math.sin(a) * 45).toFixed(1)}" stroke="rgba(255,255,255,.13)" stroke-width="1"/>`;
    }).join('');
    const nodes = tracks.map((t, i) => {
      const a = (i / tracks.length) * Math.PI * 2 - Math.PI / 2;
      const cx = 150 + Math.cos(a) * 95, cy = 75 + Math.sin(a) * 45;
      const plays = playCount(t.id), rad = 5 + Math.min(9, Math.sqrt(plays) * 1.9);
      return `<g class="graph-node" data-graph="${t.id}"><circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${(rad + 6).toFixed(1)}" fill="none" stroke="${t.color}" stroke-opacity=".22"/>
        <circle cx="${cx.toFixed(1)}" cy="${cy.toFixed(1)}" r="${rad.toFixed(1)}" fill="${plays ? t.color : '#6d6a68'}" opacity=".9"/>
        <title>${esc(t.title)} — ${plays} reproduções</title></g>`;
    }).join('');
    $('#insights-graph').innerHTML = `<svg viewBox="0 0 300 150" preserveAspectRatio="xMidYMid meet">${edges}
      <circle cx="150" cy="75" r="13" fill="#ff8a3d" opacity=".9"/><circle cx="150" cy="75" r="21" fill="none" stroke="#ff8a3d" stroke-opacity=".25"/>${nodes}</svg>`;
  }
  function renderInsights() {
    const n = currentNumbers();
    const graph = $('#insights-graph'); if (!graph) return;
    // Mantém os números do hero sincronizados sem reconstruir o stage (o play continua fluindo).
    const heroStats = $$('.hero-stat strong');
    if (heroStats.length === 4) {
      heroStats[0].innerHTML = `<span class="live-dot"></span>${num(n.listeners)}`;
      heroStats[1].textContent = num(n.plays);
      heroStats[2].textContent = num(n.comments);
    }
    renderGraph();
    $('#insights-kpis').innerHTML = `
      <div class="kpi accent"><div class="kpi-k">Ouvintes agora</div><div class="kpi-v">${num(n.listeners)} <small>vivos</small></div></div>
      <div class="kpi good"><div class="kpi-k">Reproduções</div><div class="kpi-v">${num(n.plays)}</div></div>
      <div class="kpi"><div class="kpi-k">Comentários</div><div class="kpi-v">${num(n.comments)}</div></div>
      <div class="kpi"><div class="kpi-k">Contas locais</div><div class="kpi-v">${num(n.accounts)}</div></div>`;
    const liked = state.liked.size, reposted = state.reposted.size;
    const sentiment = Math.min(98, Math.max(12, Math.round(42 + liked * 4 + reposted * 3 + n.comments * .6 + Math.min(20, n.plays * 2))));
    const mood = sentiment >= 70 ? 'Positivo' : sentiment >= 45 ? 'Moderado' : 'Inicial';
    const dist = tracks.map(t => playCount(t.id));
    const max = Math.max(1, ...dist);
    $('#insights-sentiment').innerHTML = `<div class="sentiment-top"><span>Sentiment Rate</span><em>${mood}</em></div>
      <div class="sentiment-value">${sentiment}% <small>${liked ? '+' + (liked * 4) : 'estável'}</small></div>
      <div class="sentiment-bars">${dist.map((v, i) => `<i class="${v ? 'on' : ''}" style="height:${Math.max(12, (v / max) * 100)}%" title="${esc(tracks[i].title)}: ${v} plays"></i>`).join('')}</div>`;
    $('#insights-services').innerHTML = `<h3>${icon('wave')} Ecossistema do catálogo</h3>
      <p><b>${tracks.length}</b> faixas, <b>${tracks.filter(t => t.group === 'release').length}</b> lançamentos oficiais e <b>${n.accounts}</b> contas criadas neste navegador.</p>
      <div class="ins-tags"><span>#Nightcore</span><span>#Synthwave</span><span>#SpatialUI</span><span>#Remixes</span></div>`;
    const top = [...tracks].sort((a, b) => playCount(b.id) - playCount(a.id))[0];
    const topPlays = playCount(top.id);
    const concentration = n.plays ? Math.round((topPlays / n.plays) * 100) : 0;
    $('#insights-analysis').innerHTML = `<h3>${icon('spark')} RI Analysis</h3>
      <p>${n.plays
        ? `<b>${esc(top.title)}</b> lidera com ${num(topPlays)} reproduções (${concentration}% do total). ${concentration > 60 ? 'Considere diversificar a divulgação das demais faixas.' : 'A audiência está bem distribuída entre as faixas.'}`
        : 'Ainda não há reproduções registradas. Dê o play em uma faixa para iniciar a análise em tempo real.'}</p>
      <div class="ins-tags"><span>fonte: ${n.source}</span><span>${new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</span></div>`;
  }
  function answerQuestion(raw) {
    const q = raw.toLowerCase().trim();
    const n = currentNumbers();
    const top = [...tracks].sort((a, b) => playCount(b.id) - playCount(a.id))[0];
    if (!q) return 'Pergunte sobre ouvintes, reproduções, comentários ou seu plano.';
    if (/ouvint|audiên|live|agora/.test(q)) return `Há <b>${num(n.listeners)} ${n.listeners === 1 ? 'sessão ativa' : 'sessões ativas'}</b> agora, medidas em tempo real (${n.source}).`;
    if (/reprodu|play|mais ouvida|top/.test(q)) return `Foram <b>${num(n.plays)} reproduções</b> reais. A mais ouvida é <b>${esc(top.title)}</b>, com ${num(playCount(top.id))}.`;
    if (/coment/.test(q)) return `Existem <b>${num(n.comments)} comentários</b> no catálogo. Você pode responder e reagir em cada faixa.`;
    if (/plano|assinatura|pro|studio|conta/.test(q)) {
      const a = currentAccount();
      return a ? `Sua conta <b>${esc(a.name)}</b> está no plano <b>${esc(planName(a.plan))}</b>.` : 'Você ainda não entrou. Crie uma conta para escolher um plano.';
    }
    if (/faixa|catálogo|música|quantas/.test(q)) return `O catálogo tem <b>${tracks.length} faixas</b>, sendo ${tracks.filter(t => t.group === 'release').length} lançamentos oficiais KYROSHIX Records.`;
    return `Resumo atual: <b>${num(n.listeners)}</b> ouvintes, <b>${num(n.plays)}</b> reproduções, <b>${num(n.comments)}</b> comentários e <b>${tracks.length}</b> faixas.`;
  }

  /* ------------------------------------------------------------- mini/now */
  function renderMiniPlayer() {
    const t = state.track;
    $('#mp-art').innerHTML = artInner(t);
    $('#mp-name').textContent = t.title;
    $('#mp-sub').textContent = t.artist + ' · ' + t.note;
    $('#dur').textContent = fmt(state.duration);
    $('#like-current').setAttribute('aria-pressed', String(state.liked.has(t.id)));
    $('#shuffle').setAttribute('aria-pressed', String(state.shuffled));
    $('#repeat').setAttribute('aria-pressed', String(state.repeating));
  }
  function renderTopActions() {
    const account = currentAccount();
    $('#account-btn').textContent = account ? account.name : 'Entrar';
    $('#plan-btn').textContent = account && account.plan !== 'free' ? planName(account.plan).toUpperCase() + ' ✦' : 'VER PLANOS';
    $('#plan-btn').classList.toggle('is-pro', !!account && account.plan !== 'free');
  }
  function renderNow() {
    const dlg = $('#player-dialog'); if (!dlg.open) return;
    const t = state.track;
    $('#now-art').innerHTML = artInner(t);
    $('#now-title').textContent = t.title;
    $('#now-artist').textContent = t.artist;
    $('#now-badges').innerHTML = `<span class="badge">${esc(t.tag)}</span><span class="badge">${esc(t.note)}</span>
      <span class="badge" style="color:var(--good)"><span class="real-badge"></span>${num(playCount(t.id))} plays reais</span>
      ${can('hq') ? '<span class="badge" style="color:#ffb990">HQ PRO</span>' : ''}`;
    $('#now-actions').innerHTML = `
      <button class="btn btn-ghost btn-sm" type="button" data-action="like" data-id="${t.id}">${icon('heart')} ${state.liked.has(t.id) ? 'Curtido' : 'Curtir'}</button>
      <button class="btn btn-ghost btn-sm" type="button" data-action="share" data-id="${t.id}">${icon('share')} Compartilhar</button>
      <button class="btn btn-ghost btn-sm" type="button" data-action="download" data-id="${t.id}">${icon('download')} ${can('download') ? 'Baixar' : 'Baixar · Pro'}</button>
      <button class="btn btn-ghost btn-sm" type="button" data-action="open-behind" data-id="${t.id}">${icon('eye')} Bastidores</button>`;
    $$('#now-tabs button').forEach(b => b.classList.toggle('active', b.dataset.nowtab === state.nowTab));
    renderNowPanel();
    updatePlayButton();
  }
  function renderNowPanel() {
    const t = state.track, panel = $('#now-panel');
    if (state.nowTab === 'queue') {
      const list = visibleTracks();
      panel.innerHTML = list.length ? list.map((x, i) => `<div class="queue-item ${x.id === t.id ? 'active' : ''}" data-action="play-track" data-id="${x.id}" role="button" tabindex="0">
        <div class="queue-art">${artInner(x)}</div><div style="min-width:0"><b>${esc(x.title)}</b><span>${esc(x.artist)}</span></div><span class="idx">${String(i + 1).padStart(2, '0')}</span></div>`).join('')
        : '<p class="field-hint">A fila está vazia.</p>';
    } else if (state.nowTab === 'comments') panel.innerHTML = commentsPanel(t);
    else if (state.nowTab === 'behind') {
      panel.innerHTML = `<div class="story" style="aspect-ratio:16/10;width:100%;cursor:default">
        <span class="story-bg" style="background-image:${storyBackground(t)}"></span>
        <span class="story-body"><span class="kicker">Behind the track</span><h3>${esc(t.title)}</h3><p>${esc(t.story)}</p></span></div>
        <div class="behind-credits" style="margin-top:12px"><b>Créditos</b><br>${esc(t.credits)}</div>
        <button class="btn btn-ghost btn-sm" style="margin-top:12px" type="button" data-action="open-behind" data-id="${t.id}">${icon('expand')} Abrir história vertical</button>`;
    } else {
      const locked = !can('eq');
      panel.innerHTML = `<div class="eq-grid">
        ${locked ? `<div class="form-ok">Equalizador disponível nos planos Pro e Studio. <button class="link-btn" type="button" data-action="open-plans">Ver planos</button></div>` : ''}
        <div class="eq-presets">${['Plano', 'Graves', 'Vocais', 'Neon'].map(p => `<button class="chip ${p === 'Plano' ? 'active' : ''}" type="button" data-action="eq-preset" data-preset="${p}">${p}</button>`).join('')}</div>
        ${[['bass', 'Graves · 180 Hz'], ['mid', 'Médios · 1.2 kHz'], ['treble', 'Agudos · 4.2 kHz']].map(([key, label]) => `
          <div class="eq-row"><label for="eq-${key}">${label}<span id="eq-${key}-v">${state.eq[key] > 0 ? '+' : ''}${state.eq[key]} dB</span></label>
          <input id="eq-${key}" type="range" min="-12" max="12" step="1" value="${state.eq[key]}" data-eq="${key}" ${locked ? 'disabled' : ''}></div>`).join('')}
        <div class="speed-row">Velocidade
          <select id="playback-rate" ${can('speed') ? '' : 'disabled'} aria-label="Velocidade de reprodução">
            ${[0.75, 1, 1.25, 1.5, 2].map(r => `<option value="${r}" ${audio.playbackRate === r ? 'selected' : ''}>${r}×</option>`).join('')}
          </select>${can('speed') ? '' : '<span style="font-size:10.5px">Pro/Studio</span>'}
        </div>
        <p class="field-hint">O equalizador usa Web Audio (BiquadFilter) direto no elemento de áudio.</p>
      </div>`;
    }
  }

  /* ------------------------------------------------------------- bastidores */
  function renderBehind() {
    const dlg = $('#behind-dialog'); if (!dlg.open) return;
    const t = tracks[state.behindIndex % tracks.length];
    $('#behind-bg').style.backgroundImage = storyBackground(t);
    $('#behind-content').innerHTML = `
      <div class="behind-bars">${tracks.map((_, i) => `<i class="${i <= state.behindIndex % tracks.length ? 'on' : ''}"></i>`).join('')}</div>
      <div class="behind-top">${avatarHTML(t)}<b>${esc(t.who)}</b><button class="dlg-close" data-close type="button" aria-label="Fechar">${icon('close')}</button></div>
      <div class="behind-spacer"></div>
      <div class="behind-caption"><span class="kicker">Behind the track</span><h2>${esc(t.title)}</h2><p>${esc(t.story)}</p>
        <div class="behind-credits">${icon('info')} ${esc(t.credits)}</div>
        <div class="behind-actions">
          <button class="mp-btn" type="button" data-action="play-track" data-id="${t.id}" aria-label="Ouvir">${icon('play', 'fill')}</button>
          <button class="mp-btn" type="button" data-action="like" data-id="${t.id}" aria-label="Curtir">${icon('heart')}</button>
          <button class="mp-btn" type="button" data-action="share" data-id="${t.id}" aria-label="Compartilhar">${icon('share')}</button>
          <span style="margin-left:auto;font-size:11px;color:rgba(255,255,255,.7)">${num(playCount(t.id))} plays · ${getComments(t.id).length} comentários</span>
        </div>
        <form class="behind-comment" id="behind-comment-form" data-id="${t.id}">
          <input type="text" maxlength="300" placeholder="Deixe um comentário…" aria-label="Comentar na faixa">
          <button type="submit" aria-label="Enviar comentário">${icon('send')}</button>
        </form>
      </div>`;
  }

  /* ------------------------------------------------------- novas seções */
  function planosHTML() {
    const current = plan();
    const notice = state.billingNotice
      ? `<div class="notice warn"><b>${icon('info')} Pagamento indisponível</b><span>${esc(state.billingNotice)}</span></div>` : '';
    return `<section class="panel glass planos-page">
      <div class="planos-head">
        <p class="eyebrow">KYROSHIX RECORDS · ASSINATURAS</p>
        <h1>Som sem limites, <em>do seu jeito</em>.</h1>
        <p>Pagamento processado pelo Stripe em página segura. Cancele quando quiser; sem fidelidade.</p>
      </div>
      ${notice}
      <div class="plan-grid">${PLANS.map(p => `
        <article class="plan-tile ${p.badge ? 'featured' : ''} ${current === p.id ? 'current' : ''}">
          ${p.badge ? `<span class="plan-badge">${esc(p.badge)}</span>` : ''}
          <h2>${esc(p.name)}</h2>
          <div class="plan-price"><strong>${esc(p.price)}</strong><small>${esc(p.period)}</small></div>
          <ul>${p.features.map(f => `<li>${icon('check')} ${esc(f)}</li>`).join('')}</ul>
          <button class="btn ${p.badge ? 'btn-primary' : 'btn-ghost'}" type="button" data-action="checkout" data-plan="${p.id}">
            ${current === p.id ? 'Plano atual' : p.id === 'free' ? 'Usar grátis' : 'Assinar ' + esc(p.name)}
          </button>
        </article>`).join('')}
      </div>
      ${isOwner() ? `<div class="notice ok">${icon('crown')} Você é o dono do site: <b>Premium vitalício</b> ativo, com acesso ao painel administrativo.</div>` : ''}
      <div class="planos-foot">
        <div>${icon('shield')}<b>Pagamento seguro</b><span>Cartão processado pelo Stripe. Nenhum dado de cartão passa por este site.</span></div>
        <div>${icon('refresh')}<b>Ativação imediata</b><span>O webhook confirma o pagamento e libera o plano na hora.</span></div>
        <div>${icon('card')}<b>Cancelamento simples</b><span>Gerencie ou cancele a assinatura a qualquer momento.</span></div>
      </div>
    </section>`;
  }

  const safeYoutubeId = id => /^[A-Za-z0-9_-]{11}$/.test(String(id || '')) ? String(id) : '';
  function videoList() {
    const local = read('kx.videos.v2', null);
    return Array.isArray(local) ? local : (appConfig.youtube?.videos || []);
  }
  function videosHTML() {
    const list = videoList().filter(v => safeYoutubeId(v.id || v.youtubeId));
    return `<section class="panel glass">
      <div class="panel-head"><div><p class="eyebrow">KYROSHIX RECORDS · VÍDEOS</p><h1>Clipes e bastidores.</h1>
        <p>Reprodução via YouTube com consentimento explícito — nada é carregado antes do seu clique.</p></div></div>
      <div class="notice info">${icon('info')} <span><b>Sobre DRM:</b> vídeos incorporados do YouTube usam o player e as regras do próprio YouTube. DRM (Widevine/PlayReady/FairPlay) só é aplicável a arquivos próprios empacotados com servidor de licenças; está preparado em <code>drm.js</code> para mídia KYROSHIX.</span></div>
      ${list.length ? `<div class="video-grid">${list.map(v => {
        const id = safeYoutubeId(v.id || v.youtubeId);
        return `<article class="video-card" data-video="${id}">
          <div class="video-thumb" style="background-image:url('https://i.ytimg.com/vi/${id}/hqdefault.jpg')">
            <span class="video-play">${icon('play','fill')}</span>
            <span class="video-duration">${esc(v.duration || 'YouTube')}</span>
          </div>
          <div class="video-body"><h2>${esc(v.title || 'Vídeo KYROSHIX')}</h2><p>${esc(v.description || 'Clipe oficial')}</p>
            <button class="btn btn-ghost btn-sm" type="button" data-action="play-video" data-id="${id}">${icon('play')} Assistir</button>
          </div>
        </article>`;
      }).join('')}</div>` : `<div class="empty"><h2>Nenhum vídeo publicado</h2><p>O dono pode adicionar vídeos pelo painel administrativo.</p></div>`}
    </section>`;
  }

  function chatHTML() {
    const account = currentAccount();
    const rooms = ['geral', 'nightcore', 'bastidores'];
    return `<section class="chat-wrap glass">
      <aside class="chat-side">
        <div class="chat-side-head"><h2>Conversas</h2><span class="real-badge"></span> ao vivo</div>
        <div class="chat-rooms">${rooms.map((r, i) => `<button class="chat-room ${i === 0 ? 'active' : ''}" type="button" data-action="chat-room" data-room="${r}">
          <span class="avatar" style="--face:${['linear-gradient(135deg,#ff8a3d,#d23b5c)','linear-gradient(135deg,#7a5cff,#4f7bff)','linear-gradient(135deg,#39c7c7,#2b9f9f)'][i]}">#</span>
          <span><b>${r === 'geral' ? 'Geral' : r === 'nightcore' ? 'Nightcore' : 'Bastidores'}</b><small>Toque para abrir a sala</small></span></button>`).join('')}</div>
        <div class="chat-people"><h3>Online agora</h3><p><b>${num(currentNumbers().listeners)}</b> ouvintes conectados</p></div>
      </aside>
      <div class="chat-main">
        <header class="chat-head"><span class="avatar" style="--face:linear-gradient(135deg,#ff8a3d,#d23b5c)">#</span>
          <div><b id="chat-room-name">Geral</b><small id="chat-status">Mensagens em tempo real</small></div>
          <button class="icon-btn" type="button" data-action="chat-refresh" aria-label="Atualizar mensagens">${icon('refresh')}</button></header>
        <ol class="chat-log" id="chat-log" aria-live="polite"></ol>
        <form class="chat-compose" id="chat-form">
          <input id="chat-input" maxlength="1000" placeholder="${account ? 'Escreva uma mensagem…' : 'Entre na sua conta para conversar'}" ${account ? '' : 'disabled'} autocomplete="off">
          <button type="submit" aria-label="Enviar mensagem" ${account ? '' : 'disabled'}>${icon('send')}</button>
        </form>
      </div>
    </section>`;
  }
  function renderChatLog() {
    const log = $('#chat-log'); if (!log) return;
    const room = state.chatRoom || 'geral';
    const messages = state.chatMessages.filter(m => (m.room || 'geral') === room);
    const me = currentAccount()?.name || '';
    log.innerHTML = messages.length ? messages.map(m => `<li class="bubble ${m.author === me ? 'mine' : ''}">
      <span class="bubble-author">${esc(m.author)}</span><span class="bubble-text">${esc(m.text)}</span>
      <time>${new Date(m.at).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}</time></li>`).join('')
      : '<li class="chat-empty">Nenhuma mensagem nesta sala. Comece a conversa.</li>';
    log.scrollTop = log.scrollHeight;
  }
  async function refreshChat(quiet = true) {
    const result = await api('/api/chat?room=' + encodeURIComponent(state.chatRoom || 'geral'));
    if (result?.ok && Array.isArray(result.messages)) {
      state.chatMessages = result.messages;
      renderChatLog();
      const status = $('#chat-status'); if (status) status.textContent = 'Sincronizado agora';
    } else if (!quiet) {
      toast('Chat indisponível: configure o KV KX_DATA no Worker.');
      const status = $('#chat-status'); if (status) status.textContent = 'Sincronização indisponível';
    }
  }

  function profileHTML() {
    const pr = profile(), account = currentAccount();
    return `<section class="panel glass profile-page">
      <div class="panel-head"><div><p class="eyebrow">MINHA CONTA</p><h1>Seu perfil.</h1><p>Personalize como você aparece no catálogo e nas conversas.</p></div></div>
      ${account ? `<div class="account-box"><span class="avatar" style="--face:${esc(pr.avatar ? `url('${pr.avatar}')` : 'linear-gradient(135deg,#ff8a3d,#b06bff)')}">${pr.avatar ? '' : esc(account.name.charAt(0).toUpperCase())}</span>
        <div><b>${esc(account.name)}</b><span>${esc(account.email)} · plano ${esc(planName(account.plan))}</span></div><span class="plan-tag">${esc(planName(account.plan))}</span></div>` : '<div class="notice warn">Entre na sua conta para salvar seu perfil.</div>'}
      <form class="form-grid" id="profile-form">
        <div class="field"><label for="pf-name">Nome de exibição</label><input id="pf-name" maxlength="40" value="${esc(pr.name || account?.name || '')}" placeholder="Como quer ser chamado"></div>
        <div class="field"><label for="pf-bio">Bio</label><textarea id="pf-bio" rows="3" maxlength="240" placeholder="Conte um pouco sobre você">${esc(pr.bio || '')}</textarea></div>
        <div class="field"><label for="pf-avatar">Avatar (URL https ou imagem do dispositivo)</label><input id="pf-avatar" type="url" value="${/^https?:/.test(pr.avatar || '') ? esc(pr.avatar) : ''}" placeholder="https://…"><input id="pf-avatar-file" type="file" accept="image/*"></div>
        <div class="field"><label for="pf-accent">Cor de destaque</label><input id="pf-accent" type="color" value="${esc(pr.accent || '#ff8a3d')}"></div>
        <div class="field"><label for="pf-theme">Tema</label><select id="pf-theme"><option value="dark" ${pr.theme === 'dark' ? 'selected' : ''}>Escuro espacial</option><option value="darker" ${pr.theme === 'darker' ? 'selected' : ''}>Preto profundo</option><option value="warm" ${pr.theme === 'warm' ? 'selected' : ''}>Âmbar quente</option></select></div>
        <div class="dlg-actions"><button class="btn btn-primary" type="submit">${icon('check')} Salvar perfil</button></div>
      </form>
    </section>`;
  }
  function applyProfile() {
    const pr = profile();
    document.documentElement.style.setProperty('--accent', pr.accent || '#ff8a3d');
    document.body.dataset.theme = pr.theme || 'dark';
  }

  function adminHTML() {
    if (!isOwner()) return `<section class="panel glass"><div class="panel-head"><div><p class="eyebrow">ACESSO RESTRITO</p><h1>Painel do dono.</h1><p>Área exclusiva de ${esc(OWNER_EMAIL)}.</p></div></div>
      <div class="notice warn">${icon('shield')} <span>Entre com a conta do dono e confirme o código enviado por e-mail para desbloquear a edição em tempo real.</span></div>
      <div class="dlg-actions"><button class="btn btn-primary" type="button" data-action="owner-verify">${icon('shield')} Verificar acesso</button></div></section>`;
    return `<section class="panel glass admin-page">
      <div class="panel-head"><div><p class="eyebrow">PAINEL DO DONO · ${esc(OWNER_EMAIL)}</p><h1>Editar o site.</h1><p>Alterações publicadas em tempo real para todos os visitantes.</p></div>
        <span class="plan-tag">PREMIUM ATIVO</span></div>
      <div id="admin-sync" class="notice ${state.ownerToken ? 'ok' : 'warn'}">${icon('refresh')} <span>${state.ownerToken ? 'Sincronizando catálogo…' : 'Modo local: as alterações valem para este navegador. Configure o Worker + KX_DATA para publicar em tempo real para todos.'}</span></div>
      <div class="admin-section"><h2>${icon('disc')} Músicas (${tracks.length})</h2>
        <div class="admin-tracks">${tracks.map(t => `<div class="admin-track" data-track="${esc(t.id)}">
          <div class="admin-cover">${artInner(t)}</div>
          <div class="admin-fields">
            <label>Título<input data-field="title" value="${esc(t.title)}" maxlength="120"></label>
            <label>Artista<input data-field="artist" value="${esc(t.artist)}" maxlength="160"></label>
            <label>Descrição<input data-field="description" value="${esc(t.description || t.story || '')}" maxlength="300"></label>
            <label>Capa (URL https)<input data-field="image" value="${/^https?:/.test(t.image || '') ? esc(t.image) : ''}" placeholder="https://…"></label>
            <label>Áudio (URL https)<input data-field="audio" value="${esc(t.audio)}"></label>
          </div>
          <button class="btn btn-ghost btn-sm" type="button" data-action="remove-track" data-id="${esc(t.id)}">${icon('trash')} Remover</button>
        </div>`).join('')}</div>
        <div class="dlg-actions"><button class="btn btn-primary" type="button" data-action="save-catalog">${icon('check')} Publicar alterações</button></div>
      </div>
      <div class="admin-section"><h2>${icon('plus')} Nova faixa</h2>
        <form class="form-grid" id="new-track-form">
          <div class="field"><label for="nt-title">Título</label><input id="nt-title" required maxlength="120" placeholder="Nome da faixa"></div>
          <div class="field"><label for="nt-artist">Artista</label><input id="nt-artist" required maxlength="160" placeholder="Artista"></div>
          <div class="field"><label for="nt-cover">Capa (obrigatória, URL https)</label><input id="nt-cover" required type="url" placeholder="https://…/capa.webp"></div>
          <div class="field"><label for="nt-audio">Áudio (URL https)</label><input id="nt-audio" type="url" placeholder="https://…/faixa.mp3"></div>
          <div class="dlg-actions"><button class="btn btn-primary" type="submit">${icon('plus')} Adicionar</button></div>
        </form>
        <p class="field-hint">Faixas sem capa são recusadas automaticamente.</p>
      </div>
      <div class="admin-section"><h2>${icon('play')} Vídeos do YouTube</h2>
        <form class="form-grid" id="new-video-form">
          <div class="field"><label for="nv-title">Título</label><input id="nv-title" required maxlength="120"></div>
          <div class="field"><label for="nv-id">ID do vídeo (11 caracteres)</label><input id="nv-id" required maxlength="11" placeholder="dQw4w9WgXcQ"></div>
          <div class="dlg-actions"><button class="btn btn-primary" type="submit">${icon('plus')} Publicar vídeo</button></div>
        </form>
        <div class="admin-videos">${videoList().map((v, i) => `<span class="badge">${esc(v.title || v.id)} <button type="button" data-action="remove-video" data-index="${i}" aria-label="Remover">×</button></span>`).join('') || '<p class="field-hint">Nenhum vídeo.</p>'}</div>
      </div>
    </section>`;
  }
  async function syncCatalog(quiet = true) {
    const result = await api('/api/catalog');
    const note = $('#admin-sync span');
    if (result?.ok && Array.isArray(result.tracks) && result.tracks.length && result.updatedAt !== state.catalogUpdatedAt) {
      const clean = result.tracks.filter(hasCover);
      if (clean.length) {
        tracks = clean; state.catalogUpdatedAt = result.updatedAt;
        saveCatalog(); renderAll();
      }
    }
    if (note) note.textContent = result?.ok && Array.isArray(result.tracks) && result.tracks.length
      ? 'Sincronizado com o servidor — alterações aparecem para todos.' : 'Salvo neste navegador. Vincule KX_DATA no Worker para sincronizar entre dispositivos.';
    if (!quiet) toast(note ? note.textContent : 'Catálogo atualizado.');
  }

  /* ------------------------------------------------------------- planos / auth */
  function renderPlans() {
    const list = $('#plan-list'); if (!list) return;
    list.innerHTML = PLANS.map(p => `<button class="plan-option ${state.selectedPlan === p.id ? 'selected' : ''}" type="button" data-action="select-plan" data-plan="${p.id}">
      <span class="radio"></span><span style="flex:1"><h3>${esc(p.name)} ${p.badge ? `<span class="badge" style="font-size:9px;color:#ffb990">${esc(p.badge)}</span>` : ''}<span class="price" style="margin-left:auto">${esc(p.price)} <small style="color:var(--dim)">${esc(p.period)}</small></span></h3>
      <ul>${p.features.map(f => `<li>${icon('check')} ${esc(f)}</li>`).join('')}</ul></span></button>`).join('');
  }
  function renderAuth() {
    const account = currentAccount();
    const guest = $('#auth-guest'), logged = $('#auth-logged'), codeStep = $('#auth-code-step');
    if (state.codePending) {
      guest.hidden = true; logged.hidden = true; codeStep.hidden = false;
      $('#auth-title').textContent = 'Confirme seu acesso.';
      $('#auth-subtitle').textContent = `Enviamos um código de 6 dígitos para ${state.codePending.email}. Ele expira em 10 minutos.`;
      $('#auth-code-error').hidden = true;
      return;
    }
    codeStep.hidden = true;
    if (account) {
      guest.hidden = true; logged.hidden = false;
      $('#auth-title').textContent = 'Sua conta.';
      $('#auth-subtitle').textContent = 'Gerencie plano, perfil e segurança.';
      logged.innerHTML = `<div class="account-box"><span class="avatar" style="--face:linear-gradient(135deg,#ff8a3d,#b06bff)">${esc(account.name.charAt(0).toUpperCase())}</span>
        <div><b>${esc(account.name)}</b><span>${esc(account.email)} · desde ${new Date(account.createdAt).toLocaleDateString('pt-BR')}</span></div>
        <span class="plan-tag">${esc(planName(account.plan))}</span></div>
        <div class="form-grid">
          <div class="ins-card" style="margin:0"><h3>${icon('crown')} Plano atual</h3>
            <p>${account.plan === 'free' ? 'Free — recursos Pro/Studio bloqueados.' : `${esc(planName(account.plan))} ativo${account.planSince ? ' desde ' + new Date(account.planSince).toLocaleDateString('pt-BR') : ''}.`}</p></div>
          <div class="dlg-actions" style="margin-top:4px">
            <button class="btn btn-primary" type="button" data-action="open-plans">Gerenciar plano</button>
            <button class="btn btn-ghost" type="button" data-action="set-view" data-view="perfil">Meu perfil</button>
            ${isOwner() ? '<button class="btn btn-ghost" type="button" data-action="set-view" data-view="admin">Painel do dono</button>' : ''}
            ${account.plan !== 'free' && account.plan !== 'owner' ? '<button class="btn btn-ghost" type="button" data-action="cancel-plan">Cancelar assinatura</button>' : ''}
            <button class="btn btn-dark" type="button" data-action="logout">${icon('logout')} Sair</button>
          </div>
        </div>`;
    } else {
      guest.hidden = false; logged.hidden = true;
      $('#auth-title').textContent = 'Entre na KYROSHIX Records.';
      $('#auth-subtitle').textContent = 'Conta real com verificação por e-mail.';
      $$('#auth-seg button').forEach(b => b.classList.toggle('active', b.dataset.mode === state.authMode));
      const signup = state.authMode === 'signup';
      $('#auth-name-field').hidden = !signup; $('#auth-confirm-field').hidden = !signup;
      $('#auth-password').autocomplete = signup ? 'new-password' : 'current-password';
      $('#auth-submit').textContent = signup ? 'Criar conta' : 'Entrar';
      const google = $('#auth-google');
      if (google) google.hidden = !appConfig.auth?.google;
    }
  }
  function openPlans() { setView('planos'); }
  function showPlansStep(step) {
    $('#plans-step-choose').hidden = step !== 'choose';
    $('#plans-step-checkout').hidden = step !== 'checkout';
    if (step === 'checkout') {
      const p = planById(state.selectedPlan);
      $('#checkout-summary').innerHTML = `<span class="avatar" style="--face:linear-gradient(135deg,#ff8a3d,#b06bff)">${icon('card')}</span>
        <div><b>Assinatura ${esc(p.name)}</b><span>${esc(p.price)} ${esc(p.period)} · pagamento seguro via Stripe</span></div><span class="plan-tag">${esc(p.badge || 'PLANO')}</span>`;
    }
  }
  function requireAccount(after) {
    if (currentAccount()) { after(); return; }
    state.pendingAction = after;
    openDialog($('#auth-dialog')); renderAuth();
    toast('Entre na sua conta para continuar.');
  }
  async function startCheckout(planId) {
    if (planId === 'free') {
      if (currentAccount()) { setPlan('free'); toast('Plano Free ativado.'); renderAll(); }
      else requireAccount(() => { setPlan('free'); renderAll(); });
      return;
    }
    if (!currentAccount()) { state.pendingAction = () => startCheckout(planId); openDialog($('#auth-dialog')); renderAuth(); return; }
    state.billingNotice = '';
    const result = await api('/api/billing/checkout', { plan: planId, email: currentAccount().email });
    if (result?.ok && /^https:\/\//.test(result.url || '')) { location.href = result.url; return; }
    state.billingNotice = result?.reason === 'not_configured'
      ? 'O Stripe ainda não está configurado no Worker. Defina STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET e os preços dos planos (veja docs/webui-v2.md).'
      : (result?.detail || result?.reason || 'Não foi possível iniciar o pagamento.');
    state.view = 'planos'; renderAll();
    toast('Pagamento indisponível — veja o aviso na página.');
  }
  async function confirmCheckout() {
    const params = new URLSearchParams(location.search);
    const sessionId = params.get('session_id');
    if (!sessionId) return;
    const result = await api('/api/billing/confirm', { sessionId });
    if (result?.ok && result.plan && currentAccount()) {
      setPlan(result.plan); toast('Assinatura confirmada. Bem-vindo!');
    } else if (result?.reason === 'not_configured') {
      state.billingNotice = 'Confirmação indisponível: configure STRIPE_SECRET_KEY no Worker.';
    }
    history.replaceState({}, '', location.pathname + location.hash);
    renderAll();
  }

  /* ------------------------------------------------------------- render all */
  function renderAll() {
    renderRail(); renderStage(); renderInsights(); renderMiniPlayer(); renderTopActions();
    $('#search').value = state.query;
    $('#clear-search').hidden = !state.query;
    $$('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
    initWaves(); renderNow(); renderBehind(); applyEq();
    applyProfile();
    if (state.view === 'chat') renderChatLog();
    if (state.view === 'admin') syncCatalog(true);
  }

  /* ------------------------------------------------------------- eventos */
  function setView(view) {
    if (!VIEWS[view]) view = 'home';
    state.view = view; state.query = ''; state.tag = '';
    $('#search').value = ''; $('#clear-search').hidden = true;
    renderAll();
    window.scrollTo({ top: 0, behavior: reduceMotion.matches ? 'auto' : 'smooth' });
  }
  function openComments(trackId) {
    if (trackId && trackId !== state.track.id) loadTrack(byId(trackId), false);
    state.nowTab = 'comments'; openDialog($('#player-dialog')); renderNow();
    setTimeout(() => $('#new-comment')?.focus(), 60);
  }
  function openBehind(trackId) {
    state.behindIndex = Math.max(0, tracks.findIndex(t => t.id === trackId));
    openDialog($('#behind-dialog')); renderBehind();
    if (!state.playing) loadTrack(tracks[state.behindIndex], true);
  }
  function openPlayerTab(tab) { state.nowTab = tab || 'queue'; openDialog($('#player-dialog')); renderNow(); }

  document.addEventListener('click', event => {
    const viewBtn = event.target.closest('[data-view]');
    if (viewBtn) { setView(viewBtn.dataset.view); return; }
    const graph = event.target.closest('[data-graph]');
    if (graph) { loadTrack(byId(graph.dataset.graph), true); return; }
    const btn = event.target.closest('[data-action]');
    if (!btn) return;
    const action = btn.dataset.action, id = btn.dataset.id, track = id ? byId(id) : state.track;
    switch (action) {
      case 'play-track':
        if (id === state.track.id || track.id === state.track.id) togglePlay(); else loadTrack(track, true);
        break;
      case 'set-view': setView(btn.dataset.view); break;
      case 'set-tab': state.tab = btn.dataset.tab; state.view = 'stream'; renderAll(); break;
      case 'filter-tag':
        state.tag = state.tag === btn.dataset.tag ? '' : btn.dataset.tag;
        state.query = ''; $('#search').value = ''; $('#clear-search').hidden = true;
        state.view = 'stream'; renderAll(); break;
      case 'clear-tag': state.tag = ''; renderAll(); break;
      case 'reset-filters': state.tag = ''; state.query = ''; state.tab = 'all'; state.view = 'stream'; $('#search').value = ''; $('#clear-search').hidden = true; renderAll(); break;
      case 'play-playlist': {
        const ids = (btn.dataset.ids || '').split(',').filter(Boolean);
        if (ids.length) { loadTrack(byId(ids[0]), true); toast(`Tocando playlist com ${ids.length} faixas.`); }
        break;
      }
      case 'like': {
        const set = state.liked;
        set.has(track.id) ? set.delete(track.id) : set.add(track.id);
        persistSets(); renderAll();
        break;
      }
      case 'repost': {
        const set = state.reposted;
        set.has(track.id) ? set.delete(track.id) : set.add(track.id);
        persistSets(); renderAll();
        toast(set.has(track.id) ? 'Faixa repostada no stream.' : 'Repost removido.');
        break;
      }
      case 'share': shareTrack(track); break;
      case 'download': downloadTrack(track); break;
      case 'open-comments': openComments(btn.dataset.id); break;
      case 'open-behind': openBehind(btn.dataset.id); break;
      case 'open-player': openPlayerTab(btn.dataset.tab); break;
      case 'open-plans': closeDialog($('#auth-dialog')); setView('planos'); break;
      case 'checkout': startCheckout(btn.dataset.plan); break;
      case 'play-video': {
        const id = safeYoutubeId(btn.dataset.id);
        const card = btn.closest('.video-card');
        if (id && card) card.querySelector('.video-thumb').innerHTML =
          `<iframe title="Vídeo do YouTube" src="https://www.youtube-nocookie.com/embed/${id}?autoplay=1&rel=0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen loading="lazy" referrerpolicy="strict-origin-when-cross-origin"></iframe>`;
        break;
      }
      case 'chat-room': {
        state.chatRoom = btn.dataset.room;
        $$('.chat-room').forEach(b => b.classList.toggle('active', b === btn));
        const names = { geral: 'Geral', nightcore: 'Nightcore', bastidores: 'Bastidores' };
        const label = $('#chat-room-name'); if (label) label.textContent = names[state.chatRoom] || state.chatRoom;
        renderChatLog(); refreshChat(false); break;
      }
      case 'chat-refresh': refreshChat(false); break;
      case 'owner-verify': beginOwnerVerification(); break;
      case 'save-catalog': publishCatalog(); break;
      case 'remove-track': {
        if (!isOwner()) break;
        tracks = tracks.filter(t => t.id !== btn.dataset.id);
        saveCatalog(); renderAll(); toast('Faixa removida. Publique para aplicar a todos.'); break;
      }
      case 'remove-video': {
        if (!isOwner()) break;
        const list = videoList(); list.splice(Number(btn.dataset.index), 1);
        write('kx.videos.v2', list);
        if (state.ownerToken) api('/api/admin/videos', { token: state.ownerToken, videos: list });
        renderAll(); break;
      }
      case 'cancel-plan': setPlan('free'); renderAuth(); toast('Assinatura cancelada. Você voltou ao plano Free.'); break;
      case 'logout': closeDialog($('#auth-dialog')); logout(); break;
      case 'select-plan': state.selectedPlan = btn.dataset.plan; renderPlans(); break;
      case 'comment-submit': {
        const field = $('#new-comment');
        if (!field) break;
        if (!currentAccount()) { requireAccount(() => renderAll()); break; }
        if (addComment(track.id, field.value)) { field.value = ''; renderNow(); toast('Comentário publicado.'); }
        break;
      }
      case 'comment-like': toggleCommentLike(btn.dataset.id, btn.dataset.commentId); renderNow(); break;
      case 'comment-reply': {
        const form = $(`[data-reply-form="${btn.dataset.commentId}"]`);
        if (form) { form.hidden = !form.hidden; if (!form.hidden) $('textarea', form)?.focus(); }
        break;
      }
      case 'comment-delete':
        if (deleteComment(btn.dataset.id, btn.dataset.commentId)) { renderNow(); toast('Comentário excluído.'); }
        break;
      case 'eq-preset': {
        if (!can('eq')) { openPlans(); break; }
        const presets = { 'Plano': [0, 0, 0], 'Graves': [8, 1, -2], 'Vocais': [-2, 6, 3], 'Neon': [5, -2, 7] };
        const values = presets[btn.dataset.preset] || [0, 0, 0];
        ['bass', 'mid', 'treble'].forEach((k, i) => { state.eq[k] = values[i]; });
        initAudioGraph(); applyEq(); renderNowPanel();
        toast('Preset ' + btn.dataset.preset + ' aplicado.');
        break;
      }
      default: break;
    }
  });

  // Formulários de comentários (submit) e respostas
  document.addEventListener('submit', event => {
    const form = event.target;
    if (form.id === 'chat-form') {
      event.preventDefault();
      const input = $('#chat-input'); const text = input?.value.trim();
      if (!text || !currentAccount()) return;
      api('/api/chat', { author: currentAccount().name, text, room: state.chatRoom || 'geral' }).then(r => {
        if (r?.ok && Array.isArray(r.messages)) state.chatMessages = r.messages;
        input.value = ''; renderChatLog();
      });
      return;
    }
    if (form.id === 'profile-form') {
      event.preventDefault();
      const file = $('#pf-avatar-file')?.files?.[0];
      const done = avatar => {
        saveProfile({ name: $('#pf-name').value.trim(), bio: $('#pf-bio').value.trim(),
          avatar: avatar || $('#pf-avatar').value.trim(), accent: $('#pf-accent').value, theme: $('#pf-theme').value });
        api('/api/profile', { email: currentAccount()?.email, profile: profile() });
        applyProfile(); renderAll(); toast('Perfil salvo.');
      };
      if (file && file.size <= 2 * 1024 * 1024) {
        const reader = new FileReader(); reader.onload = () => done(reader.result); reader.readAsDataURL(file);
      } else done();
      return;
    }
    if (form.id === 'new-track-form') {
      event.preventDefault();
      if (!isOwner()) return;
      const cover = $('#nt-cover').value.trim();
      if (!/^https:\/\//.test(cover)) { toast('Informe uma URL https para a capa.'); return; }
      const title = $('#nt-title').value.trim(), artist = $('#nt-artist').value.trim();
      tracks.push({ id: 'track-' + uid().slice(0, 8), initial: title.charAt(0).toUpperCase(), group: 'release',
        artist, title, who: 'KYROSHIX', action: 'publicou uma faixa', when: 'agora', tag: '#Nightcore',
        likes: 0, reposts: 0, duration: 180, audio: $('#nt-audio').value.trim() || '/assets/remember.mp3',
        cover: 'art-custom', image: cover, seed: 97, avatar: 'linear-gradient(135deg,#ff8a3d,#b06bff)',
        note: 'KYROSHIX · Novo lançamento', color: '#ff8a3d', description: 'Novo lançamento KYROSHIX Records.',
        credits: 'Publicado por ' + OWNER_EMAIL + '.', story: 'Novo lançamento KYROSHIX Records.' });
      saveCatalog(); form.reset(); renderAll(); toast('Faixa adicionada. Publique para aplicar a todos.');
      return;
    }
    if (form.id === 'new-video-form') {
      event.preventDefault();
      if (!isOwner()) return;
      const id = safeYoutubeId($('#nv-id').value.trim());
      if (!id) { toast('ID do YouTube inválido.'); return; }
      const list = videoList(); list.push({ id, title: $('#nv-title').value.trim(), description: 'Clipe oficial KYROSHIX Records' });
      write('kx.videos.v2', list);
      if (state.ownerToken) api('/api/admin/videos', { token: state.ownerToken, videos: list });
      form.reset(); renderAll(); toast(state.ownerToken ? 'Vídeo publicado.' : 'Vídeo salvo neste navegador.');
      return;
    }
    if (form.id === 'auth-code-form') {
      event.preventDefault(); verifyAccessCode($('#auth-code').value.trim()); return;
    }
    if (form.id === 'behind-comment-form') {
      event.preventDefault();
      const input = $('input', form); const text = input.value.trim();
      if (!currentAccount()) { requireAccount(() => { renderBehind(); renderNow(); }); return; }
      if (text && addComment(form.dataset.id, text)) { input.value = ''; renderBehind(); renderNow(); toast('Comentário enviado.'); }
      return;
    }
    if (form.matches('[data-reply-form]')) {
      event.preventDefault();
      const field = $('textarea', form);
      if (!currentAccount()) { requireAccount(() => { renderBehind(); renderNow(); }); return; }
      if (field.value.trim() && addComment(state.track.id, field.value, form.dataset.replyForm)) { renderNow(); toast('Resposta publicada.'); }
    }
  });

  // Diálogos: fechar
  $$('dialog').forEach(dlg => {
    dlg.addEventListener('click', e => {
      if (e.target === dlg) dlg.close();
      if (e.target.closest('[data-close]')) dlg.close();
    });
    // Fechar a tela de conta sem entrar cancela a ação que a abriu; assim ela
    // não dispara depois, quando o usuário fizer login por outro caminho.
    if (dlg.id === 'auth-dialog') dlg.addEventListener('close', () => {
      if (!currentAccount()) state.pendingAction = null;
    });
  });
  $('#insights-toggle').addEventListener('click', () => {
    const panel = $('#insights'), open = panel.classList.toggle('open');
    $('#ins-scrim').hidden = !open;
    $('#insights-toggle').setAttribute('aria-pressed', String(open));
  });
  $('#insights-close').addEventListener('click', () => { $('#insights').classList.remove('open'); $('#ins-scrim').hidden = true; $('#insights-toggle').setAttribute('aria-pressed', 'false'); });
  $('#ins-scrim').addEventListener('click', () => { $('#insights').classList.remove('open'); $('#ins-scrim').hidden = true; $('#insights-toggle').setAttribute('aria-pressed', 'false'); });

  // Conta, Google, código por e-mail e dono
  $('#account-btn').addEventListener('click', () => { renderAuth(); openDialog($('#auth-dialog')); });
  $('#plan-btn').addEventListener('click', () => setView('planos'));
  const profileBtn = $('#profile-btn');
  if (profileBtn) profileBtn.addEventListener('click', () => setView('perfil'));
  $$('#auth-seg button').forEach(b => b.addEventListener('click', () => { state.authMode = b.dataset.mode; $('#auth-error').hidden = true; renderAuth(); }));

  async function finalizeAccess(pending) {
    if (pending.mode === 'signup') await createAccount(pending.name, pending.email, pending.password);
    else if (pending.mode === 'login') await loginAccount(pending.email, pending.password);
    else if (pending.mode === 'google') {
      let list = accounts();
      let account = list.find(a => a.email === pending.email);
      if (!account) {
        account = { id: uid(), name: pending.name, email: pending.email, salt: '', hash: '', provider: 'google',
          plan: 'free', planSince: null, createdAt: Date.now() };
        list.push(account); saveAccounts(list);
      }
      write(SESSION_KEY, { id: account.id, at: Date.now() });
    }
    state.codePending = null; state.codeVerified = true;
    $('#auth-form').reset();
    closeDialog($('#auth-dialog'));
    renderAll(); renderAuth();
    const after = state.pendingAction; state.pendingAction = null;
    if (typeof after === 'function') after(); else renderAll();
    toast(pending.mode === 'signup' ? 'Conta criada. Bem-vindo à KYROSHIX Records.' : 'Acesso confirmado.');
  }

  async function beginAccess(pending) {
    if (!appConfig.auth?.emailCode) { await finalizeAccess(pending); return; }
    const result = await api('/api/auth/code', { email: pending.email });
    if (result?.ok) {
      state.codePending = pending;
      $('#auth-code').value = '';
      renderAuth(); $('#auth-code')?.focus();
      toast('Código enviado para ' + pending.email + '.');
      return;
    }
    // Sem provedor de e-mail configurado: avisa com clareza e mantém a conta local.
    const err = $('#auth-error');
    err.innerHTML = 'Verificação por e-mail indisponível: configure <b>RESEND_API_KEY</b> e <b>EMAIL_FROM</b> no Worker. ' +
      'Até lá, o acesso fica restrito a este navegador.';
    err.hidden = false;
    await finalizeAccess(pending);
  }

  async function verifyAccessCode(code) {
    const pending = state.codePending; if (!pending) return;
    if (!/^\d{6}$/.test(code)) { const e = $('#auth-code-error'); e.textContent = 'Digite os 6 dígitos.'; e.hidden = false; return; }
    if (pending.mode === 'owner') {
      const result = await api('/api/admin/verify', { email: pending.email, code });
      if (!result?.ok || !result.token) {
        const e = $('#auth-code-error'); e.textContent = result?.detail || result?.reason || 'Código inválido ou expirado.'; e.hidden = false; return;
      }
      state.ownerToken = result.token; write('kx.owner.token', result.token);
      const list = accounts(); const account = list.find(a => a.email === pending.email);
      if (account) { account.plan = 'owner'; account.planSince = Date.now(); saveAccounts(list); }
      state.codePending = null; $('#auth-code').value = '';
      closeDialog($('#auth-dialog')); renderAll(); setView('admin');
      toast('Acesso de dono confirmado. Premium ativado.');
      return;
    }
    const result = await api('/api/auth/verify', { email: pending.email, code });
    if (!result?.ok) {
      const e = $('#auth-code-error'); e.textContent = result?.detail || result?.reason || 'Código inválido ou expirado.'; e.hidden = false; return;
    }
    await finalizeAccess(pending);
  }

  async function googleSignIn() {
    const err = $('#auth-error'); err.hidden = true;
    try {
      const [appMod, authMod] = await Promise.all([
        import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),
        import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js')
      ]);
      const cfg = await fetch('/auth-config.json', { cache: 'no-store' }).then(r => r.json());
      if (!cfg?.firebase?.apiKey) throw new Error('Firebase não configurado');
      const app = appMod.initializeApp(cfg.firebase);
      const auth = authMod.getAuth(app);
      const cred = await authMod.signInWithPopup(auth, new authMod.GoogleAuthProvider());
      const email = cred.user?.email;
      if (!email) throw new Error('O Google não retornou um e-mail.');
      await beginAccess({ mode: 'google', email: email.toLowerCase(), name: cred.user.displayName || email.split('@')[0] });
    } catch (e) {
      err.textContent = 'Não foi possível entrar com o Google: ' + (e?.code || e?.message || 'erro desconhecido') +
        '. Confirme o provedor no Firebase e o domínio autorizado.';
      err.hidden = false;
    }
  }
  const googleBtn = $('#auth-google');
  if (googleBtn) googleBtn.addEventListener('click', googleSignIn);
  const resendBtn = $('#auth-code-resend');
  if (resendBtn) resendBtn.addEventListener('click', async () => {
    if (!state.codePending) return;
    const result = await api('/api/auth/code', { email: state.codePending.email });
    toast(result?.ok ? 'Novo código enviado.' : 'Não foi possível reenviar: configure o provedor de e-mail.');
  });
  $('#auth-code-cancel').addEventListener('click', () => { state.codePending = null; renderAuth(); });

  $('#auth-form').addEventListener('submit', async event => {
    event.preventDefault();
    const err = $('#auth-error'); err.hidden = true;
    const email = $('#auth-email').value.trim(), password = $('#auth-password').value;
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(email)) { err.textContent = 'Informe um e-mail válido.'; err.hidden = false; return; }
    if (password.length < 8) { err.textContent = 'A senha precisa ter pelo menos 8 caracteres.'; err.hidden = false; return; }
    if (state.authMode === 'signup') {
      const name = $('#auth-name').value.trim();
      if (name.length < 2) { err.textContent = 'Informe seu nome de exibição.'; err.hidden = false; return; }
      if (password !== $('#auth-confirm').value) { err.textContent = 'As senhas não coincidem.'; err.hidden = false; return; }
      if (accounts().some(a => a.email === email.toLowerCase())) { err.textContent = 'Já existe uma conta com esse e-mail.'; err.hidden = false; return; }
      await beginAccess({ mode: 'signup', name, email: email.toLowerCase(), password });
    } else {
      const account = await loginAccount(email, password);
      if (!account) { err.textContent = 'E-mail ou senha incorretos.'; err.hidden = false; return; }
      // loginAccount já gravou a sessão; o código por e-mail ainda é exigido.
      localStorage.removeItem(SESSION_KEY);
      await beginAccess({ mode: 'login', email: email.toLowerCase(), password });
    }
  });
  $('#auth-open-plans').addEventListener('click', () => { closeDialog($('#auth-dialog')); setView('planos'); });

  async function beginOwnerVerification() {
    if (!currentAccount() || currentAccount().email !== OWNER_EMAIL) {
      toast('Entre com ' + OWNER_EMAIL + ' para acessar o painel.');
      renderAuth(); openDialog($('#auth-dialog')); return;
    }
    const result = await api('/api/admin/code', { email: OWNER_EMAIL });
    if (result?.reason === 'not_configured' || result?.reason === 'offline') {
      // Sem provedor de e-mail, libera apenas a edição local — as escritas no
      // servidor continuam exigindo token verificado, então não afeta outros visitantes.
      const list = accounts(), account = list.find(a => a.email === OWNER_EMAIL);
      if (account) { account.plan = 'owner'; account.planSince = Date.now(); saveAccounts(list); }
      state.ownerToken = null; write('kx.owner.token', null);
      renderAll(); setView('admin');
      toast('Modo dono local ativado. Configure RESEND_API_KEY para verificar por e-mail e publicar em tempo real.');
      return;
    }
    if (!result?.ok) { toast('Não foi possível enviar o código: ' + (result?.detail || result?.reason || 'erro')); return; }
    state.codePending = { mode: 'owner', email: OWNER_EMAIL };
    renderAuth(); openDialog($('#auth-dialog')); $('#auth-code')?.focus();
  }
  async function publishCatalog() {
    if (!isOwner()) { toast('Somente o dono pode publicar alterações.'); return; }
    for (const row of $$('.admin-track')) {
      const t = tracks.find(x => x.id === row.dataset.track); if (!t) continue;
      for (const input of $$('[data-field]', row)) t[input.dataset.field] = input.value.trim();
      if (!hasCover(t)) { toast('Toda faixa precisa de capa.'); return; }
    }
    saveCatalog();
    if (state.ownerToken) {
      const result = await api('/api/catalog', { token: state.ownerToken, tracks });
      if (result?.ok) { state.catalogUpdatedAt = result.updatedAt || Date.now(); toast('Catálogo publicado em tempo real.'); }
      else toast('Salvo neste navegador. O servidor recusou a publicação: ' + (result?.detail || result?.reason || 'erro'));
    } else {
      toast('Salvo neste navegador. Configure RESEND_API_KEY + KX_DATA para publicar em tempo real.');
    }
    renderAll();
  }

  // Planos: diálogo legado agora apenas encaminha para o checkout real.
  $('#plan-continue').addEventListener('click', () => {
    closeDialog($('#plans-dialog'));
    startCheckout(state.selectedPlan);
  });
  $('#checkout-back').addEventListener('click', () => showPlansStep('choose'));
  $('#checkout-form').addEventListener('submit', event => {
    event.preventDefault();
    closeDialog($('#plans-dialog'));
    startCheckout(state.selectedPlan);
  });

  // Player
  $('#play').addEventListener('click', togglePlay);
  $('#now-play').addEventListener('click', togglePlay);
  $('#prev').addEventListener('click', () => step(-1));
  $('#now-prev').addEventListener('click', () => step(-1));
  $('#next').addEventListener('click', () => step(1));
  $('#now-next').addEventListener('click', () => step(1));
  function toggleShuffle() { state.shuffled = !state.shuffled; $('#shuffle').setAttribute('aria-pressed', String(state.shuffled)); $('#now-shuffle').setAttribute('aria-pressed', String(state.shuffled)); toast(state.shuffled ? 'Aleatório ativado.' : 'Aleatório desativado.'); }
  function toggleRepeat() { state.repeating = !state.repeating; $('#repeat').setAttribute('aria-pressed', String(state.repeating)); $('#now-repeat').setAttribute('aria-pressed', String(state.repeating)); toast(state.repeating ? 'Repetir ativado.' : 'Repetir desativado.'); }
  $('#shuffle').addEventListener('click', toggleShuffle);
  $('#now-shuffle').addEventListener('click', toggleShuffle);
  $('#repeat').addEventListener('click', toggleRepeat);
  $('#now-repeat').addEventListener('click', toggleRepeat);
  $('#expand').addEventListener('click', () => openPlayerTab('queue'));
  $('#mp-art').addEventListener('click', () => openPlayerTab('queue'));
  $('#mp-info').addEventListener('click', () => openPlayerTab('queue'));
  ['#mp-art', '#mp-info'].forEach(sel => $(sel).addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openPlayerTab('queue'); } }));
  $('#open-comments').addEventListener('click', () => openComments());
  $('#like-current').addEventListener('click', () => {
    const set = state.liked; set.has(state.track.id) ? set.delete(state.track.id) : set.add(state.track.id);
    persistSets(); renderAll();
  });
  $$('#now-tabs button').forEach(b => b.addEventListener('click', () => { state.nowTab = b.dataset.nowtab; renderNow(); }));
  $('#behind-prev').addEventListener('click', () => { state.behindIndex = (state.behindIndex - 1 + tracks.length) % tracks.length; renderBehind(); });
  $('#behind-next').addEventListener('click', () => { state.behindIndex = (state.behindIndex + 1) % tracks.length; renderBehind(); });

  // EQ / velocidade
  document.addEventListener('input', event => {
    const el = event.target;
    if (el.dataset.eq) {
      state.eq[el.dataset.eq] = Number(el.value);
      const out = $('#eq-' + el.dataset.eq + '-v'); if (out) out.textContent = (state.eq[el.dataset.eq] > 0 ? '+' : '') + state.eq[el.dataset.eq] + ' dB';
      initAudioGraph(); applyEq();
    }
    if (el.id === 'playback-rate' && can('speed')) audio.playbackRate = Number(el.value);
  });

  // Volume
  audio.volume = Number($('#volume').value);
  $('#volume').addEventListener('input', e => { audio.volume = Number(e.target.value); });

  // Busca
  $('#search-form').addEventListener('submit', e => e.preventDefault());
  $('#search').addEventListener('input', e => {
    state.query = e.target.value.trim();
    $('#clear-search').hidden = !state.query;
    if (state.query) state.view = 'stream';
    renderAll();
  });
  $('#clear-search').addEventListener('click', () => { state.query = ''; $('#search').value = ''; $('#clear-search').hidden = true; renderAll(); $('#search').focus(); });

  // Pergunta ao painel
  $('#ask-form').addEventListener('submit', event => {
    event.preventDefault();
    const input = $('#ask-input'), answer = $('#ask-answer');
    answer.innerHTML = answerQuestion(input.value);
    answer.hidden = false; input.value = '';
  });
  $('#simulate').addEventListener('click', () => { heartbeat(); renderInsights(); toast('Análise recalculada com os dados reais da sessão.'); });

  // Ondas: seek
  function bindWave(el, getTrack) {
    if (!el) return;
    el.addEventListener('pointerdown', e => {
      e.preventDefault();
      const t = getTrack();
      if (t && t.id !== state.track.id) loadTrack(t, true);
      seekTo(ratioFromEvent(el, e));
      el.dataset.seeking = '1';
      try { el.setPointerCapture(e.pointerId); } catch { /* sem captura */ }
    });
    el.addEventListener('pointermove', e => {
      // Só arrasta com o botão pressionado. Sem isso, um movimento de ponteiro
      // depois de um clique simples zerava a posição recém-escolhida.
      if (!(e.buttons & 1) || el.dataset.seeking !== '1' || !el.hasPointerCapture(e.pointerId)) return;
      seekTo(ratioFromEvent(el, e));
    });
    ['pointerup', 'pointercancel'].forEach(type => el.addEventListener(type, () => { delete el.dataset.seeking; }));
    el.addEventListener('keydown', e => {
      if (e.key === 'ArrowRight') { e.preventDefault(); seekTo(currentRatio() + .05); }
      if (e.key === 'ArrowLeft') { e.preventDefault(); seekTo(currentRatio() - .05); }
      if (e.key === 'Home') { e.preventDefault(); seekTo(0); }
      if (e.key === 'End') { e.preventDefault(); seekTo(.99); }
      if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); togglePlay(); }
    });
  }
  bindWave($('#mini-wave'), () => state.track);
  bindWave($('#big-wave'), () => state.track);
  document.addEventListener('pointerdown', e => {
    const wave = e.target.closest('.wave[data-wave]');
    if (!wave) return;
    e.preventDefault();
    const t = byId(wave.dataset.id);
    if (t.id !== state.track.id) loadTrack(t, true);
    seekTo(ratioFromEvent(wave, e));
    try { wave.setPointerCapture(e.pointerId); wave.dataset.seeking = '1'; } catch { /* ignore */ }
  });
  document.addEventListener('pointermove', e => {
    if (!(e.buttons & 1)) return;
    const wave = e.target.closest('.wave[data-wave]');
    if (wave && wave.dataset.seeking === '1' && wave.hasPointerCapture(e.pointerId) && wave.dataset.id === state.track.id) seekTo(ratioFromEvent(wave, e));
  });
  ['pointerup', 'pointercancel'].forEach(type => document.addEventListener(type, e => {
    const wave = e.target.closest('.wave[data-wave]'); if (wave) delete wave.dataset.seeking;
  }));

  // Tilt 3D discreto nos cards
  document.addEventListener('pointermove', e => {
    if (reduceMotion.matches || e.pointerType === 'touch') return;
    const card = e.target.closest('.track'); if (!card) return;
    const r = card.getBoundingClientRect();
    const x = (e.clientX - r.left) / r.width - .5, y = (e.clientY - r.top) / r.height - .5;
    card.style.transform = `perspective(1100px) translateY(-2px) rotateX(${(-y * 2).toFixed(2)}deg) rotateY(${(x * 2).toFixed(2)}deg)`;
  });
  document.addEventListener('pointerout', e => {
    const card = e.target.closest('.track');
    if (card && !card.contains(e.relatedTarget)) card.style.transform = '';
  });

  // Áudio
  function applyPendingSeek() {
    if (pendingSeek == null) return;
    const target = Math.min(pendingSeek, state.duration || pendingSeek);
    if (Math.abs(audio.currentTime - target) < 1) { pendingSeek = null; seekAttempts = 0; return; }
    // Alguns servidores sem suporte a Range cancelam o seek durante o load.
    // Tenta de novo quando houver dados suficientes, com limite para não loopar.
    if (seekAttempts >= 3) { pendingSeek = null; seekAttempts = 0; return; }
    seekAttempts += 1;
    try { audio.currentTime = target; } catch { /* ignore */ }
  }
  audio.addEventListener('loadedmetadata', () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) { state.duration = audio.duration; $('#dur').textContent = fmt(state.duration); }
    applyPendingSeek();
    updateProgress();
  });
  ['loadeddata', 'canplay'].forEach(type => audio.addEventListener(type, applyPendingSeek));
  audio.addEventListener('seeked', () => {
    // Confirma que o seek realmente chegou ao destino antes de esquecê-lo.
    if (pendingSeek == null) return;
    if (Math.abs(audio.currentTime - pendingSeek) < 1) { pendingSeek = null; seekAttempts = 0; }
    else if (audio.readyState >= 3) window.setTimeout(applyPendingSeek, 0);
  });
  audio.addEventListener('timeupdate', updateProgress);
  audio.addEventListener('play', () => {
    state.playing = true; updatePlayButton();
    if (!state.countedPlay) { state.countedPlay = true; bumpPlay(state.track.id); }
    if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume().catch(() => {});
  });
  audio.addEventListener('pause', () => { state.playing = false; updatePlayButton(); });
  audio.addEventListener('ended', () => {
    if (state.repeating) { audio.currentTime = 0; play(); }
    else step(1, true);
  });

  // Teclado
  document.addEventListener('keydown', event => {
    const tag = document.activeElement?.tagName;
    if (['INPUT', 'TEXTAREA', 'SELECT'].includes(tag) || event.metaKey || event.ctrlKey || event.altKey) return;
    if (event.target.closest('[role="slider"]')) return;
    if ($$('dialog[open]').length) return;
    if (event.key === ' ') { event.preventDefault(); togglePlay(); }
    if (event.key === 'ArrowRight' && event.shiftKey) { event.preventDefault(); step(1); }
    if (event.key === 'ArrowLeft' && event.shiftKey) { event.preventDefault(); step(-1); }
    if (event.key.toLowerCase() === 'm') { audio.muted = !audio.muted; toast(audio.muted ? 'Áudio silenciado.' : 'Áudio ativado.'); }
  });

  // Presença e métricas
  heartbeat();
  setInterval(heartbeat, 12000);
  window.addEventListener('beforeunload', () => { delete presence[SESSION]; write(PRESENCE_KEY, presence); });
  syncServer('get');

  // Hash para compartilhamento
  const fromHash = () => {
    const m = /^#track-([\w-]+)$/.exec(location.hash);
    if (m && tracks.some(t => t.id === m[1])) loadTrack(byId(m[1]), false);
  };

  // Anúncios: só renderiza quando houver publisher ID aprovado e o plano não for pago.
  function renderAdSlots() {
    if (!appConfig.ads?.enabled || !/^ca-pub-\d{16}$/.test(appConfig.ads.publisherId || '')) return;
    if (can('noads')) return;
    const host = $('#stage'); if (!host || host.querySelector('.ad-slot')) return;
    const slot = document.createElement('div');
    slot.className = 'ad-slot';
    slot.innerHTML = '<span>Publicidade</span><ins class="adsbygoogle" style="display:block" data-ad-client="' +
      esc(appConfig.ads.publisherId) + '" data-ad-slot="' + esc(appConfig.ads.slotId || '') + '" data-ad-format="auto" data-full-width-responsive="true"></ins>';
    host.append(slot);
    try { (window.adsbygoogle = window.adsbygoogle || []).push({}); } catch { /* script ainda carregando */ }
  }

  // Início
  async function boot() {
    await loadAppConfig();
    applyProfile();
    renderAll();
    renderAuth();
    updatePlayButton();
    fromHash();
    renderAdSlots();
    await confirmCheckout();
    const pollMs = Math.max(2000, Number(appConfig.realtime?.pollMs) || 4000);
    setInterval(() => {
      if (state.view === 'chat') refreshChat(true);
      if (state.view === 'admin') syncCatalog(true);
      else if (appConfig.realtime?.enabled) {
        api('/api/catalog').then(r => {
          if (r?.ok && Array.isArray(r.tracks) && r.tracks.length && r.updatedAt !== state.catalogUpdatedAt) {
            const clean = r.tracks.filter(hasCover);
            if (clean.length) { tracks = clean; state.catalogUpdatedAt = r.updatedAt; saveCatalog(); renderAll(); }
          }
        });
      }
    }, pollMs);
    if (state.view === 'chat') refreshChat(true);
  }
  boot();
})();
