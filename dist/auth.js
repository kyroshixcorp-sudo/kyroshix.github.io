import { mountAuth } from './auth-controller.js';
import { createFirebaseClient } from './firebase-client.js';

export const authState = { user: null, client: null };
document.addEventListener('kyro:auth', event => { authState.user = event.detail; });
const ui = mountAuth(document);
export const authReady = (async () => {
try {
  const response = await fetch('/auth-config.json', { cache: 'no-store' });
  if (!response.ok) throw new Error('Configuration unavailable');
  const config = await response.json();
  const required = ['apiKey', 'authDomain', 'projectId', 'appId'];
  if (config.enabled === true && required.every(key => typeof config.firebase?.[key] === 'string' && config.firebase[key].trim())) {
    const client = await createFirebaseClient(config.firebase,config);
    authState.client = client;
    ui.connect(client);
  }
} catch {
  ui.unavailable('O acesso às contas está indisponível no momento. Recarregue a página para tentar novamente.');
}

})();
