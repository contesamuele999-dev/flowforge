// engine.js - Motore di esecuzione dei workflow (+ nodi integrazione nativi)
// Modello dati: workflow = { id, name, active, nodes: [...], connections: [...] }
// node = { id, type, name, position: {x,y}, parameters: {...} }
// connection = { from: nodeId, fromOutput: 0|1, to: nodeId }
// I dati fluiscono come array di "items" (oggetti JSON), come in n8n ($json).

const vm = require('vm');

const TRIGGER_TYPES = ['manualTrigger', 'webhook', 'schedule'];

// Variabili globali dell'esecuzione corrente, accessibili come {{ $vars.NOME }}
let _runtimeVars = {};

// ---- Espressioni: {{ $json.campo }} ----
function resolveExpression(template, item, allData) {
  if (typeof template !== 'string') return template;
  // Se l'intera stringa è una sola espressione, restituisci il valore nativo.
  // (il controllo !includes('}}') evita di confondere "{{ a }}-{{ b }}" con una sola espressione)
  const fullMatch = template.match(/^\{\{([\s\S]+)\}\}$/);
  if (fullMatch && !fullMatch[1].includes('}}')) {
    return evalExpr(fullMatch[1], item, allData);
  }
  return template.replace(/\{\{([\s\S]+?)\}\}/g, (_, expr) => {
    const v = evalExpr(expr, item, allData);
    return v === undefined || v === null ? '' : (typeof v === 'object' ? JSON.stringify(v) : String(v));
  });
}

function evalExpr(expr, item, allData) {
  try {
    const sandbox = {
      $json: item || {},
      $now: new Date().toISOString(),
      $node: allData || {},
      $vars: _runtimeVars,
      Math, JSON, Date, String, Number, Boolean, Array, Object,
    };
    return vm.runInNewContext(`(${expr})`, sandbox, { timeout: 1000 });
  } catch (e) {
    return undefined;
  }
}

// ---- Helper HTTP per i nodi di integrazione ----
async function httpJson(url, { method = 'GET', headers = {}, body, timeout = 30000 } = {}) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const opts = { method, headers, signal: controller.signal };
    if (body !== undefined && body !== null && !['GET', 'HEAD'].includes(method)) {
      opts.body = typeof body === 'string' ? body : JSON.stringify(body);
    }
    const res = await fetch(url, opts);
    const text = await res.text();
    let data;
    try { data = text ? JSON.parse(text) : {}; } catch { data = text; }
    if (res.status >= 400) {
      let msg = res.statusText || ('HTTP ' + res.status);
      if (data && data.error) msg = typeof data.error === 'string' ? data.error : (data.error.message || JSON.stringify(data.error));
      else if (typeof data === 'string' && data) msg = data.slice(0, 300);
      throw new Error(`HTTP ${res.status}: ${msg}`);
    }
    return { statusCode: res.status, body: data };
  } finally {
    clearTimeout(timer);
  }
}

