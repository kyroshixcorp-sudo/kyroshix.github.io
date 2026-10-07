import { ACCESS_METHODS, createVisitGate, methodAvailable, methodName, methodNotice, providerIcon } from './access-policy.js';

const errors = {
  'auth/invalid-credential': 'E-mail ou senha incorretos. Confira os dados e tente novamente.',
  'auth/wrong-password': 'E-mail ou senha incorretos. Confira os dados e tente novamente.',
  'auth/user-not-found': 'E-mail ou senha incorretos. Confira os dados e tente novamente.',
  'auth/invalid-email': 'Digite um e-mail válido.',
  'auth/email-already-in-use': 'Não foi possível criar a conta com esse e-mail. Entre ou recupere sua senha.',
  'auth/weak-password': 'Use uma senha mais longa, com pelo menos 12 caracteres.',
  'auth/password-does-not-meet-requirements': 'Essa senha não atende aos requisitos de segurança. Use uma frase longa e única.',
  'auth/too-many-requests': 'Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.',
  'auth/network-request-failed': 'Não foi possível conectar. Confira sua internet e tente novamente.',
  'auth/user-disabled': 'Esta conta está desativada.',
  'auth/popup-closed-by-user': 'A janela de acesso foi fechada. Toque em continuar para tentar novamente.',
  'auth/cancelled-popup-request': 'Já existe uma janela de acesso aberta. Conclua o acesso nela.',
  'auth/popup-blocked': 'Permita pop-ups para este site. Você também pode entrar com e-mail e senha.',
  'auth/unauthorized-domain': 'Este endereço ainda não foi autorizado para login.',
  'auth/operation-not-allowed': 'Este método de acesso ainda não está disponível.',
  'auth/account-exists-with-different-credential': 'Entre pelo método usado ao criar sua conta. Depois conecte o novo método em Minha conta.',
  'auth/credential-already-in-use': 'Esse método pertence a outra conta. Entre nessa conta para continuar.',
  'auth/invalid-verification-code': 'Código SMS incorreto. Confira os seis números.',
  'auth/code-expired': 'O código expirou. Solicite outro.',
  'auth/invalid-phone-number': 'Confira o telefone, incluindo + e o código do país.',
  'auth/web-storage-unsupported': 'O navegador bloqueou a sessão. Abra o site no Chrome ou Safari.'
};
const labels = {
  login: 'Entrar na minha conta', signup: 'Criar minha conta', reset: 'Enviar link de recuperação',
  link: 'Enviar link de acesso', linkComplete: 'Confirmar e-mail e entrar'
};
const headings = {
  login: ['Bom ter você de volta.', 'Sua música, seu perfil, sua comunidade.'],
  signup: ['Sua frequência começa aqui.', 'Crie seu espaço. Descubra o próximo play.'],
  reset: ['Recupere seu acesso.', 'Vamos enviar um link para redefinir sua senha.'],
  link: ['Entre pelo seu e-mail.', 'Receba um link seguro, sem precisar de senha.'],
  linkComplete: ['Confirme seu e-mail.', 'Use o e-mail que recebeu o link de acesso.']
};

