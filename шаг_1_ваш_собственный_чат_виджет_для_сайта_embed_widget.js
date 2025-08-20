/* ===============================
   EMBED СНИППЕТ (вставьте перед </body>)
   ===============================
   <script defer src="/assets/site-chat-widget.js"
           data-endpoint=""
           data-website="SITE_001"
           data-title="Поддержка"
           data-primary-color="#2563eb"
           data-position="right"
           data-welcome="Здравствуйте! Чем помочь?">
   </script>

   Пояснения к атрибутам:
   - data-endpoint — ваш серверный URL приёма сообщений (можно оставить пустым: будет демо-режим "эхо")
   - data-website  — ID сайта/тенанта (для многосайтовости)
   - data-title    — заголовок в шапке окна чата
   - data-primary-color — основной цвет виджета
   - data-position — "right" или "left" (расположение плавающей кнопки)
   - data-welcome  — приветственное сообщение в чате при первом визите
*/

(() => {
  // ----------------------
  // УТИЛИТЫ
  // ----------------------
  const SCRIPT = document.currentScript || (function() {
    const scripts = document.getElementsByTagName('script');
    return scripts[scripts.length - 1];
  })();

  const cfg = {
    endpoint: (SCRIPT.getAttribute('data-endpoint') || '').trim(),
    website: (SCRIPT.getAttribute('data-website') || location.host),
    title: SCRIPT.getAttribute('data-title') || 'Чат',
    primary: SCRIPT.getAttribute('data-primary-color') || '#2563eb',
    position: (SCRIPT.getAttribute('data-position') || 'right').toLowerCase() === 'left' ? 'left' : 'right',
    welcome: SCRIPT.getAttribute('data-welcome') || 'Здравствуйте! Напишите нам — мы онлайн.',
  };

  const SID_KEY = `cx_sid_${cfg.website}`;
  const LOG_KEY = `cx_log_${cfg.website}`;

  const randId = () => Math.random().toString(36).slice(2) + Date.now().toString(36);
  let sessionId = localStorage.getItem(SID_KEY) || (function(){
    const id = randId();
    localStorage.setItem(SID_KEY, id);
    return id;
  })();

  const escapeHtml = (s) => s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

  const saveLog = (entries) => {
    try { localStorage.setItem(LOG_KEY, JSON.stringify(entries)); } catch {}
  };
  const loadLog = () => {
    try { return JSON.parse(localStorage.getItem(LOG_KEY) || '[]'); } catch { return []; }
  };

  const prefersDark = () => window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;

  // ----------------------
  // СТИЛИ
  // ----------------------
  const STYLE_ID = 'cx-widget-styles';
  if (!document.getElementById(STYLE_ID)) {
    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = `
      :root { --cx-primary: ${cfg.primary}; }
      .cx-hidden { display: none !important; }
      .cx-widget { position: fixed; z-index: 2147483646; font-family: ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Ubuntu, Cantarell, Noto Sans, Arial, 'Apple Color Emoji', 'Segoe UI Emoji'; }
      .cx-bubble { position: fixed; bottom: 20px; ${cfg.position}: 20px; z-index: 2147483646; border: 0; border-radius: 999px; padding: 12px 14px; box-shadow: 0 10px 24px rgba(0,0,0,.15); background: var(--cx-primary); color: #fff; cursor: pointer; display: inline-flex; align-items: center; gap: 8px; font-weight: 600; }
      .cx-bubble:focus { outline: 2px solid rgba(0,0,0,.2); outline-offset: 2px; }
      .cx-unread { min-width: 18px; height: 18px; border-radius: 999px; background: #fff; color: #111; font-size: 12px; display: inline-flex; align-items: center; justify-content: center; padding: 0 6px; }

      .cx-panel { position: fixed; bottom: 90px; ${cfg.position}: 20px; width: min(380px, calc(100vw - 40px)); height: min(520px, calc(100vh - 140px)); border-radius: 16px; overflow: hidden; box-shadow: 0 20px 48px rgba(0,0,0,.25); display: flex; flex-direction: column; backdrop-filter: saturate(1.1); }
      .cx-panel.cx-dark { background: #0b0f15; color: #e5e7eb; border: 1px solid rgba(255,255,255,.08); }
      .cx-panel.cx-light { background: #ffffff; color: #111827; border: 1px solid rgba(0,0,0,.08); }

      .cx-header { display: flex; align-items: center; justify-content: space-between; padding: 12px 14px; background: linear-gradient(0deg, transparent, rgba(0,0,0,0.04)); font-weight: 700; }
      .cx-title { display: flex; align-items: center; gap: 8px; }
      .cx-dot { width: 8px; height: 8px; background: var(--cx-primary); border-radius: 999px; box-shadow: 0 0 0 3px color-mix(in srgb, var(--cx-primary) 30%, transparent); }
      .cx-close { background: transparent; border: 0; font-size: 18px; line-height: 1; cursor: pointer; color: inherit; }

      .cx-messages { flex: 1; overflow-y: auto; padding: 14px; display: flex; flex-direction: column; gap: 10px; }
      .cx-msg { max-width: 85%; border-radius: 14px; padding: 10px 12px; word-wrap: break-word; white-space: pre-wrap; box-shadow: 0 2px 8px rgba(0,0,0,.06); }
      .cx-msg.user { margin-left: auto; background: color-mix(in srgb, var(--cx-primary) 18%, #f4f6fb); color: inherit; }
      .cx-msg.bot  { margin-right: auto; background: color-mix(in srgb, var(--cx-primary) 6%, rgba(0,0,0,0.03)); }

      .cx-typing { font-size: 12px; opacity: .7; padding: 0 4px; }

      .cx-input { border-top: 1px solid rgba(0,0,0,.06); padding: 10px; display: flex; align-items: flex-end; gap: 8px; }
      .cx-textarea { flex: 1; resize: none; max-height: 120px; min-height: 36px; border-radius: 12px; border: 1px solid rgba(0,0,0,.12); padding: 8px 10px; font: inherit; }
      .cx-send { background: var(--cx-primary); color: #fff; border: 0; border-radius: 12px; padding: 10px 14px; font-weight: 700; cursor: pointer; }
      .cx-send:disabled { opacity: .6; cursor: not-allowed; }

      @media (max-width: 420px) {
        .cx-panel { bottom: 84px; ${cfg.position}: 10px; width: calc(100vw - 20px); height: min(520px, calc(100vh - 120px)); }
        .cx-bubble { bottom: 14px; ${cfg.position}: 14px; }
      }
    `;
    document.head.appendChild(style);
  }

  // ----------------------
  // DOM
  // ----------------------
  const root = document.createElement('div');
  root.className = 'cx-widget';
  root.setAttribute('aria-live', 'polite');

  const bubble = document.createElement('button');
  bubble.className = 'cx-bubble';
  bubble.setAttribute('aria-label', 'Открыть чат');
  bubble.innerHTML = `<svg viewBox="0 0 24 24" width="18" height="18" aria-hidden="true"><path fill="currentColor" d="M20 2H4a2 2 0 0 0-2 2v14l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2z"/></svg><span>Чат</span><span class="cx-unread cx-hidden" data-unread>0</span>`;

  const panel = document.createElement('section');
  panel.className = `cx-panel ${prefersDark() ? 'cx-dark' : 'cx-light'}`;
  panel.setAttribute('role', 'dialog');
  panel.setAttribute('aria-label', 'Окно чата');
  panel.style.display = 'none';

  const header = document.createElement('div');
  header.className = 'cx-header';
  header.innerHTML = `
    <div class="cx-title">
      <span class="cx-dot"></span>
      <span>${escapeHtml(cfg.title)}</span>
    </div>
    <button class="cx-close" title="Закрыть" aria-label="Закрыть">×</button>
  `;

  const messages = document.createElement('div');
  messages.className = 'cx-messages';

  const typing = document.createElement('div');
  typing.className = 'cx-typing cx-hidden';
  typing.textContent = 'Печатает…';

  const input = document.createElement('div');
  input.className = 'cx-input';
  input.innerHTML = `
    <textarea class="cx-textarea" rows="1" placeholder="Введите сообщение…"></textarea>
    <button class="cx-send" disabled>Отправить</button>
  `;

  panel.appendChild(header);
  panel.appendChild(messages);
  panel.appendChild(typing);
  panel.appendChild(input);
  root.appendChild(bubble);
  root.appendChild(panel);
  document.body.appendChild(root);

  // ----------------------
  // ЛОГИКА
  // ----------------------
  const unreadBadge = bubble.querySelector('[data-unread]');
  const ta = input.querySelector('.cx-textarea');
  const sendBtn = input.querySelector('.cx-send');
  const closeBtn = header.querySelector('.cx-close');

  let open = false;
  let unread = 0;
  let log = loadLog();

  const updateUnread = (n) => {
    unread = Math.max(0, n);
    if (unread > 0 && !open) {
      unreadBadge.textContent = String(unread);
      unreadBadge.classList.remove('cx-hidden');
    } else {
      unreadBadge.classList.add('cx-hidden');
    }
  };

  const scrollToBottom = () => {
    messages.scrollTop = messages.scrollHeight + 200;
  };

  const addMsg = (role, text) => {
    const item = document.createElement('div');
    item.className = `cx-msg ${role}`;
    item.innerHTML = escapeHtml(text);
    messages.appendChild(item);
    log.push({ t: Date.now(), role, text });
    if (log.length > 500) log = log.slice(-500);
    saveLog(log);
    if (role === 'bot' && !open) updateUnread(unread + 1);
    scrollToBottom();
  };

  const restore = () => {
    if (log.length === 0 && cfg.welcome) {
      addMsg('bot', cfg.welcome);
    } else {
      for (const m of log) addMsg(m.role, m.text);
    }
  };

  const setTyping = (v) => {
    typing.classList.toggle('cx-hidden', !v);
    if (v) scrollToBottom();
  };

  const openPanel = () => {
    panel.style.display = 'flex';
    open = true;
    updateUnread(0);
    ta.focus();
    scrollToBottom();
  };
  const closePanel = () => {
    panel.style.display = 'none';
    open = false;
  };

  bubble.addEventListener('click', () => {
    if (open) closePanel(); else openPanel();
  });
  closeBtn.addEventListener('click', closePanel);

  ta.addEventListener('input', () => {
    sendBtn.disabled = ta.value.trim().length === 0;
    // авто-рост
    ta.style.height = 'auto';
    ta.style.height = Math.min(120, ta.scrollHeight) + 'px';
  });

  ta.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!sendBtn.disabled) sendBtn.click();
    }
  });

  const postMessage = async (text) => {
    const payload = { message: text, sessionId, website: cfg.website, ts: Date.now() };
    if (!cfg.endpoint) {
      // ДЕМО: эхо-ответ + имитация задержки
      await new Promise(r => setTimeout(r, 500 + Math.random()*700));
      return { ok: true, reply: `Вы написали: ${text}` };
    }
    try {
      const res = await fetch(cfg.endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json().catch(() => ({}));
      return { ok: true, reply: data.reply || data.text || 'Спасибо! Мы ответим вам в ближайшее время.' };
    } catch (err) {
      console.warn('[cx] endpoint error:', err);
      return { ok: false, reply: 'К сожалению, сервер недоступен. Попробуйте позже.' };
    }
  };

  const send = async () => {
    const text = ta.value.trim();
    if (!text) return;
    ta.value = '';
    ta.style.height = '36px';
    sendBtn.disabled = true;
    addMsg('user', text);
    setTyping(true);
    const resp = await postMessage(text);
    setTyping(false);
    addMsg('bot', resp.reply);
  };

  sendBtn.addEventListener('click', send);

  // Инициализация
  restore();

  // Переключение темы на лету при смене системной темы
  if (window.matchMedia) {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', (e) => {
      panel.classList.toggle('cx-dark', e.matches);
      panel.classList.toggle('cx-light', !e.matches);
    });
  }
})();
