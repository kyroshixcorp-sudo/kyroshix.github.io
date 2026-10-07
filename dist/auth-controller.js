const errors={
 'auth/invalid-credential':'E-mail ou senha incorretos. Confira os dados e tente novamente.',
 'auth/wrong-password':'E-mail ou senha incorretos. Confira os dados e tente novamente.',
 'auth/user-not-found':'E-mail ou senha incorretos. Confira os dados e tente novamente.',
 'auth/invalid-email':'Digite um e-mail válido.',
 'auth/email-already-in-use':'Não foi possível criar a conta com esse e-mail. Entre ou recupere sua senha.',
 'auth/weak-password':'Use uma senha mais longa, com pelo menos 12 caracteres.',
 'auth/password-does-not-meet-requirements':'Essa senha não atende aos requisitos de segurança. Use uma frase longa e única.',
 'auth/too-many-requests':'Muitas tentativas seguidas. Aguarde alguns minutos e tente novamente.',
 'auth/network-request-failed':'Não foi possível conectar. Confira sua internet e tente novamente.',
 'auth/user-disabled':'Esta conta está desativada.',
 'auth/popup-closed-by-user':'A janela de acesso foi fechada. Toque em continuar para tentar novamente.',
 'auth/cancelled-popup-request':'Já existe uma janela de acesso aberta. Conclua o acesso nela.',
 'auth/popup-blocked':'Permita pop-ups para este site. Você também pode entrar com e-mail e senha.',
 'auth/unauthorized-domain':'Este endereço ainda não foi autorizado para login.',
 'auth/operation-not-allowed':'Este método de acesso ainda não está disponível.',
 'auth/account-exists-with-different-credential':'Entre pelo método usado ao criar sua conta. Depois conecte o novo método em Minha conta.',
 'auth/credential-already-in-use':'Esse método pertence a outra conta. Entre nessa conta para continuar.',
 'auth/invalid-verification-code':'Código SMS incorreto. Confira os seis números.',
 'auth/code-expired':'O código expirou. Solicite outro.',
 'auth/invalid-phone-number':'Confira o telefone, incluindo + e o código do país.',
 'auth/web-storage-unsupported':'O navegador bloqueou a sessão. Abra o site no Chrome ou Safari.'
};
const names={
 'google.com':'Google','apple.com':'Apple','microsoft.com':'Microsoft',
 'github.com':'GitHub','facebook.com':'Facebook','twitter.com':'X (Twitter)',
 'yahoo.com':'Yahoo'
};
const socialMethods=[
 {id:'facebook.com',key:'facebook',name:'Facebook',mark:'f'},
 {id:'github.com',key:'github',name:'GitHub',mark:'GH'},
 {id:'twitter.com',key:'twitter',name:'X (Twitter)',mark:'𝕏'},
 {id:null,key:'instagram',name:'Instagram',mark:'◎',unavailable:'Integração própria necessária'}
];
const promptKey='krs-auth-prompted';

