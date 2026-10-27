// KYROSHIX RELEASES — private chat view foundation.
// This module is intentionally isolated until the API and RLS contract pass security tests.
// It does not access Supabase directly and never trusts user-provided HTML.
const element = (tag, className, text) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = String(text);
  return node;
};

export function createChatView({ root, onOpenConversation, onSendMessage, onSearchUsers, onRefresh } = {}) {
  if (!(root instanceof HTMLElement)) throw new TypeError('A raiz do chat é obrigatória.');
  const state = { conversations: [], messages: [], activeId: null, loading: false, sending: false, error: '' };
  root.replaceChildren();
  root.className = `${root.className} krs-chat`.trim();

  const sidebar = element('aside', 'krs-chat-sidebar');
  const heading = element('h1', '', 'Mensagens');
  const search = element('form', 'krs-chat-search');
  const searchInput = element('input');
  searchInput.type = 'search'; searchInput.name = 'user'; searchInput.maxLength = 100;
  searchInput.placeholder = 'Buscar usuário pelo nome ou UID';
  searchInput.setAttribute('aria-label', 'Buscar usuário para conversar');
  const searchButton = element('button', 'krs-chat-button', 'Buscar');
  searchButton.type = 'submit';
  search.append(searchInput, searchButton);
  const conversationList = element('div', 'krs-chat-conversations');
  conversationList.setAttribute('aria-label', 'Lista de conversas');
  conversationList.setAttribute('role', 'list');
  const refreshButton = element('button', 'krs-chat-button krs-chat-refresh', 'Atualizar conversas');
  refreshButton.type = 'button';
  sidebar.append(heading, search, refreshButton, conversationList);

  const panel = element('section', 'krs-chat-panel');
  panel.setAttribute('aria-label', 'Conversa selecionada');
  const panelHeading = element('h2', 'krs-chat-title', 'Selecione uma conversa');
  const status = element('p', 'krs-chat-status', 'Suas mensagens privadas aparecerão aqui.');
  status.setAttribute('role', 'status'); status.setAttribute('aria-live', 'polite');
  const transcript = element('ol', 'krs-chat-transcript');
  transcript.setAttribute('aria-label', 'Histórico de mensagens');
  const composer = element('form', 'krs-chat-composer');
  const textarea = element('textarea');
  textarea.name = 'message'; textarea.rows = 2; textarea.maxLength = 4000;
  textarea.placeholder = 'Escreva uma mensagem…';
  textarea.setAttribute('aria-label', 'Mensagem');
  textarea.required = true;
  const sendButton = element('button', 'krs-chat-button krs-chat-send', 'Enviar');
  sendButton.type = 'submit';
  const counter = element('small', 'krs-chat-counter', '0 / 4000');
  composer.append(textarea, counter, sendButton);
  composer.hidden = true;
  panel.append(panelHeading, status, transcript, composer);
  root.append(sidebar, panel);

  function renderConversations() {
    conversationList.replaceChildren();
    if (state.loading && !state.conversations.length) {
      conversationList.append(element('p', 'krs-chat-empty', 'Carregando conversas…')); return;
    }
    if (!state.conversations.length) {
      conversationList.append(element('p', 'krs-chat-empty', 'Nenhuma conversa ainda. Busque um usuário para começar.')); return;
    }
    for (const conversation of state.conversations) {
      const button = element('button', 'krs-chat-conversation');
      button.type = 'button'; button.setAttribute('role', 'listitem');
      button.setAttribute('aria-current', String(conversation.id === state.activeId));
      const name = element('strong', 'krs-chat-conversation-name', conversation.title || 'Usuário');
      const preview = element('span', 'krs-chat-preview', conversation.lastMessage || 'Sem mensagens');
      button.append(name, preview);
      button.addEventListener('click', async () => {
        state.activeId = conversation.id; renderConversations();
        panelHeading.textContent = conversation.title || 'Conversa';
        transcript.replaceChildren(); status.textContent = 'Carregando mensagens…'; composer.hidden = true;
        try {
          const result = await onOpenConversation?.(conversation.id);
          if (state.activeId !== conversation.id) return;
          state.messages = Array.isArray(result) ? result : [];
          renderMessages(); composer.hidden = false; status.textContent = '';
        } catch (error) { status.textContent = error?.message || 'Não foi possível carregar a conversa.'; }
      });
      conversationList.append(button);
    }
  }

  function renderMessages() {
    transcript.replaceChildren();
    if (!state.messages.length) {
      transcript.append(element('li', 'krs-chat-empty', 'Envie a primeira mensagem desta conversa.'));
      return;
    }
    for (const message of state.messages) {
      const item = element('li', 'krs-chat-message');
      const meta = element('div', 'krs-chat-message-meta');
      meta.append(element('strong', '', message.senderName || 'Usuário'));
      if (message.createdAt) {
        const time = element('time', '', new Date(message.createdAt).toLocaleString('pt-BR', { dateStyle: 'short', timeStyle: 'short' }));
        const parsed = Date.parse(message.createdAt);
        if (Number.isFinite(parsed)) time.dateTime = new Date(parsed).toISOString();
        meta.append(time);
      }
      item.append(meta, element('p', 'krs-chat-message-body', message.body || ''));
      transcript.append(item);
    }
    transcript.scrollTop = transcript.scrollHeight;
  }

  search.addEventListener('submit', async event => {
    event.preventDefault();
    const query = searchInput.value.trim();
    if (!query) { searchInput.focus(); return; }
    searchButton.disabled = true; status.textContent = 'Buscando usuário…';
    try { await onSearchUsers?.(query); status.textContent = 'Busca concluída. Selecione uma conversa ou usuário disponível.'; }
    catch (error) { status.textContent = error?.message || 'A busca falhou.'; }
    finally { searchButton.disabled = false; }
  });
  refreshButton.addEventListener('click', async () => {
    refreshButton.disabled = true; state.loading = true; renderConversations();
    try {
      const result = await onRefresh?.();
      state.conversations = Array.isArray(result) ? result : [];
      state.error = '';
    } catch (error) { state.error = error?.message || 'Não foi possível atualizar as conversas.'; status.textContent = state.error; }
    finally { state.loading = false; refreshButton.disabled = false; renderConversations(); }
  });
  textarea.addEventListener('input', () => { counter.textContent = `${textarea.value.length} / 4000`; });
  composer.addEventListener('submit', async event => {
    event.preventDefault();
    const body = textarea.value.trim();
    if (!body || !state.activeId || state.sending) return;
    state.sending = true; sendButton.disabled = true; status.textContent = 'Enviando…';
    try {
      const sent = await onSendMessage?.(state.activeId, body);
      if (sent) state.messages.push(sent);
      else state.messages.push({ body, senderName: 'Você', createdAt: new Date().toISOString() });
      textarea.value = ''; counter.textContent = '0 / 4000'; renderMessages(); status.textContent = 'Mensagem enviada.';
    } catch (error) { status.textContent = error?.message || 'Não foi possível enviar a mensagem.'; }
    finally { state.sending = false; sendButton.disabled = false; textarea.focus(); }
  });

  return {
    setConversations(items) { state.conversations = Array.isArray(items) ? items : []; renderConversations(); },
    setMessages(items) { state.messages = Array.isArray(items) ? items : []; renderMessages(); },
    appendMessage(message) {
      if (!message || (message.conversationId && message.conversationId !== state.activeId)) return;
      if (state.messages.some(item => item.id && item.id === message.id)) return;
      state.messages.push(message); renderMessages();
    },
    setStatus(text) { status.textContent = text || ''; },
    destroy() { root.replaceChildren(); root.classList.remove('krs-chat'); }
  };
}