// ---- Esecutori dei nodi ----
const executors = {
  manualTrigger: async (node, items) => items.length ? items : [{}],
  webhook: async (node, items) => items.length ? items : [{}],
  schedule: async (node, items) => items.length ? items : [{ timestamp: new Date().toISOString() }],

  httpRequest: async (node, items, ctx) => {
    const p = node.parameters || {};
    const out = [];
    for (const item of items) {
      const url = resolveExpression(p.url || '', item, ctx.nodeData);
      if (!url) throw new Error('URL mancante nel nodo HTTP Request');
      const method = (p.method || 'GET').toUpperCase();
      const headers = {};
      for (const h of (p.headers || [])) {
        if (h.name) headers[h.name] = resolveExpression(h.value || '', item, ctx.nodeData);
      }
      const options = { method, headers };
      if (!['GET', 'HEAD'].includes(method) && p.body) {
        const bodyStr = resolveExpression(p.body, item, ctx.nodeData);
        options.body = typeof bodyStr === 'object' ? JSON.stringify(bodyStr) : bodyStr;
        if (!headers['Content-Type'] && !headers['content-type']) headers['Content-Type'] = 'application/json';
      }
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 30000);
      options.signal = controller.signal;
      try {
        const res = await fetch(url, options);
        const text = await res.text();
        let body;
        try { body = JSON.parse(text); } catch { body = text; }
        out.push({ statusCode: res.status, body, headers: Object.fromEntries(res.headers.entries()) });
      } finally {
        clearTimeout(timer);
      }
    }
    return out;
  },

  code: async (node, items, ctx) => {
    const p = node.parameters || {};
    const userCode = p.code || 'return items;';
    const logs = [];
    const sandbox = {
      items: JSON.parse(JSON.stringify(items)),
      console: { log: (...a) => logs.push(a.map(x => typeof x === 'object' ? JSON.stringify(x) : String(x)).join(' ')) },
      Math, JSON, Date, String, Number, Boolean, Array, Object, Buffer,
      $node: ctx.nodeData,
      $vars: _runtimeVars,
    };
    const script = new vm.Script(`(function(){ ${userCode} })()`);
    const result = script.runInNewContext(sandbox, { timeout: 5000 });
    ctx.logs = logs;
    if (result === undefined || result === null) return [];
    const arr = Array.isArray(result) ? result : [result];
    return arr.map(x => (typeof x === 'object' && x !== null) ? x : { value: x });
  },

  if: async (node, items, ctx) => {
    const p = node.parameters || {};
    const trueItems = [], falseItems = [];
    for (const item of items) {
      let v1 = resolveExpression(p.value1 || '', item, ctx.nodeData);
      let v2 = resolveExpression(p.value2 || '', item, ctx.nodeData);
      let pass = false;
      switch (p.operator || 'equals') {
        case 'equals': pass = String(v1) === String(v2); break;
        case 'notEquals': pass = String(v1) !== String(v2); break;
        case 'contains': pass = String(v1).includes(String(v2)); break;
        case 'notContains': pass = !String(v1).includes(String(v2)); break;
        case 'gt': pass = Number(v1) > Number(v2); break;
        case 'lt': pass = Number(v1) < Number(v2); break;
        case 'gte': pass = Number(v1) >= Number(v2); break;
        case 'lte': pass = Number(v1) <= Number(v2); break;
        case 'isEmpty': pass = v1 === undefined || v1 === null || v1 === ''; break;
        case 'isNotEmpty': pass = !(v1 === undefined || v1 === null || v1 === ''); break;
        default: pass = false;
      }
      (pass ? trueItems : falseItems).push(item);
    }
    // Output multipli: indice 0 = true, indice 1 = false
    return { multi: [trueItems, falseItems] };
  },

  set: async (node, items, ctx) => {
    const p = node.parameters || {};
    return items.map(item => {
      const base = p.keepOnlySet ? {} : { ...item };
      for (const f of (p.fields || [])) {
        if (f.name) base[f.name] = resolveExpression(f.value, item, ctx.nodeData);
      }
      return base;
    });
  },

  filter: async (node, items, ctx) => {
    const p = node.parameters || {};
    const res = await executors.if({ parameters: p }, items, ctx);
    return res.multi[0];
  },

  delay: async (node, items) => {
    const ms = Math.min(Number(node.parameters?.ms) || 1000, 30000);
    await new Promise(r => setTimeout(r, ms));
    return items;
  },

  merge: async (node, items) => items,

  // ===== Integrazioni native =====

  // Genera un access token OAuth2 Google dal refresh token
  googleToken: async (node, items, ctx) => {
    const p = node.parameters || {};
    const out = [];
    for (const item of items) {
      const form = new URLSearchParams({
        client_id: resolveExpression(p.clientId || '', item, ctx.nodeData),
        client_secret: resolveExpression(p.clientSecret || '', item, ctx.nodeData),
        refresh_token: resolveExpression(p.refreshToken || '', item, ctx.nodeData),
        grant_type: 'refresh_token',
      }).toString();
      const r = await httpJson('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: form,
      });
      out.push({ access_token: r.body.access_token, expires_in: r.body.expires_in, token_type: r.body.token_type });
    }
    return out;
  },

  // Chiamata a un LLM: OpenAI / Anthropic / Gemini / OpenRouter
  llm: async (node, items, ctx) => {
    const p = node.parameters || {};
    const out = [];
    for (const item of items) {
      const provider = p.provider || 'openai';
      const apiKey = resolveExpression(p.apiKey || '', item, ctx.nodeData);
      const model = resolveExpression(p.model || '', item, ctx.nodeData);
      const system = resolveExpression(p.system || '', item, ctx.nodeData);
      const prompt = resolveExpression(p.prompt || '', item, ctx.nodeData);
      const maxTokens = Number(p.maxTokens) || 1024;
      let url, headers, body, extract;
      if (provider === 'anthropic') {
        url = 'https://api.anthropic.com/v1/messages';
        headers = { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' };
        body = { model, max_tokens: maxTokens, messages: [{ role: 'user', content: prompt }] };
        if (system) body.system = system;
        extract = (d) => d.content?.[0]?.text || '';
      } else if (provider === 'gemini') {
        url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${encodeURIComponent(apiKey)}`;
        headers = { 'Content-Type': 'application/json' };
        body = { contents: [{ parts: [{ text: prompt }] }] };
        if (system) body.systemInstruction = { parts: [{ text: system }] };
        extract = (d) => d.candidates?.[0]?.content?.parts?.[0]?.text || '';
      } else {
        url = provider === 'openrouter'
          ? 'https://openrouter.ai/api/v1/chat/completions'
          : 'https://api.openai.com/v1/chat/completions';
        headers = { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' };
        const messages = [];
        if (system) messages.push({ role: 'system', content: system });
        messages.push({ role: 'user', content: prompt });
        body = { model, messages };
        extract = (d) => d.choices?.[0]?.message?.content || '';
      }
      const r = await httpJson(url, { method: 'POST', headers, body });
      out.push({ risposta: extract(r.body), model, provider, raw: r.body });
    }
    return out;
  },

  // Gmail: invia / cerca / leggi
  gmail: async (node, items, ctx) => {
    const p = node.parameters || {};
    const out = [];
    for (const item of items) {
      const token = resolveExpression(p.accessToken || '', item, ctx.nodeData);
      const auth = { 'Authorization': `Bearer ${token}` };
      const op = p.operation || 'send';
      if (op === 'send') {
        const to = resolveExpression(p.to || '', item, ctx.nodeData);
        const subject = resolveExpression(p.subject || '', item, ctx.nodeData);
        const text = resolveExpression(p.text || '', item, ctx.nodeData);
        const mime = `To: ${to}\r\nSubject: ${subject}\r\nContent-Type: text/plain; charset="UTF-8"\r\n\r\n${text}`;
        const raw = Buffer.from(mime, 'utf8').toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
        const r = await httpJson('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
          method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' }, body: { raw },
        });
        out.push({ id: r.body.id, threadId: r.body.threadId, sent: true });
      } else if (op === 'search') {
        const q = resolveExpression(p.query || '', item, ctx.nodeData);
        const max = Number(p.maxResults) || 10;
        const r = await httpJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages?q=${encodeURIComponent(q)}&maxResults=${max}`, { headers: auth });
        const list = r.body.messages || [];
        for (const m of list) out.push({ id: m.id, threadId: m.threadId });
        if (!list.length) out.push({ messages: [], count: 0 });
      } else if (op === 'get') {
        const id = resolveExpression(p.messageId || '', item, ctx.nodeData);
        const r = await httpJson(`https://gmail.googleapis.com/gmail/v1/users/me/messages/${id}?format=full`, { headers: auth });
        const msg = r.body;
        const hs = Object.fromEntries((msg.payload?.headers || []).map(h => [h.name, h.value]));
        out.push({ id: msg.id, snippet: msg.snippet, from: hs.From, subject: hs.Subject, date: hs.Date });
      }
    }
    return out;
  },

  // Email transazionale: Resend / SendGrid
  email: async (node, items, ctx) => {
    const p = node.parameters || {};
    const out = [];
    for (const item of items) {
      const provider = p.provider || 'resend';
      const apiKey = resolveExpression(p.apiKey || '', item, ctx.nodeData);
      const from = resolveExpression(p.from || '', item, ctx.nodeData);
      const to = resolveExpression(p.to || '', item, ctx.nodeData);
      const subject = resolveExpression(p.subject || '', item, ctx.nodeData);
      const html = resolveExpression(p.html || '', item, ctx.nodeData);
      if (provider === 'sendgrid') {
        await httpJson('https://api.sendgrid.com/v3/mail/send', {
          method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: { personalizations: [{ to: [{ email: to }] }], from: { email: from }, subject, content: [{ type: 'text/html', value: html }] },
        });
        out.push({ sent: true, provider: 'sendgrid', to });
      } else {
        const r = await httpJson('https://api.resend.com/emails', {
          method: 'POST', headers: { 'Authorization': `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
          body: { from, to: [to], subject, html },
        });
        out.push({ id: r.body.id, sent: true, provider: 'resend', to });
      }
    }
    return out;
  },

  // Google Drive: elenca / scarica / crea cartella / crea file
  googleDrive: async (node, items, ctx) => {
    const p = node.parameters || {};
    const out = [];
    for (const item of items) {
      const token = resolveExpression(p.accessToken || '', item, ctx.nodeData);
      const auth = { 'Authorization': `Bearer ${token}` };
      const op = p.operation || 'list';
      if (op === 'list') {
        const q = resolveExpression(p.query || '', item, ctx.nodeData);
        const url = `https://www.googleapis.com/drive/v3/files?pageSize=${Number(p.pageSize) || 20}&fields=files(id,name,mimeType,modifiedTime)${q ? `&q=${encodeURIComponent(q)}` : ''}`;
        const r = await httpJson(url, { headers: auth });
        const files = r.body.files || [];
        for (const f of files) out.push(f);
        if (!files.length) out.push({ files: [], count: 0 });
      } else if (op === 'download') {
        const id = resolveExpression(p.fileId || '', item, ctx.nodeData);
        const r = await httpJson(`https://www.googleapis.com/drive/v3/files/${id}?alt=media`, { headers: auth });
        out.push({ fileId: id, content: r.body });
      } else if (op === 'createFolder') {
        const name = resolveExpression(p.name || '', item, ctx.nodeData);
        const r = await httpJson('https://www.googleapis.com/drive/v3/files', {
          method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
          body: { name, mimeType: 'application/vnd.google-apps.folder' },
        });
        out.push({ id: r.body.id, name: r.body.name });
      } else if (op === 'createFile') {
        const name = resolveExpression(p.name || '', item, ctx.nodeData);
        const content = resolveExpression(p.content || '', item, ctx.nodeData);
        const boundary = 'ffboundary' + Date.now();
        const multipart = `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify({ name })}\r\n--${boundary}\r\nContent-Type: text/plain\r\n\r\n${content}\r\n--${boundary}--`;
        const r = await httpJson('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
          method: 'POST', headers: { ...auth, 'Content-Type': `multipart/related; boundary=${boundary}` }, body: multipart,
        });
        out.push({ id: r.body.id, name: r.body.name });
      }
    }
    return out;
  },

  // Google Calendar: elenca / crea evento
  googleCalendar: async (node, items, ctx) => {
    const p = node.parameters || {};
    const out = [];
    for (const item of items) {
      const token = resolveExpression(p.accessToken || '', item, ctx.nodeData);
      const auth = { 'Authorization': `Bearer ${token}` };
      const cal = resolveExpression(p.calendarId || 'primary', item, ctx.nodeData) || 'primary';
      const op = p.operation || 'list';
      if (op === 'list') {
        const url = `https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal)}/events?timeMin=${encodeURIComponent(new Date().toISOString())}&singleEvents=true&orderBy=startTime&maxResults=${Number(p.maxResults) || 10}`;
        const r = await httpJson(url, { headers: auth });
        const evs = r.body.items || [];
        for (const e of evs) out.push({ id: e.id, summary: e.summary, start: e.start?.dateTime || e.start?.date, end: e.end?.dateTime || e.end?.date, htmlLink: e.htmlLink });
        if (!evs.length) out.push({ events: [], count: 0 });
      } else if (op === 'create') {
        const tz = resolveExpression(p.timeZone || 'Europe/Rome', item, ctx.nodeData) || 'Europe/Rome';
        const r = await httpJson(`https://www.googleapis.com/calendar/v3/calendars/${encodeURIComponent(cal)}/events`, {
          method: 'POST', headers: { ...auth, 'Content-Type': 'application/json' },
          body: {
            summary: resolveExpression(p.summary || '', item, ctx.nodeData),
            description: resolveExpression(p.description || '', item, ctx.nodeData),
            start: { dateTime: resolveExpression(p.start || '', item, ctx.nodeData), timeZone: tz },
            end: { dateTime: resolveExpression(p.end || '', item, ctx.nodeData), timeZone: tz },
          },
        });
        out.push({ id: r.body.id, htmlLink: r.body.htmlLink, summary: r.body.summary });
      }
    }
    return out;
  },

  // Fathom: elenca meeting (con trascrizione/highlights) o team
  fathom: async (node, items, ctx) => {
    const p = node.parameters || {};
    const out = [];
    for (const item of items) {
      const key = resolveExpression(p.apiKey || '', item, ctx.nodeData);
      const auth = { 'Authorization': `Bearer ${key}` };
      const op = p.operation || 'listMeetings';
      if (op === 'listTeams') {
        const r = await httpJson('https://api.fathom.ai/external/v1/teams', { headers: auth });
        const arr = r.body.items || (Array.isArray(r.body) ? r.body : []);
        for (const t of arr) out.push(t);
        if (!arr.length) out.push({ teams: [], count: 0 });
      } else {
        const params = [];
        if (p.includeTranscript) params.push('include_transcript=true');
        if (p.includeHighlights) params.push('include_highlights=true');
        const after = resolveExpression(p.createdAfter || '', item, ctx.nodeData);
        if (after) params.push('created_after=' + encodeURIComponent(after));
        const url = 'https://api.fathom.ai/external/v1/meetings' + (params.length ? '?' + params.join('&') : '');
        const r = await httpJson(url, { headers: auth });
        const arr = r.body.items || [];
        for (const m of arr) out.push(m);
        if (!arr.length) out.push({ meetings: [], count: 0 });
      }
    }
    return out;
  },

  // ===== Messaggistica =====

  // Telegram Bot API: invia un messaggio
  telegram: async (node, items, ctx) => {
    const p = node.parameters || {};
    const out = [];
    for (const item of items) {
      const token = resolveExpression(p.botToken || '', item, ctx.nodeData);
      const chatId = resolveExpression(p.chatId || '', item, ctx.nodeData);
      const text = resolveExpression(p.text || '', item, ctx.nodeData);
      if (!token) throw new Error('Bot token mancante nel nodo Telegram');
      if (!chatId) throw new Error('Chat ID mancante nel nodo Telegram');
      const body = { chat_id: chatId, text };
      if (p.parseMode && p.parseMode !== 'none') body.parse_mode = p.parseMode;
      if (p.disablePreview) body.disable_web_page_preview = true;
      const r = await httpJson(`https://api.telegram.org/bot${token}/sendMessage`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
      });
      out.push({ sent: true, messageId: r.body.result?.message_id, chatId, raw: r.body });
    }
    return out;
  },

  // Discord: invia un messaggio tramite webhook
  discord: async (node, items, ctx) => {
    const p = node.parameters || {};
    const out = [];
    for (const item of items) {
      const url = resolveExpression(p.webhookUrl || '', item, ctx.nodeData);
      const content = resolveExpression(p.content || '', item, ctx.nodeData);
      if (!url) throw new Error('Webhook URL mancante nel nodo Discord');
      const body = { content };
      const username = resolveExpression(p.username || '', item, ctx.nodeData);
      if (username) body.username = username;
      // wait=true fa sì che Discord restituisca il messaggio creato
      const res = await fetch(url + (url.includes('?') ? '&' : '?') + 'wait=true', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body),
      });
      const text = await res.text();
      let data; try { data = text ? JSON.parse(text) : {}; } catch { data = text; }
      if (res.status >= 400) throw new Error(`Discord HTTP ${res.status}: ${typeof data === 'string' ? data.slice(0, 200) : JSON.stringify(data)}`);
      out.push({ sent: true, messageId: data.id, raw: data });
    }
    return out;
  },

  // ===== Social / contenuti =====

  // Placid: genera un'immagine o PDF da un template
  placid: async (node, items, ctx) => {
    const p = node.parameters || {};
    const out = [];
    for (const item of items) {
      const token = resolveExpression(p.apiToken || '', item, ctx.nodeData);
      const templateId = resolveExpression(p.templateId || '', item, ctx.nodeData);
      if (!token) throw new Error('API token mancante nel nodo Placid');
      let layers = {};
      const rawLayers = resolveExpression(p.layers || '', item, ctx.nodeData);
      if (rawLayers) {
        try { layers = typeof rawLayers === 'object' ? rawLayers : JSON.parse(rawLayers); }
        catch (e) { throw new Error('Layers Placid: JSON non valido (' + e.message + ')'); }
      }
      const kind = (p.kind || 'image') === 'pdf' ? 'pdfs' : 'images';
      const r = await httpJson(`https://api.placid.app/api/rest/${kind}`, {
        method: 'POST',
        headers: { 'Authorization': `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: { template_uuid: templateId, layers },
      });
      out.push({ id: r.body.id, status: r.body.status, url: r.body.image_url || r.body.pdf_url || r.body.url, raw: r.body });
    }
    return out;
  },

  // Metricool: programma un post sui social (scheduler)
  metricool: async (node, items, ctx) => {
    const p = node.parameters || {};
    const out = [];
    for (const item of items) {
      const userToken = resolveExpression(p.userToken || '', item, ctx.nodeData);
      const userId = resolveExpression(p.userId || '', item, ctx.nodeData);
      const blogId = resolveExpression(p.blogId || '', item, ctx.nodeData);
      const text = resolveExpression(p.text || '', item, ctx.nodeData);
      const date = resolveExpression(p.publicationDate || '', item, ctx.nodeData);
      if (!userToken || !userId || !blogId) throw new Error('Metricool richiede userToken, userId e blogId');
      const providers = String(p.networks || 'twitter').split(',').map(s => s.trim()).filter(Boolean).map(network => ({ network }));
      const body = {
        autoPublish: p.autoPublish !== false,
        text,
        providers,
        publicationDate: date ? { dateTime: date, timezone: p.timezone || 'Europe/Rome' } : undefined,
      };
      const mediaUrl = resolveExpression(p.mediaUrl || '', item, ctx.nodeData);
      if (mediaUrl) body.media = [mediaUrl];
      const url = `https://app.metricool.com/api/v2/scheduler/posts?blogId=${encodeURIComponent(blogId)}&userId=${encodeURIComponent(userId)}&userToken=${encodeURIComponent(userToken)}`;
      const r = await httpJson(url, {
        method: 'POST', headers: { 'Content-Type': 'application/json', 'X-Mc-Auth': userToken }, body,
      });
      out.push({ scheduled: true, id: r.body.id || r.body.data?.id, raw: r.body });
    }
    return out;
  },
};

// ---- Esecuzione del workflow ----
async function executeWorkflow(workflow, triggerData, triggerNodeId, vars) {
  _runtimeVars = vars || {};
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const nodes = workflow.nodes || [];
  const connections = workflow.connections || [];
  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  // Trova il nodo trigger di partenza
  let trigger = triggerNodeId ? nodeMap.get(triggerNodeId) : nodes.find(n => TRIGGER_TYPES.includes(n.type));
  const result = {
    id: 'exec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    workflowId: workflow.id,
    workflowName: workflow.name,
    startedAt,
    status: 'success',
    nodeResults: [],
  };

  if (!trigger) {
    result.status = 'error';
    result.error = 'Nessun nodo trigger nel workflow (aggiungi Manual Trigger, Webhook o Schedule)';
    result.durationMs = Date.now() - t0;
    return result;
  }

  // Coda di esecuzione: { nodeId, items }
  // nodeData: output di ogni nodo per nome (accessibile nelle espressioni via $node["Nome"])
  const nodeData = {};
  const inputBuffer = new Map(); // nodeId -> items accumulati (per merge)
  const queue = [{ nodeId: trigger.id, items: [triggerData && Object.keys(triggerData).length ? triggerData : {}] }];
  const executedCount = new Map();
  const MAX_NODE_EXECUTIONS = 100; // protezione anti-loop

  while (queue.length > 0) {
    const { nodeId, items } = queue.shift();
    const node = nodeMap.get(nodeId);
    if (!node) continue;

    const count = (executedCount.get(nodeId) || 0) + 1;
    executedCount.set(nodeId, count);
    if (count > MAX_NODE_EXECUTIONS) {
      result.status = 'error';
      result.error = `Loop rilevato sul nodo "${node.name}"`;
      break;
    }

    const executor = executors[node.type];
    const nodeResult = { nodeId: node.id, nodeName: node.name, type: node.type, status: 'success', input: items };
    const nt0 = Date.now();

    if (node.disabled) {
      nodeResult.status = 'skipped';
      nodeResult.output = items;
      result.nodeResults.push(nodeResult);
      enqueueNext(node.id, 0, items);
      continue;
    }

    if (!executor) {
      nodeResult.status = 'error';
      nodeResult.error = `Tipo di nodo sconosciuto: ${node.type}`;
      result.nodeResults.push(nodeResult);
      result.status = 'error';
      result.error = nodeResult.error;
      break;
    }

    try {
      const ctx = { nodeData, workflow };
      const output = await executor(node, items, ctx);
      nodeResult.durationMs = Date.now() - nt0;
      if (ctx.logs && ctx.logs.length) nodeResult.logs = ctx.logs;

      if (output && output.multi) {
        // Nodo con output multipli (IF): indice 0 = true, 1 = false
        nodeResult.output = { true: output.multi[0], false: output.multi[1] };
        nodeData[node.name] = output.multi[0];
        output.multi.forEach((branchItems, idx) => {
          if (branchItems.length > 0) enqueueNext(node.id, idx, branchItems);
        });
      } else {
        nodeResult.output = output;
        nodeData[node.name] = output;
        if (output.length > 0 || node.type === 'merge') enqueueNext(node.id, 0, output);
        else if (output.length === 0) {
          // Propaga comunque per i nodi successivi se è un trigger
          if (TRIGGER_TYPES.includes(node.type)) enqueueNext(node.id, 0, [{}]);
        }
      }
      result.nodeResults.push(nodeResult);
    } catch (e) {
      nodeResult.status = 'error';
      nodeResult.error = e.message;
      nodeResult.durationMs = Date.now() - nt0;
      result.nodeResults.push(nodeResult);
      result.status = 'error';
      result.error = `Errore nel nodo "${node.name}": ${e.message}`;
      break;
    }
  }

  function enqueueNext(fromId, outputIndex, items) {
    for (const c of connections) {
      if (c.from === fromId && (c.fromOutput || 0) === outputIndex) {
        const target = nodeMap.get(c.to);
        if (!target) continue;
        if (target.type === 'merge') {
          // Accumula input finché tutti i rami in ingresso hanno prodotto
          const buf = inputBuffer.get(c.to) || [];
          buf.push(...items);
          inputBuffer.set(c.to, buf);
          const incoming = connections.filter(x => x.to === c.to).length;
          const arrived = (inputBuffer.get(c.to + '_count') || 0) + 1;
          inputBuffer.set(c.to + '_count', arrived);
          if (arrived >= incoming) {
            queue.push({ nodeId: c.to, items: buf });
            inputBuffer.delete(c.to);
            inputBuffer.delete(c.to + '_count');
          }
        } else {
          queue.push({ nodeId: c.to, items });
        }
      }
    }
  }

  result.durationMs = Date.now() - t0;
  result.finishedAt = new Date().toISOString();
  // Output finale = output dell'ultimo nodo eseguito con successo
  const last = [...result.nodeResults].reverse().find(r => r.status === 'success');
  result.lastOutput = last ? last.output : null;
  return result;
}

// ---- Esecuzione di un singolo nodo (in isolamento) ----
// Esegue SOLO il nodo indicato, con gli item di input forniti (o [{}] di default).
// Non propaga ai nodi successivi. Utile per testare un blocco.
async function executeSingleNode(workflow, nodeId, inputItems, vars) {
  _runtimeVars = vars || {};
  const startedAt = new Date().toISOString();
  const t0 = Date.now();
  const node = (workflow.nodes || []).find(n => n.id === nodeId);
  const result = {
    id: 'exec_' + Date.now() + '_' + Math.random().toString(36).slice(2, 8),
    workflowId: workflow.id,
    workflowName: workflow.name,
    startedAt,
    status: 'success',
    single: true,
    nodeResults: [],
  };
  if (!node) {
    result.status = 'error';
    result.error = 'Nodo non trovato';
    result.durationMs = Date.now() - t0;
    return result;
  }

  const items = Array.isArray(inputItems) && inputItems.length ? inputItems : [{}];
  const nodeResult = { nodeId: node.id, nodeName: node.name, type: node.type, status: 'success', input: items };
  const nt0 = Date.now();
  const executor = executors[node.type];

  if (node.disabled) {
    nodeResult.status = 'skipped';
    nodeResult.output = items;
  } else if (!executor) {
    nodeResult.status = 'error';
    nodeResult.error = `Tipo di nodo sconosciuto: ${node.type}`;
    result.status = 'error';
    result.error = nodeResult.error;
  } else {
    try {
      const ctx = { nodeData: {}, workflow };
      const output = await executor(node, items, ctx);
      if (ctx.logs && ctx.logs.length) nodeResult.logs = ctx.logs;
      nodeResult.output = (output && output.multi) ? { true: output.multi[0], false: output.multi[1] } : output;
    } catch (e) {
      nodeResult.status = 'error';
      nodeResult.error = e.message;
      result.status = 'error';
      result.error = `Errore nel nodo "${node.name}": ${e.message}`;
    }
  }
  nodeResult.durationMs = Date.now() - nt0;
  result.nodeResults.push(nodeResult);
  result.durationMs = Date.now() - t0;
  result.finishedAt = new Date().toISOString();
  result.lastOutput = nodeResult.output ?? null;
  return result;
}

module.exports = { executeWorkflow, executeSingleNode, TRIGGER_TYPES };