export function mountAuth(doc) {
  const el = id => doc.getElementById(id);
  const dialog = el('account-dialog'), form = el('auth-form');
  let storage = null;
  try { storage = doc.defaultView.localStorage; } catch {}
  const visit = createVisitGate(storage, doc.defaultView.location?.href);
  let client = null, mode = 'login', user = null, rawUser = null, busy = false;
  let unsubscribe = null, epoch = 0, settled = false, manual = false;
  let challenge = null, resendAfter = 0, phoneOpen = false;

  function message(text = '', error = false) {
    const out = el('auth-message');
    out.textContent = text;
    out.hidden = !text;
    out.dataset.error = String(error);
    out.setAttribute('role', error ? 'alert' : 'status');
  }

  function buildMethods() {
    const target = el('auth-providers');
    target.replaceChildren();
    const methods = [...ACCESS_METHODS];
    for (const id of client?.providers || []) {
      if (!methods.some(method => method.id === id)) methods.push({ id, name: methodName(id), icon: 'account' });
    }
    for (const method of methods) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'access-method';
      button.dataset.provider = method.id;
      button.id = method.id === 'phone' ? 'auth-phone-open' : 'auth-' + method.id.split('.')[0];
      button.append(providerIcon(doc, method.icon));
      const label = doc.createElement('span');
      label.className = 'access-method-label';
      label.textContent = method.name;
      if (method.id === 'google.com') label.id = 'auth-google-label';
      button.append(label);
      const badge = doc.createElement('span');
      badge.className = 'access-method-status';
      badge.textContent = method.id === 'instagram' ? 'Indisponível' : 'Não ativo';
      button.append(badge);
      button.setAttribute('aria-label', 'Continuar com ' + method.name);
      target.append(button);
    }
    const linked = el('auth-link-providers');
    linked.replaceChildren();
    for (const id of client?.providers || []) {
      const button = doc.createElement('button');
      button.type = 'button';
      button.className = 'access-method';
      button.dataset.linkProvider = id;
      button.append(providerIcon(doc, ACCESS_METHODS.find(method => method.id === id)?.icon));
      const text = doc.createElement('span');
      text.textContent = 'Conectar ' + methodName(id);
      button.append(text);
      linked.append(button);
    }
    el('auth-linked-methods').hidden = !linked.children.length;
  }

  function controls() {
    dialog.dataset.busy = String(busy);
    form.setAttribute('aria-busy', String(busy));
    for (const id of ['auth-signout', 'auth-resend', 'auth-reload', 'auth-submit', 'auth-code-send', 'auth-code-confirm', 'auth-code-cancel', 'auth-phone-send', 'auth-sms-confirm']) {
      const button = el(id);
      button.disabled = busy || !client;
      button.setAttribute('aria-disabled', String(button.disabled));
    }
    for (const button of doc.querySelectorAll('[data-auth-mode],#auth-forgot,#auth-back,#auth-phone-back,#auth-link-open,#auth-guest-continue,[data-link-provider]')) button.disabled = busy;
    for (const button of el('auth-providers').children) {
      const available = methodAvailable(button.dataset.provider, client);
      button.disabled = busy;
      button.dataset.available = String(available);
      button.setAttribute('aria-disabled', String(!available || busy));
      button.setAttribute('aria-label', 'Continuar com ' + methodName(button.dataset.provider) + (available ? '' : ' — indisponível'));
      button.querySelector('.access-method-status').hidden = available;
    }
    el('auth-submit').textContent = busy ? 'Aguarde…' : client ? labels[mode] : 'Acesso indisponível';
    el('auth-link-open').hidden = !['login', 'signup'].includes(mode) || phoneOpen || !client?.emailLinkEnabled;
  }

  function setMode(next) {
    mode = next;
    phoneOpen = false;
    client?.cancelSms?.();
    message();
    el('auth-password').value = '';
    el('auth-confirm').value = '';
    el('auth-confirm').setCustomValidity('');
    el('auth-password').type = 'password';
    el('auth-reveal').textContent = 'Mostrar';
    el('auth-reveal').setAttribute('aria-pressed', 'false');
    const signup = mode === 'signup', password = ['login', 'signup'].includes(mode);
    const [title, subtitle] = headings[mode];
    el('account-title').textContent = title;
    el('account-subtitle').textContent = subtitle;
    el('auth-name-field').hidden = !signup;
    el('auth-name').required = signup;
    el('auth-name').disabled = !signup;
    el('auth-confirm-field').hidden = !signup;
    el('auth-confirm').required = signup;
    el('auth-confirm').disabled = !signup;
    el('auth-password-field').hidden = !password;
    el('auth-password').disabled = !password;
    el('auth-password').required = password;
    el('auth-password').minLength = signup ? 12 : 1;
    el('auth-password').autocomplete = signup ? 'new-password' : 'current-password';
    el('auth-password-hint').hidden = !signup;
    el('auth-forgot').hidden = mode !== 'login';
    el('auth-back').hidden = password;
    el('auth-alternatives').hidden = !password;
    el('auth-phone-panel').hidden = true;
    el('auth-sms-form').hidden = true;
    el('auth-sms-code').value = '';
    el('auth-tabs').hidden = !password;
    form.hidden = false;
    for (const button of doc.querySelectorAll('[data-auth-mode]')) button.setAttribute('aria-pressed', String(button.dataset.authMode === mode));
    controls();
  }

  function show() {
    visit.remember();
    if (!dialog.open) dialog.showModal();
    const focus = phoneOpen ? 'auth-phone-number' : rawUser ? (user ? 'edit-my-profile' : 'auth-code-send') : mode === 'signup' ? 'auth-name' : 'auth-email';
    el(focus).focus({ preventScroll: true });
  }

  function welcome() {
    if (!settled || !visit.canWelcome(rawUser, manual, client?.hasEmailLink?.())) return;
    setMode('signup');
    show();
  }

  function publish(next) {
    user = next;
    el('auth-guest').hidden = !!user;
    el('auth-profile').hidden = !user;
    el('account-open').textContent = user ? 'Minha conta' : 'Entrar';
    if (user) {
      el('account-title').textContent = 'Seu espaço na KYROSHIX.';
      el('account-subtitle').textContent = 'Tudo pronto para ouvir, comentar e personalizar.';
      el('profile-name').textContent = user.displayName || 'Sua frequência';
      el('profile-email').textContent = user.email || user.phoneNumber || '';
      el('profile-initial').textContent = Array.from(user.displayName || user.email || 'K')[0].toUpperCase();
      el('profile-verification').hidden = !!user.emailVerified || !!user.phoneNumber;
      el('profile-verified').hidden = !user.emailVerified && !user.phoneNumber;
      el('profile-verified').textContent = user.phoneNumber && !user.email ? 'Telefone confirmado' : 'E-mail confirmado';
    } else {
      el('profile-name').textContent = '';
      el('profile-email').textContent = '';
      el('profile-initial').textContent = '';
    }
    el('account-uid').textContent = user?.uid || '';
    doc.dispatchEvent(new doc.defaultView.CustomEvent('kyro:auth', { detail: user }));
    controls();
  }

  async function renderUser(next) {
    const turn = ++epoch, previous = rawUser;
    settled = true;
    if (rawUser?.uid !== next?.uid) { challenge = null; resendAfter = 0; }
    rawUser = next;
    el('auth-code-panel').hidden = true;
    if (!next) {
      publish(null);
      // Restoring an anonymous session must not clear a form already being typed in.
      if (previous) setMode('login');
      welcome();
      return;
    }
    visit.remember();
    client?.cancelSms?.();
    if (!client?.requiresCode) { publish(next); return; }
    publish(null);
    el('auth-guest').hidden = true;
    el('auth-profile').hidden = true;
    el('auth-code-panel').hidden = false;
    el('account-title').textContent = 'Confirme seu acesso.';
    el('account-subtitle').textContent = 'Mais uma etapa para proteger a sua conta.';
    try {
      const status = await client.codeStatus();
      if (turn !== epoch) return;
      if (!status.verified) { show(); controls(); return; }
      el('auth-code-panel').hidden = true;
      publish({ ...next, emailVerified: !!next.email || next.emailVerified });
    } catch (error) {
      if (turn === epoch) { show(); message(error.publicMessage || 'Não foi possível verificar sua sessão.', true); }
    }
  }

  async function run(action) {
    if (busy) return;
    if (!client) { message('O serviço de contas está indisponível. Nenhum dado foi enviado.', true); return; }
    busy = true;
    message();
    controls();
    try { await action(); }
    catch (error) { message(error.publicMessage || errors[error.code] || 'Não foi possível concluir. Confira a conexão e tente novamente.', true); }
    finally { busy = false; controls(); }
  }

  async function finish(result, text) {
    await renderUser(result.user);
    if (user) message(text);
  }

  el('account-open').onclick = () => {
    manual = true;
    if (!rawUser) setMode(client?.hasEmailLink?.() ? 'linkComplete' : 'login');
    show();
  };
  dialog.addEventListener('close', () => {
    visit.remember();
    client?.cancelSms?.();
    for (const id of ['auth-password', 'auth-confirm', 'auth-code', 'auth-sms-code']) el(id).value = '';
    el('auth-sms-form').hidden = true;
    el('account-open').focus();
  });
  dialog.addEventListener('cancel', event => { if (busy) event.preventDefault(); });
  el('auth-guest-continue').onclick = () => { if (!busy) dialog.close(); };
  for (const button of doc.querySelectorAll('[data-auth-mode]')) button.onclick = () => { manual = true; setMode(button.dataset.authMode); };
  el('auth-forgot').onclick = () => setMode('reset');
  el('auth-back').onclick = () => setMode('login');
  el('auth-phone-back').onclick = () => setMode('login');
  el('auth-link-open').onclick = () => setMode('link');
  el('auth-reveal').onclick = () => {
    const visible = el('auth-password').type === 'password';
    el('auth-password').type = visible ? 'text' : 'password';
    el('auth-reveal').textContent = visible ? 'Ocultar' : 'Mostrar';
    el('auth-reveal').setAttribute('aria-pressed', String(visible));
  };
  for (const id of ['auth-password', 'auth-confirm']) el(id).addEventListener('input', () => el('auth-confirm').setCustomValidity(''));

  form.onsubmit = event => {
    event.preventDefault();
    if (busy) return;
    if (mode === 'signup' && el('auth-password').value !== el('auth-confirm').value) el('auth-confirm').setCustomValidity('As senhas precisam ser iguais.');
    if (!form.reportValidity()) return;
    const email = el('auth-email').value.trim(), password = el('auth-password').value, name = el('auth-name').value.trim(), submittedMode = mode;
    if (mode === 'signup' && !name) { message('Digite seu nome.', true); return; }
    return run(async () => {
      if (submittedMode === 'reset') {
        try { await client.reset(email); } catch (error) { if (error.code !== 'auth/user-not-found') throw error; }
        message('Se existir uma conta com esse e-mail, você receberá um link de recuperação. Confira o spam.');
      } else if (submittedMode === 'link') {
        await client.sendEmailLink(email);
        message('Confira seu e-mail e abra o link de acesso neste navegador.');
      } else if (submittedMode === 'linkComplete') {
        await finish(await client.completeEmailLink(email), 'Seu acesso foi confirmado.');
      } else if (submittedMode === 'signup') {
        const result = await client.signup(email, password, name);
        await finish(result, client.requiresCode ? 'Confirme o código para concluir.' : result.verificationSent === false ? 'Conta criada. Reenvie a confirmação de e-mail abaixo.' : 'Conta criada. Confirme seu e-mail pelo link enviado.');
      } else await finish(await client.login(email, password), 'Você entrou na sua conta.');
      el('auth-password').value = '';
      el('auth-confirm').value = '';
    });
  };

  el('auth-providers').onclick = event => {
    const button = event.target.closest('[data-provider]');
    if (!button || busy) return;
    const id = button.dataset.provider;
    if (!methodAvailable(id, client)) { message(methodNotice(id), true); return; }
    manual = true;
    visit.remember();
    if (id === 'phone') {
      phoneOpen = true;
      message();
      el('auth-phone-panel').hidden = false;
      el('auth-alternatives').hidden = true;
      el('auth-tabs').hidden = true;
      form.hidden = true;
      el('account-title').textContent = 'Entre com seu telefone.';
      el('account-subtitle').textContent = 'Um código SMS para confirmar que é você.';
      controls();
      el('auth-phone-number').focus();
      return;
    }
    // run() invokes the SDK before its first await, preserving popup user activation.
    return run(async () => finish(await (id === 'google.com' ? client.google() : client.oauth(id)), 'Você entrou com ' + methodName(id) + '.'));
  };
  el('auth-link-providers').onclick = event => {
    const button = event.target.closest('[data-link-provider]');
    if (!button) return;
    return run(async () => { await client.linkProvider(button.dataset.linkProvider); message('Nova forma de acesso conectada à mesma conta.'); });
  };
  el('auth-signout').onclick = () => run(async () => { await client.logout(); await renderUser(null); message('Você saiu da conta.'); });
  el('auth-code-cancel').onclick = () => run(async () => { await client.logout(); await renderUser(null); });
  el('auth-resend').onclick = () => run(async () => { await client.verify(); message('Enviamos um novo e-mail de confirmação.'); });
  el('auth-reload').onclick = () => run(async () => { const next = await client.refresh(); await renderUser(next); message(next.emailVerified ? 'E-mail confirmado.' : 'A confirmação ainda não apareceu. Confira o link recebido.'); });
  el('auth-code-send').onclick = () => run(async () => {
    if (Date.now() < resendAfter) { message('Aguarde um minuto antes de solicitar outro código.', true); return; }
    const data = await client.sendCode();
    challenge = data.challenge;
    resendAfter = Date.now() + 60000;
    el('auth-code-destination').textContent = 'Código enviado para ' + data.destination + '. Válido por 10 minutos.';
    el('auth-code-send').textContent = 'Reenviar código';
    el('auth-code').focus();
    message('Confira seu e-mail, incluindo o spam.');
  });
  el('auth-code-form').onsubmit = event => {
    event.preventDefault();
    if (!el('auth-code-form').reportValidity()) return;
    return run(async () => {
      if (!challenge) { message('Solicite um código antes de confirmar.', true); return; }
      await client.confirmCode(challenge, el('auth-code').value);
      el('auth-code').value = '';
      await renderUser(rawUser);
      if (user) message('Acesso confirmado.');
    });
  };
  el('auth-phone-send').onclick = () => run(async () => {
    await client.sendSms(el('auth-phone-number').value.replace(/[\s()-]/g, ''));
    el('auth-sms-form').hidden = false;
    el('auth-sms-code').focus();
    el('auth-phone-send').textContent = 'Reenviar código SMS';
    message('Código enviado por SMS.');
  });
  el('auth-sms-form').onsubmit = event => {
    event.preventDefault();
    if (!el('auth-sms-form').reportValidity()) return;
    return run(async () => finish(await client.confirmSms(el('auth-sms-code').value), 'Telefone confirmado.'));
  };

  buildMethods();
  setMode('login');
  return {
    connect(provider) {
      unsubscribe?.();
      client = provider;
      el('auth-unavailable').hidden = true;
      buildMethods();
      controls();
      if (client.hasEmailLink?.()) {
        manual = true;
        setMode('linkComplete');
        try { el('auth-email').value = storage?.getItem('krs-email-link') || ''; } catch {}
        show();
      }
      unsubscribe = client.observe(renderUser);
    },
    unavailable(text) {
      client = null;
      unsubscribe?.();
      settled = true;
      el('auth-unavailable').hidden = false;
      el('auth-unavailable').textContent = text;
      controls();
      welcome();
    }
  };
}