export function mountAuth(doc){
 const el=id=>doc.getElementById(id),dialog=el('account-dialog'),form=el('auth-form');
 let client=null,mode='login',user=null,rawUser=null,busy=false,unsubscribe=null,epoch=0,challenge=null,resendAfter=0,initialStateSeen=false;
 const labels={login:'Entrar',signup:'Criar conta',reset:'Enviar link de recuperação',link:'Enviar link de acesso',linkComplete:'Confirmar e-mail e entrar'};

 function message(text='',error=false){
  const out=el('auth-message');out.textContent=text;out.hidden=!text;out.dataset.error=String(error);out.setAttribute('role',error?'alert':'status');
 }
 function providerIds(){return client?.providers||['google.com'];}
 function providerAvailable(id){return !!client&&providerIds().includes(id);}
 function showInitialPrompt(){
  let seen=false;
  try{seen=doc.defaultView.sessionStorage.getItem(promptKey)==='1';if(!seen)doc.defaultView.sessionStorage.setItem(promptKey,'1');}catch{}
  if(!seen&&!dialog.open)dialog.showModal();
 }
 function renderSocialProviders(){
  const target=el('auth-providers');target.replaceChildren();
  for(const method of socialMethods){
   const available=!!method.id&&providerAvailable(method.id);
   const button=doc.createElement('button');button.type='button';button.id=`auth-${method.key}`;button.className=`auth-provider-button auth-provider-${method.key}`;
   button.disabled=!available||busy;button.dataset.available=String(available);button.setAttribute('aria-disabled',String(button.disabled));
   if(available)button.dataset.provider=method.id;
   const mark=doc.createElement('span');mark.className='provider-mark';mark.setAttribute('aria-hidden','true');mark.textContent=method.mark;
   const copy=doc.createElement('span');copy.className='auth-method-copy';
   const label=doc.createElement('strong');label.textContent=method.name;
   const status=doc.createElement('small');status.textContent=available?'Disponível':method.unavailable||'Ativação necessária';
   copy.append(label,status);button.append(mark,copy);button.setAttribute('aria-label',`Continuar com ${method.name}${available?'':' — '+(method.unavailable||'ativação necessária')}`);button.title=available?`Entrar com ${method.name}`:method.unavailable||`Ative ${method.name} nas configurações de autenticação.`;target.append(button);
  }
  const note=el('auth-provider-note');
  if(note)note.hidden=socialMethods.every(method=>method.id&&providerAvailable(method.id));
 }
 function renderLinkedProviders(){
  const target=el('auth-link-providers');target.replaceChildren();
  for(const id of providerIds()){
   const button=doc.createElement('button');button.type='button';button.className='secondary';button.textContent='Conectar '+(names[id]||'Conta institucional');button.dataset.linkProvider=id;target.append(button);
  }
 }
 function controls(){
  const googleEnabled=providerAvailable('google.com');
  const google=el('auth-google');
  if(google){google.disabled=busy||!googleEnabled;google.setAttribute('aria-disabled',String(google.disabled));}
  if(el('auth-google-label'))el('auth-google-label').textContent='Continuar com Google';
  if(el('auth-google-status'))el('auth-google-status').textContent=googleEnabled?'Disponível':'Ativação necessária';
  if(el('auth-submit')){el('auth-submit').disabled=busy||!client;el('auth-submit').setAttribute('aria-disabled',String(el('auth-submit').disabled));el('auth-submit').textContent=busy?'Aguarde…':client?labels[mode]:'Cadastro e login ainda não ativados';}
  for(const id of ['auth-signout','auth-resend','auth-reload','auth-code-send','auth-code-confirm','auth-code-cancel','auth-phone-send']){
   const button=el(id);if(button){button.disabled=busy||!client;button.setAttribute('aria-disabled',String(button.disabled));}
  }
  for(const button of el('auth-providers').querySelectorAll('button')){
   button.disabled=busy||button.dataset.available!=='true';button.setAttribute('aria-disabled',String(button.disabled));
  }
  const phone=el('auth-phone-open');
  if(phone){const enabled=client?.phoneEnabled===true;phone.disabled=busy||!enabled;phone.dataset.available=String(enabled);phone.setAttribute('aria-disabled',String(phone.disabled));}
  if(el('auth-phone-status'))el('auth-phone-status').textContent=client?.phoneEnabled?'Disponível':'Ativação necessária';
  for(const button of doc.querySelectorAll('[data-auth-mode],#auth-forgot,#auth-back,#auth-phone-back,[data-provider],[data-link-provider],#auth-link-open,#auth-guest-continue,.account-dialog .dialog-close'))button.disabled=busy;
  if(form)form.setAttribute('aria-busy',String(busy));
 }
 function setMode(next){
  mode=next;message();el('auth-password').value='';el('auth-confirm').value='';el('auth-confirm').setCustomValidity('');el('auth-password').type='password';el('auth-reveal').textContent='Mostrar';el('auth-reveal').setAttribute('aria-pressed','false');
  const signup=mode==='signup',password=['login','signup'].includes(mode);
  el('account-title').textContent=signup?'Crie sua conta.':mode==='reset'?'Recupere seu acesso.':mode.startsWith('link')?'Acesse pelo seu e-mail.':'Entre na sua conta.';
  el('auth-name-field').hidden=!signup;el('auth-name').required=signup;el('auth-name').disabled=!signup;
  el('auth-confirm-field').hidden=!signup;el('auth-confirm').required=signup;el('auth-confirm').disabled=!signup;
  el('auth-password-field').hidden=!password;el('auth-password').disabled=!password;el('auth-password').required=password;el('auth-password').minLength=signup?12:1;el('auth-password').autocomplete=signup?'new-password':'current-password';el('auth-password-hint').hidden=!signup;
  el('auth-forgot').hidden=mode!=='login';el('auth-back').hidden=password;
  el('auth-methods').hidden=!password;el('auth-email-divider').hidden=!password;el('auth-phone-panel').hidden=true;el('auth-sms-form').hidden=true;
  el('auth-link-open').hidden=!password||!client?.emailLinkEnabled;form.hidden=false;
  doc.querySelectorAll('[data-auth-mode]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.authMode===mode)));
  controls();
 }
 function publish(next){
  user=next;el('auth-guest').hidden=!!user;el('auth-profile').hidden=!user;el('account-open').textContent=user?'Minha conta':'Entrar';
  el('auth-subtitle').textContent=user?'Gerencie seu perfil e as formas de acesso à sua conta.':'Entre ou crie sua conta para participar da comunidade.';
  if(user){
   el('account-title').textContent='Sua conta.';el('profile-name').textContent=user.displayName||'Sua frequência';el('profile-email').textContent=user.email||user.phoneNumber||'';
   el('profile-initial').textContent=Array.from(user.displayName||user.email||'K')[0].toUpperCase();el('profile-verification').hidden=!!user.emailVerified||!!user.phoneNumber;
   el('profile-verified').hidden=!user.emailVerified&&!user.phoneNumber;el('profile-verified').textContent=user.phoneNumber&&!user.email?'Telefone confirmado':'E-mail confirmado';
  }else{el('profile-name').textContent='';el('profile-email').textContent='';el('profile-initial').textContent='';}
  el('account-uid').textContent=user?.uid||'';doc.dispatchEvent(new doc.defaultView.CustomEvent('kyro:auth',{detail:user}));controls();
 }
 async function renderUser(next){
  const isInitial=!initialStateSeen;if(isInitial)initialStateSeen=true;
  const turn=++epoch;if(rawUser?.uid!==next?.uid){challenge=null;resendAfter=0;}rawUser=next;el('auth-code-panel').hidden=true;
  if(!next){publish(null);setMode('login');if(isInitial)showInitialPrompt();return;}
  if(client?.requiresCode){
   publish(null);el('auth-guest').hidden=true;el('auth-profile').hidden=true;el('auth-code-panel').hidden=false;el('account-title').textContent='Confirme seu acesso.';
   try{
    const status=await client.codeStatus();if(turn!==epoch)return;
    if(!status.verified){controls();if(isInitial)showInitialPrompt();return;}
    el('auth-code-panel').hidden=true;publish({...next,emailVerified:!!next.email||next.emailVerified});
   }catch(error){if(turn===epoch){message(error.publicMessage||'Não foi possível verificar sua sessão.',true);if(isInitial)showInitialPrompt();}}
  }else publish(next);
 }
 async function run(action){
  if(busy)return;if(!client){message('O serviço de contas ainda não foi conectado. Nenhum dado foi enviado.',true);return;}
  busy=true;message();controls();try{await action();}catch(error){message(error.publicMessage||errors[error.code]||'Não foi possível concluir. Confira a conexão e tente novamente.',true);}finally{busy=false;controls();}
 }
 async function finish(result,text){await renderUser(result.user);if(user)message(text);}

 el('account-open').onclick=()=>{if(!rawUser)setMode(client?.hasEmailLink?.()?'linkComplete':'login');dialog.showModal();if(!rawUser)el('auth-email').focus();};
 el('auth-guest-continue').onclick=()=>dialog.close();
 dialog.addEventListener('close',()=>{el('auth-password').value='';el('auth-confirm').value='';el('auth-code').value='';el('auth-sms-code').value='';el('account-open').focus();});
 doc.querySelectorAll('[data-auth-mode]').forEach(button=>button.onclick=()=>setMode(button.dataset.authMode));
 el('auth-forgot').onclick=()=>setMode('reset');el('auth-back').onclick=()=>setMode('login');el('auth-link-open').onclick=()=>setMode('link');
 el('auth-reveal').onclick=()=>{const visible=el('auth-password').type==='password';el('auth-password').type=visible?'text':'password';el('auth-reveal').textContent=visible?'Ocultar':'Mostrar';el('auth-reveal').setAttribute('aria-pressed',String(visible));};
 for(const id of ['auth-password','auth-confirm'])el(id).addEventListener('input',()=>el('auth-confirm').setCustomValidity(''));
 form.onsubmit=e=>{
  e.preventDefault();if(mode==='signup'&&el('auth-password').value!==el('auth-confirm').value)el('auth-confirm').setCustomValidity('As senhas precisam ser iguais.');
  if(!form.reportValidity())return;const email=el('auth-email').value.trim(),password=el('auth-password').value,name=el('auth-name').value.trim();
  if(mode==='signup'&&!name){message('Digite seu nome.',true);return;}
  run(async()=>{
   if(mode==='reset'){try{await client.reset(email);}catch(error){if(error.code!=='auth/user-not-found')throw error;}message('Se existir uma conta com esse e-mail, você receberá um link de recuperação. Confira o spam.');}
   else if(mode==='link'){await client.sendEmailLink(email);message('Confira seu e-mail e abra o link de acesso neste navegador.');}
   else if(mode==='linkComplete'){await finish(await client.completeEmailLink(email),'Seu acesso foi confirmado.');}
   else if(mode==='signup'){await finish(await client.signup(email,password,name),client.requiresCode?'Confirme o código para concluir.':'Conta criada. Confirme seu e-mail pelo link enviado.');}
   else await finish(await client.login(email,password),'Você entrou na sua conta.');
   el('auth-password').value='';el('auth-confirm').value='';
  });
 };
 el('auth-google').onclick=()=>run(async()=>{await finish(await client.google(),'Você entrou com o Google.');});
 el('auth-providers').onclick=e=>{const button=e.target.closest('[data-provider]');if(button)run(async()=>finish(await client.oauth(button.dataset.provider),'Você entrou na sua conta.'));};
 el('auth-link-providers').onclick=e=>{const button=e.target.closest('[data-link-provider]');if(button)run(async()=>{await client.linkProvider(button.dataset.linkProvider);message('Nova forma de acesso conectada à mesma conta.');});};
 el('auth-signout').onclick=()=>run(async()=>{await client.logout();await renderUser(null);message('Você saiu da conta.');});
 el('auth-code-cancel').onclick=()=>run(async()=>{await client.logout();await renderUser(null);});
 el('auth-resend').onclick=()=>run(async()=>{await client.verify();message('Enviamos um novo e-mail de confirmação.');});
 el('auth-reload').onclick=()=>run(async()=>{const current=await client.refresh();await renderUser(current);message(current.emailVerified?'E-mail confirmado.':'A confirmação ainda não apareceu. Confira o link recebido.');});
 el('auth-code-send').onclick=()=>run(async()=>{if(Date.now()<resendAfter){message('Aguarde um minuto antes de solicitar outro código.',true);return;}const data=await client.sendCode();challenge=data.challenge;resendAfter=Date.now()+60000;el('auth-code-destination').textContent='Código enviado para '+data.destination+'. Válido por 10 minutos.';el('auth-code-send').textContent='Reenviar código';el('auth-code').focus();message('Confira seu e-mail, incluindo o spam.');});
 el('auth-code-form').onsubmit=e=>{e.preventDefault();run(async()=>{if(!challenge){message('Solicite um código antes de confirmar.',true);return;}await client.confirmCode(challenge,el('auth-code').value);el('auth-code').value='';await renderUser(rawUser);if(user)message('Acesso confirmado.');});};
 el('auth-phone-open').onclick=()=>{el('auth-methods').hidden=true;el('auth-email-divider').hidden=true;el('auth-phone-panel').hidden=false;form.hidden=true;el('auth-phone-number').focus();};
 el('auth-phone-back').onclick=()=>setMode(mode);
 el('auth-phone-send').onclick=()=>run(async()=>{await client.sendSms(el('auth-phone-number').value.replace(/[\s()-]/g,''));el('auth-sms-form').hidden=false;el('auth-sms-code').focus();message('Código enviado por SMS.');});
 el('auth-sms-form').onsubmit=e=>{e.preventDefault();run(async()=>finish(await client.confirmSms(el('auth-sms-code').value),'Telefone confirmado.'));};

 renderSocialProviders();renderLinkedProviders();setMode('login');
 return{
  connect(provider){
   client=provider;el('auth-unavailable').hidden=true;renderSocialProviders();renderLinkedProviders();setMode('login');
   unsubscribe=client.observe(renderUser);
   if(client.hasEmailLink?.()){setMode('linkComplete');try{el('auth-email').value=doc.defaultView.localStorage.getItem('krs-email-link')||'';}catch{}dialog.showModal();}
   controls();
  },
  unavailable(text){client=null;unsubscribe?.();renderSocialProviders();renderLinkedProviders();el('auth-unavailable').hidden=false;el('auth-unavailable').textContent=text;controls();}
 };
}
