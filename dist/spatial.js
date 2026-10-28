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

  /* ---------------------------------------------------------------- dados */
  const tracks = [
    { id: 'forgive', initial: 'W', group: 'reference', artist: 'Mt. Si', title: 'Please Forgive Me', who: 'Washed Out', action: 'repostou uma faixa', when: 'há 7 horas',
      tag: '#CASCINE', likes: 116, reposts: 21, duration: 171.936, audio: '/assets/remember.mp3', cover: 'radial', seed: 17,
      avatar: 'linear-gradient(135deg,#7a5cff,#ff5c87)', note: 'referência visual · áudio demo KYROSHIX', color: '#9a7bff',
      credits: 'Referência visual de capa radial. Obra original: Mt. Si. Áudio demonstrativo: catálogo KYROSHIX.',
      story: 'Um círculo de luz que atravessa a faixa. A capa virou símbolo do movimento espacial do som.' },
    { id: 'tampa', initial: 'S', group: 'reference', artist: 'Small Black', title: 'Tampa (FM Skyline Remix) [Extended]', who: 'Small Black', action: 'publicou uma faixa', when: 'há 11 horas',
      tag: '#SmallBlack', likes: 89, reposts: 0, duration: 200.616, audio: '/assets/darkness.mp3', cover: 'teal', seed: 29,
      avatar: 'linear-gradient(135deg,#223,#c33)', note: 'referência visual · áudio demo KYROSHIX', color: '#57d6c4',
      credits: 'Referência visual em turquesa. Obra original: Small Black. Áudio demonstrativo: catálogo KYROSHIX.',
      story: 'Turquesa, estática e uma extensão que não quer terminar. O remix ganhou nova vida no stream.' },
    { id: 'remember', initial: 'K', group: 'release', artist: 'Levianth & Axol feat. The Tech Thieves', title: 'Remember', who: 'KYROSHIX', action: 'publicou um remix', when: 'há 1 dia',
      tag: '#Nightcore', likes: 412, reposts: 64, duration: 171.936, audio: '/assets/remember.mp3', cover: 'art-remember', seed: 41,
      avatar: 'linear-gradient(135deg,#f0a15c,#d23b5c)', note: 'KYROSHIX · Nightcore Remix', color: '#ff8a3d',
      credits: 'Obra original: Remember — Levianth & Axol feat. The Tech Thieves. Remix: KYROSHIX.',
      story: 'O som que fica. Nightcore acelerado, vocais em evidência e a energia que abriu o catálogo.' },
    { id: 'legends', initial: 'K', group: 'release', artist: 'Against The Current · League of Legends', title: 'Legends Never Die', who: 'KYROSHIX', action: 'publicou um remix', when: 'há 3 dias',
      tag: '#Nightcore', likes: 388, reposts: 51, duration: 207.744, audio: '/assets/legends.mp3', cover: 'art-legends', seed: 53,
      avatar: 'linear-gradient(135deg,#a35bff,#ff6f91)', note: 'KYROSHIX · Nightcore Remix', color: '#ff6f91',
      credits: 'Obra original: Legends Never Die — Worlds 2017, League of Legends feat. Against The Current. Remix: KYROSHIX.',
      story: 'A energia de Worlds em nova velocidade. Um hino que continua de pé depois do último refrão.' },
    { id: 'darkness', initial: 'K', group: 'release', artist: 'Lost Sky × She Is Jules', title: 'Darkness', who: 'KYROSHIX', action: 'publicou um remix', when: 'há 5 dias',
      tag: '#Synthwave', likes: 301, reposts: 43, duration: 200.616, audio: '/assets/darkness.mp3', cover: 'art-darkness', seed: 67,
      avatar: 'linear-gradient(135deg,#4f7bff,#9b5cff)', note: 'KYROSHIX · Synthwave / Nightcore', color: '#6f8bff',
      credits: 'Obra original: Darkness — Lost Sky & She Is Jules. Remix: KYROSHIX.',
      story: 'Entre luzes de neon e noites de synthwave. A faixa que puxa o catálogo para o lado mais escuro.' },
    { id: 'blindfold', initial: 'K', group: 'release', artist: 'Warriyo feat. Laura Brehm', title: 'Blindfold', who: 'KYROSHIX', action: 'publicou um remix', when: 'há 1 semana',
      tag: '#Nightcore', likes: 276, reposts: 38, duration: 189.579, audio: '/assets/blindfold.mp3', cover: 'art-blindfold', seed: 83,
      avatar: 'linear-gradient(135deg,#39c7c7,#4f6bff)', note: 'KYROSHIX · Nightcore Remix', color: '#57d6c4',
      credits: 'Obra original: Blindfold — Warriyo feat. Laura Brehm. Remix: KYROSHIX.',
      story: 'Feche os olhos. Entre na frequência. Uma viagem noturna em forma de remix.' }
  ];
  const byId = id => tracks.find(t => t.id === id) || tracks[0];

  const statusDots = [
    { id: 'forgive', ring: 'conic-gradient(#8f7bff,#ff77b5,#8f7bff)', face: 'radial-gradient(circle at 35% 30%,#f4d7ff,#7a5cff)' },
    { id: 'tampa', ring: 'conic-gradient(#39c7c7,#c7ff8a,#39c7c7)', face: 'radial-gradient(circle at 35% 30%,#d7fffb,#2b9f9f)' },
    { id: 'remember', ring: 'conic-gradient(#ff8a3d,#ffd06b,#ff8a3d)', face: 'radial-gradient(circle at 35% 30%,#ffe0b6,#d2533b)' },
    { id: 'legends', ring: 'conic-gradient(#a35bff,#ff6f91,#a35bff)', face: 'radial-gradient(circle at 35% 30%,#f3d7ff,#7830a8)' },
    { id: 'darkness', ring: 'conic-gradient(#4f7bff,#81e6ff,#4f7bff)', face: 'radial-gradient(circle at 35% 30%,#d9ecff,#3054b8)' }
  ];

  const PLANS = [
    { id: 'free', name: 'Free', price: 'R$ 0', period: 'para sempre', badge: '', features: ['Stream ilimitado', 'Comentários e curtidas', 'Fila e histórico'] },
    { id: 'pro', name: 'Pro', price: 'R$ 14,90', period: '/mês', badge: 'POPULAR', features: ['Tudo do Free', 'Download em MP3', 'Equalizador de 3 bandas', 'Alta qualidade', 'Sem anúncios'] },
    { id: 'studio', name: 'Studio', price: 'R$ 39,90', period: '/mês', badge: 'COMPLETO', features: ['Tudo do Pro', 'Presets de som', 'Velocidade de reprodução', 'Bastidores ilimitados', 'Selo de apoiador'] }
  ];
  const BENEFITS = {
    download: ['pro', 'studio'], eq: ['pro', 'studio'], hq: ['pro', 'studio'], noads: ['pro', 'studio'],
    presets: ['studio'], speed: ['pro', 'studio'], supporter: ['studio']
  };

  const VIEWS = {
    home: { title: 'Sua música, do seu jeito.', note: 'Retome de onde parou, descubra algo novo e acompanhe sua audiência em tempo real.' },
    discover: { title: 'Descobrir', note: 'Histórias verticais, bastidores de cada faixa e curadoria por estilo.' },
    stream: { title: 'Stream', note: 'O fluxo completo do catálogo — toque em uma capa, título ou forma de onda para ouvir.' },
    library: { title: 'Sua biblioteca', note: 'Curtidas, playlists, álbuns, artistas seguidos e estações em um só lugar.' },
    likes: { title: 'Curtidas', note: 'Faixas que você marcou com coração.' },
    recent: { title: 'Recentes', note: 'Faixas que você ouviu nesta sessão.' },
    queue: { title: 'A seguir', note: 'A fila começa pela próxima faixa depois da atual.' },
    playlists: { title: 'Playlists', note: 'Coleções montadas a partir dos estilos do catálogo.' },
    albums: { title: 'Álbuns e lançamentos', note: 'Os quatro lançamentos oficiais KYROSHIX Records.' },
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
  const seedComments = () => ({
    forgive: [
      { author: 'Washed Out', initial: 'W', text: 'Essa capa radial é hipnótica. Voltei várias vezes só para ver a luz girar.', at: Date.now() - 7200000 },
      { author: 'Marina R.', initial: 'M', text: 'O refrão gruda na cabeça. Alguém sabe o nome do remix?', at: Date.now() - 3600000 }
    ],
    tampa: [
      { author: 'Small Black', initial: 'S', text: 'Versão estendida, direto do arquivo original. Obrigado por ouvirem.', at: Date.now() - 10800000 }
    ],
    remember: [
      { author: 'KYROSHIX', initial: 'K', text: 'O som que fica. Essa abriu o catálogo — deixem seu comentário sobre a versão nightcore.', at: Date.now() - 86400000 },
      { author: 'Lukas', initial: 'L', text: 'A ponte em 1:42 é absurda. Volume alto, por favor.', at: Date.now() - 43200000 },
      { author: 'Duda', initial: 'D', text: 'Já entrou na playlist da academia 🎧', at: Date.now() - 7200000 }
    ],
    legends: [
      { author: 'KYROSHIX', initial: 'K', text: 'A energia de Worlds em nova velocidade. Qual parte vocês mais gostam?', at: Date.now() - 172800000 },
      { author: 'Rafa', initial: 'R', text: 'O drop final ficou enorme no fone.', at: Date.now() - 86400000 }
    ],
    darkness: [
      { author: 'KYROSHIX', initial: 'K', text: 'Synthwave + nightcore. Essa é para dirigir de madrugada.', at: Date.now() - 259200000 }
    ],
    blindfold: [
      { author: 'KYROSHIX', initial: 'K', text: 'Feche os olhos. Entre na frequência.', at: Date.now() - 345600000 },
      { author: 'Nina', initial: 'N', text: 'A voz da Laura Brehm com essa velocidade ficou perfeita.', at: Date.now() - 90000000 }
    ]
  });
  let comments = read(COMMENTS_KEY, null);
  if (!comments || typeof comments !== 'object') {
    const seeded = seedComments();
    comments = {};
    for (const [trackId, list] of Object.entries(seeded)) {
      comments[trackId] = list.map(c => ({ id: uid(), ...c, replyTo: null, demo: true, likes: Math.floor(Math.random() * 4), likedBy: [] }));
    }
    write(COMMENTS_KEY, comments);
  }
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
    comments[trackId] = list.filter(c => c.id !== commentId);
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
  function logout() { localStorage.removeItem(SESSION_KEY); renderAll(); toast('Você saiu da conta.'); }
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
    selectedPlan: 'pro', authMode: 'login', eq: { bass: 0, mid: 0, treble: 0 }, pendingAction: null
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
  function seekTo(ratio) {
    const position = Math.min(1, Math.max(0, ratio)) * state.duration;
    try { audio.currentTime = position; } catch { /* metadata pendente */ }
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
    state.track = track; state.duration = track.duration; state.countedPlay = false;
    state.history = [track.id, ...state.history.filter(id => id !== track.id)].slice(0, 12);
    persistSets();
    audio.src = track.audio; audio.load();
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
    const a = document.createElement('a'); a.href = track.audio; a.download = track.title.replace(/[^\w\s-]/g, '') + '.mp3';
    document.body.appendChild(a); a.click(); a.remove();
    toast('Download iniciado.');
  }

  /* ------------------------------------------------------------- capas */
  function artInner(track) {
    if (track.cover === 'radial') return '<span class="art art1"></span><span class="glow"></span><span class="ring"></span><span class="cross"></span><span class="word">PLEASE&nbsp;&nbsp;FORGIVE&nbsp;&nbsp;ME</span>';
    if (track.cover === 'teal') return '<span class="art art2"></span><span class="tag">SMALLBLACK&nbsp;&nbsp;THNX4</span><span class="tag2">TAMPA</span>';
    return `<span class="art ${track.cover}"></span><span class="art-shade"></span><span class="photo-caption">KYROSHIX</span>`;
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
        <div class="comment-top"><b>${esc(c.author)}</b><time>${relTime(c.at)}</time>${c.demo ? '<span class="demo">EXEMPLO</span>' : ''}</div>
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
      <div id="comment-list">${roots.length ? roots.map(c => commentHTML(track, c)).join('') : '<p class="field-hint">Nenhum comentário ainda. Seja o primeiro.</p>'}</div>`;
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
        <div class="chips">${['#Nightcore', '#Synthwave', '#CASCINE', '#SmallBlack'].map(tag => `<button class="chip ${state.tag === tag ? 'active' : ''}" type="button" data-action="filter-tag" data-tag="${esc(tag)}">${esc(tag)}</button>`).join('')}</div>
        <div style="margin-top:14px">${tilesHTML(tracks.slice(0, 4), 'No seu radar').replace(/^<section class="panel glass">|<\/section>$/g, '')}</div>
      </section>`;
  }
  function discoverHTML() {
    const tags = ['#Nightcore', '#Synthwave', '#CASCINE', '#SmallBlack'];
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
    if (t.cover === 'radial') return 'radial-gradient(circle at 50% 42%,#ffb02e,#ff7a2e 22%,#b8a6e8 55%,#8fb8e8)';
    if (t.cover === 'teal') return 'linear-gradient(150deg,#39c7c7,#7de3d6 45%,#0c5f70)';
    if (t.cover === 'art-remember') return "url('/assets/hero.webp')";
    return "url('/assets/covers.webp')";
  }
  function libraryHTML() {
    const liked = tracks.filter(t => state.liked.has(t.id));
    const recent = state.history.map(byId);
    const playlists = [
      { name: 'Nightcore Essentials', tag: '#Nightcore', ids: ['remember', 'legends', 'blindfold'] },
      { name: 'Neon Drive', tag: '#Synthwave', ids: ['darkness', 'tampa'] },
      { name: 'Spatial Chill', tag: '#CASCINE', ids: ['forgive', 'tampa'] }
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
      case 'stream': case 'likes': case 'recent': case 'queue':
      case 'playlists': case 'albums': case 'following': case 'stations':
        stage.innerHTML = feedHTML(); break;
      default: stage.innerHTML = homeHTML();
    }
  }

  /* ------------------------------------------------------------- rail */
  const RAIL_MAIN = [
    { view: 'home', icon: 'home', label: 'Início' }, { view: 'discover', icon: 'compass', label: 'Descobrir' },
    { view: 'stream', icon: 'wave', label: 'Stream' }, { view: 'library', icon: 'library', label: 'Biblioteca' }
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
    const p = plan();
    $('#rail-plan').innerHTML = `<div class="pc-kicker">SEU PLANO</div><h4>${esc(PLANS.find(x => x.id === p).name)}${p !== 'free' ? ' ✦' : ''}</h4>
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
      return a ? `Sua conta <b>${esc(a.name)}</b> está no plano <b>${esc(PLANS.find(p => p.id === a.plan).name)}</b>.` : 'Você ainda não entrou. Crie uma conta para escolher um plano.';
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
    $('#plan-btn').textContent = account && account.plan !== 'free' ? PLANS.find(p => p.id === account.plan).name.toUpperCase() + ' ✦' : 'VER PLANOS';
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

  /* ------------------------------------------------------------- planos / auth */
  function renderPlans() {
    $('#plan-list').innerHTML = PLANS.map(p => `<button class="plan-option ${state.selectedPlan === p.id ? 'selected' : ''}" type="button" data-action="select-plan" data-plan="${p.id}">
      <span class="radio"></span><span style="flex:1">
        <h3>${esc(p.name)} ${p.badge ? `<span class="badge" style="font-size:9px;color:#ffb990">${p.badge}</span>` : ''}<span class="price" style="margin-left:auto">${esc(p.price)} <small style="color:var(--dim)">${esc(p.period)}</small></span></h3>
        <p>${p.id === 'free' ? 'O essencial para ouvir e participar.' : p.id === 'pro' ? 'Para quem vive o som todos os dias.' : 'Para criadores e fãs que querem tudo.'}</p>
        <ul>${p.features.map(f => `<li>${icon('check')} ${esc(f)}</li>`).join('')}</ul>
      </span></button>`).join('');
  }
  function renderAuth() {
    const account = currentAccount();
    const guest = $('#auth-guest'), logged = $('#auth-logged');
    if (account) {
      guest.hidden = true; logged.hidden = false;
      $('#auth-title').textContent = 'Sua conta.';
      $('#auth-subtitle').textContent = 'Gerencie seu plano e sua sessão local.';
      logged.innerHTML = `<div class="account-box"><span class="avatar" style="--face:linear-gradient(135deg,#ff8a3d,#b06bff)">${esc(account.name.charAt(0).toUpperCase())}</span>
        <div><b>${esc(account.name)}</b><span>${esc(account.email)} · desde ${new Date(account.createdAt).toLocaleDateString('pt-BR')}</span></div>
        <span class="plan-tag">${esc(PLANS.find(p => p.id === account.plan).name)}</span></div>
        <div class="form-grid">
          <div class="ins-card" style="margin:0"><h3>${icon('crown')} Plano atual</h3>
            <p>${account.plan === 'free' ? 'Free — sem cobrança. Recursos Pro/Studio bloqueados.' : `${esc(PLANS.find(p => p.id === account.plan).name)} ativo desde ${new Date(account.planSince).toLocaleDateString('pt-BR')}.`}</p></div>
          <div class="dlg-actions" style="margin-top:4px">
            <button class="btn btn-primary" type="button" data-action="open-plans">Gerenciar plano</button>
            ${account.plan !== 'free' ? '<button class="btn btn-ghost" type="button" data-action="cancel-plan">Cancelar assinatura</button>' : ''}
            <button class="btn btn-dark" type="button" data-action="logout">${icon('logout')} Sair</button>
          </div>
        </div>`;
    } else {
      guest.hidden = false; logged.hidden = true;
      $('#auth-title').textContent = 'Entre na sua frequência.';
      $('#auth-subtitle').textContent = 'Conta local, salva apenas neste navegador.';
      $$('#auth-seg button').forEach(b => b.classList.toggle('active', b.dataset.mode === state.authMode));
      const signup = state.authMode === 'signup';
      $('#auth-name-field').hidden = !signup; $('#auth-confirm-field').hidden = !signup;
      $('#auth-password').autocomplete = signup ? 'new-password' : 'current-password';
      $('#auth-submit').textContent = signup ? 'Criar conta' : 'Entrar';
    }
  }
  function openPlans() { state.selectedPlan = plan() === 'free' ? 'pro' : plan(); renderPlans(); showPlansStep('choose'); openDialog($('#plans-dialog')); }
  function showPlansStep(step) {
    $('#plans-step-choose').hidden = step !== 'choose';
    $('#plans-step-checkout').hidden = step !== 'checkout';
    if (step === 'checkout') {
      const p = PLANS.find(x => x.id === state.selectedPlan);
      $('#checkout-summary').innerHTML = `<span class="avatar" style="--face:linear-gradient(135deg,#ff8a3d,#b06bff)">${icon('card')}</span>
        <div><b>Assinatura ${esc(p.name)}</b><span>${esc(p.price)} ${esc(p.period)} · cobrança demonstrativa</span></div><span class="plan-tag">${esc(p.badge || 'PLANO')}</span>`;
    }
  }
  function requireAccount(after) {
    if (currentAccount()) { after(); return; }
    state.pendingAction = after;
    openDialog($('#auth-dialog')); renderAuth();
    toast('Crie uma conta ou entre para continuar.');
  }

  /* ------------------------------------------------------------- render all */
  function renderAll() {
    renderRail(); renderStage(); renderInsights(); renderMiniPlayer(); renderTopActions();
    $('#search').value = state.query;
    $('#clear-search').hidden = !state.query;
    $$('[data-view]').forEach(b => b.classList.toggle('active', b.dataset.view === state.view));
    initWaves(); renderNow(); renderBehind(); applyEq();
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
      case 'open-plans': closeDialog($('#auth-dialog')); openPlans(); break;
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
  });
  $('#insights-toggle').addEventListener('click', () => {
    const panel = $('#insights'), open = panel.classList.toggle('open');
    $('#ins-scrim').hidden = !open;
    $('#insights-toggle').setAttribute('aria-pressed', String(open));
  });
  $('#insights-close').addEventListener('click', () => { $('#insights').classList.remove('open'); $('#ins-scrim').hidden = true; $('#insights-toggle').setAttribute('aria-pressed', 'false'); });
  $('#ins-scrim').addEventListener('click', () => { $('#insights').classList.remove('open'); $('#ins-scrim').hidden = true; $('#insights-toggle').setAttribute('aria-pressed', 'false'); });

  // Conta
  $('#account-btn').addEventListener('click', () => { renderAuth(); openDialog($('#auth-dialog')); });
  $('#plan-btn').addEventListener('click', () => openPlans());
  $$('#auth-seg button').forEach(b => b.addEventListener('click', () => { state.authMode = b.dataset.mode; $('#auth-error').hidden = true; renderAuth(); }));
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
      await createAccount(name, email, password);
      toast('Conta criada! Bem-vindo à KYROSHIX Records.');
    } else {
      const account = await loginAccount(email, password);
      if (!account) { err.textContent = 'E-mail ou senha incorretos.'; err.hidden = false; return; }
      toast('Você entrou na sua conta.');
    }
    $('#auth-form').reset();
    closeDialog($('#auth-dialog'));
    renderAll(); renderAuth();
    const pending = state.pendingAction;
    state.pendingAction = null;
    if (typeof pending === 'function') pending(); else renderAll();
  });
  $('#auth-open-plans').addEventListener('click', () => { closeDialog($('#auth-dialog')); openPlans(); });

  // Planos
  $('#plan-continue').addEventListener('click', () => {
    requireAccount(() => {
      if (state.selectedPlan === 'free') { setPlan('free'); closeDialog($('#plans-dialog')); toast('Plano Free ativado.'); return; }
      showPlansStep('checkout');
    });
  });
  $('#checkout-back').addEventListener('click', () => showPlansStep('choose'));
  $('#cc-number').addEventListener('input', e => {
    const digits = e.target.value.replace(/\D/g, '').slice(0, 16);
    e.target.value = digits.replace(/(.{4})/g, '$1 ').trim();
  });
  $('#cc-exp').addEventListener('input', e => {
    const d = e.target.value.replace(/\D/g, '').slice(0, 4);
    e.target.value = d.length > 2 ? d.slice(0, 2) + '/' + d.slice(2) : d;
  });
  $('#cc-cvc').addEventListener('input', e => { e.target.value = e.target.value.replace(/\D/g, '').slice(0, 4); });
  $('#checkout-form').addEventListener('submit', event => {
    event.preventDefault();
    const err = $('#checkout-error'); err.hidden = true;
    const name = $('#cc-name').value.trim(), number = $('#cc-number').value.replace(/\s/g, '');
    const exp = $('#cc-exp').value, cvc = $('#cc-cvc').value;
    if (name.length < 3 || number.length < 16 || !/^\d{2}\/\d{2}$/.test(exp) || cvc.length < 3) {
      err.textContent = 'Confira os dados do cartão (demonstração).'; err.hidden = false; return;
    }
    setPlan(state.selectedPlan);
    closeDialog($('#plans-dialog'));
    $('#checkout-form').reset();
    toast(`Plano ${PLANS.find(p => p.id === state.selectedPlan).name} ativado. Nenhum valor foi cobrado.`);
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
      try { el.setPointerCapture(e.pointerId); } catch { /* sem captura */ }
    });
    el.addEventListener('pointermove', e => { if (el.hasPointerCapture(e.pointerId)) seekTo(ratioFromEvent(el, e)); });
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
  audio.addEventListener('loadedmetadata', () => {
    if (Number.isFinite(audio.duration) && audio.duration > 0) { state.duration = audio.duration; $('#dur').textContent = fmt(state.duration); }
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

  // Início
  renderAll();
  renderAuth();
  updatePlayButton();
  fromHash();
})();
