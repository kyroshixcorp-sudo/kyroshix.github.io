// Firebase owns passwords, OAuth, phone codes and token renewal. Email step-up is server validated.
export async function createFirebaseClient(config,options={}) {
 const [{initializeApp},sdk]=await Promise.all([import('https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js'),import('https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js')]);
 const auth=sdk.getAuth(initializeApp(config));auth.languageCode='pt-BR';await sdk.setPersistence(auth,sdk.browserLocalPersistence);
 const providerIDs=(options.providers||['google.com']).filter(id=>['google.com','facebook.com','github.com','twitter.com','apple.com','microsoft.com','yahoo.com'].includes(id)||/^oidc\.[a-z0-9_-]+$/.test(id));
 function provider(id){if(!providerIDs.includes(id))throw Object.assign(Error(),{code:'auth/operation-not-allowed'});let p;if(id==='google.com'){p=new sdk.GoogleAuthProvider();p.setCustomParameters({prompt:'select_account'});}else if(id==='facebook.com')p=new sdk.FacebookAuthProvider();else if(id==='github.com')p=new sdk.GithubAuthProvider();else if(id==='twitter.com')p=new sdk.TwitterAuthProvider();else p=new sdk.OAuthProvider(id);if(id==='apple.com'){p.addScope('email');p.addScope('name');}return p;}
 let recaptcha=null,sms=null;
 const actionSettings={url:new URL('/',location.href).href};
 async function codeAction(action,extra={}){const endpoint=options.security?.endpoint;const url=endpoint?new URL(endpoint):null;if(!url||url.protocol!=='https:'||!url.hostname.endsWith('.supabase.co')||url.pathname!=='/functions/v1/login-code')throw Object.assign(Error(),{publicMessage:'A confirmação por código ainda não está disponível.'});const token=await auth.currentUser?.getIdToken();if(!token)throw Object.assign(Error(),{code:'auth/invalid-credential'});const r=await fetch(url,{method:'POST',headers:{Authorization:'Bearer '+token,'Content-Type':'application/json'},body:JSON.stringify({action,...extra})});const data=await r.json();if(!r.ok)throw Object.assign(Error(),{publicMessage:data.message||'Não foi possível confirmar o código.'});return data;}
 return {
  providers:providerIDs,phoneEnabled:options.phoneEnabled===true,emailLinkEnabled:options.emailLinkEnabled===true,requiresCode:options.security?.requireEmailCode===true,
  currentUser(){return auth.currentUser;},token(refresh=false){return auth.currentUser?.getIdToken(refresh)||Promise.resolve(null);},observe(callback){return sdk.onAuthStateChanged(auth,callback);},
  login(email,password){return sdk.signInWithEmailAndPassword(auth,email,password);},
  async signup(email,password,name){const result=await sdk.createUserWithEmailAndPassword(auth,email,password);let profileSaved=true,verificationSent=true;try{await sdk.updateProfile(result.user,{displayName:name});}catch{profileSaved=false;}if(!options.security?.requireEmailCode){try{await sdk.sendEmailVerification(result.user,actionSettings);}catch{verificationSent=false;}}return{user:result.user,profileSaved,verificationSent};},
  google(){return sdk.signInWithPopup(auth,provider('google.com'));},oauth(id){return sdk.signInWithPopup(auth,provider(id));},linkProvider(id){return sdk.linkWithPopup(auth.currentUser,provider(id));},
  reset(email){return sdk.sendPasswordResetEmail(auth,email,actionSettings);},verify(){return sdk.sendEmailVerification(auth.currentUser,actionSettings);},
  async refresh(){await sdk.reload(auth.currentUser);await auth.currentUser.getIdToken(true);return auth.currentUser;},logout(){sms=null;return sdk.signOut(auth);},
  codeStatus(){return codeAction('status');},sendCode(){return codeAction('send');},confirmCode(challenge,code){return codeAction('verify',{challenge,code});},
  async sendSms(phone){if(!options.phoneEnabled)throw Object.assign(Error(),{code:'auth/operation-not-allowed'});if(!/^\+[1-9][0-9]{7,14}$/.test(phone))throw Object.assign(Error(),{publicMessage:'Use +, o código do país e o número completo.'});if(!recaptcha)recaptcha=new sdk.RecaptchaVerifier(auth,'auth-recaptcha',{size:'normal'});try{sms=await sdk.signInWithPhoneNumber(auth,phone,recaptcha);}catch(e){recaptcha.clear();recaptcha=null;throw e;}},
  confirmSms(code){if(!sms)throw Object.assign(Error(),{publicMessage:'Solicite um novo código SMS.'});return sms.confirm(code);},
  async sendEmailLink(email){if(!options.emailLinkEnabled)throw Object.assign(Error(),{code:'auth/operation-not-allowed'});await sdk.sendSignInLinkToEmail(auth,email,{...actionSettings,handleCodeInApp:true});localStorage.setItem('krs-email-link',email);},
  hasEmailLink(){return sdk.isSignInWithEmailLink(auth,location.href);},
  async completeEmailLink(email){const result=await sdk.signInWithEmailLink(auth,email,location.href);localStorage.removeItem('krs-email-link');history.replaceState({},'',location.pathname+location.hash);return result;}
 };
}
