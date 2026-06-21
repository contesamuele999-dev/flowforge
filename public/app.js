// FlowForge - Editor visuale di workflow
'use strict';

// ============ Registro dei tipi di nodo ============
const NODE_TYPES = {
  manualTrigger: {
    label: 'Manual Trigger', icon: '▶', color: 'var(--node-trigger)', category: 'Trigger',
    desc: 'Avvia il workflow manualmente con il pulsante Esegui',
    outputs: 1, inputs: 0,
    defaults: {},
    fields: [],
  },
  webhook: {
    label: 'Webhook', icon: '🌐', color: 'var(--node-trigger)', category: 'Trigger',
    desc: 'Avvia il workflow quando arriva una richiesta HTTP',
    outputs: 1, inputs: 0,
    defaults: { path: 'mio-hook', method: 'ANY' },
    fields: [
      { name: 'path', label: 'Path', type: 'text', hint: 'Il workflow risponderà su /webhook/<path> (workflow attivo richiesto)' },
      { name: 'method', label: 'Metodo HTTP', type: 'select', options: ['ANY', 'GET', 'POST', 'PUT', 'DELETE'] },
    ],
  },
  schedule: {
    label: 'Schedule', icon: '⏰', color: 'var(--node-trigger)', category: 'Trigger',
    desc: 'Esegue il workflow a intervalli regolari',
    outputs: 1, inputs: 0,
    defaults: { mode: 'everyMinutes', minutes: 5, hours: 1, time: '09:00' },
    fields: [
      { name: 'mode', label: 'Frequenza', type: 'select', options: [
        { v: 'everyMinutes', t: 'Ogni N minuti' }, { v: 'everyHours', t: 'Ogni N ore' }, { v: 'dailyAt', t: 'Ogni giorno alle' },
      ]},
      { name: 'minutes', label: 'Minuti', type: 'number', showIf: { mode: 'everyMinutes' } },
      { name: 'hours', label: 'Ore', type: 'number', showIf: { mode: 'everyHours' } },
      { name: 'time', label: 'Orario (HH:MM)', type: 'time', showIf: { mode: 'dailyAt' } },
    ],
  },
  httpRequest: {
    label: 'HTTP Request', icon: '🔗', color: 'var(--node-action)', category: 'Azioni',
    desc: 'Chiama una API o un sito web',
    outputs: 1, inputs: 1,
    defaults: { method: 'GET', url: '', headers: [], body: '' },
    fields: [
      { name: 'method', label: 'Metodo', type: 'select', options: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'] },
      { name: 'url', label: 'URL', type: 'text', hint: 'Supporta espressioni: https://api.example.com/{{ $json.id }}' },
      { name: 'headers', label: 'Headers', type: 'keyvalue' },
      { name: 'body', label: 'Body (JSON)', type: 'textarea', hint: 'Solo per POST/PUT/PATCH. Supporta {{ $json.campo }}' },
    ],
  },
  set: {
    label: 'Edit Fields', icon: '✏️', color: 'var(--node-action)', category: 'Azioni',
    desc: 'Aggiunge o modifica campi degli item',
    outputs: 1, inputs: 1,
    defaults: { fields: [], keepOnlySet: false },
    fields: [
      { name: 'fields', label: 'Campi (nome → valore)', type: 'keyvalue', keyLabel: 'nome', valLabel: 'valore', hint: 'Il valore supporta {{ $json.campo }}' },
      { name: 'keepOnlySet', label: 'Mantieni solo i campi impostati', type: 'checkbox' },
    ],
  },
  code: {
    label: 'Code', icon: '{ }', color: 'var(--node-code)', category: 'Azioni',
    desc: 'Esegui codice JavaScript sugli item',
    outputs: 1, inputs: 1,
    defaults: { code: '// items = array degli item in ingresso\n// Restituisci un array di oggetti\nreturn items.map(item => ({\n  ...item,\n  elaborato: true\n}));' },
    fields: [
      { name: 'code', label: 'JavaScript', type: 'textarea', hint: 'Variabile "items" disponibile. Usa "return" per l\'output. console.log() visibile nelle esecuzioni.' },
    ],
  },
  if: {
    label: 'IF', icon: '◆', color: 'var(--node-logic)', category: 'Logica',
    desc: 'Instrada gli item su due rami: vero / falso',
    outputs: 2, inputs: 1,
    defaults: { value1: '', operator: 'equals', value2: '' },
    fields: [
      { name: 'value1', label: 'Valore 1', type: 'text', hint: 'Es: {{ $json.status }}' },
      { name: 'operator', label: 'Operatore', type: 'select', options: [
        { v: 'equals', t: 'uguale a' }, { v: 'notEquals', t: 'diverso da' },
        { v: 'contains', t: 'contiene' }, { v: 'notContains', t: 'non contiene' },
        { v: 'gt', t: '>' }, { v: 'lt', t: '<' }, { v: 'gte', t: '≥' }, { v: 'lte', t: '≤' },
        { v: 'isEmpty', t: 'è vuoto' }, { v: 'isNotEmpty', t: 'non è vuoto' },
      ]},
      { name: 'value2', label: 'Valore 2', type: 'text' },
    ],
  },
  filter: {
    label: 'Filter', icon: '⧩', color: 'var(--node-logic)', category: 'Logica',
    desc: 'Lascia passare solo gli item che soddisfano la condizione',
    outputs: 1, inputs: 1,
    defaults: { value1: '', operator: 'equals', value2: '' },
    fields: [
      { name: 'value1', label: 'Valore 1', type: 'text', hint: 'Es: {{ $json.prezzo }}' },
      { name: 'operator', label: 'Operatore', type: 'select', options: [
        { v: 'equals', t: 'uguale a' }, { v: 'notEquals', t: 'diverso da' },
        { v: 'contains', t: 'contiene' }, { v: 'gt', t: '>' }, { v: 'lt', t: '<' },
        { v: 'isEmpty', t: 'è vuoto' }, { v: 'isNotEmpty', t: 'non è vuoto' },
      ]},
      { name: 'value2', label: 'Valore 2', type: 'text' },
    ],
  },
  merge: {
    label: 'Merge', icon: '⑃', color: 'var(--node-logic)', category: 'Logica',
    desc: 'Unisce gli item provenienti da più rami',
    outputs: 1, inputs: 1,
    defaults: {},
    fields: [],
  },
  delay: {
    label: 'Wait', icon: '⏸', color: 'var(--node-logic)', category: 'Logica',
    desc: 'Attende prima di proseguire',
    outputs: 1, inputs: 1,
    defaults: { ms: 1000 },
    fields: [
      { name: 'ms', label: 'Millisecondi (max 30000)', type: 'number' },
    ],
  },

  // ============ Integrazioni ============
  googleToken: {
    label: 'Google Token', icon: '🔑', color: 'var(--node-integration)', category: 'Integrazioni',
    desc: 'Genera un access token OAuth2 dal refresh token Google',
    outputs: 1, inputs: 1,
    defaults: {
      clientId: '{{ $node["Config"][0].google_client_id }}',
      clientSecret: '{{ $node["Config"][0].google_client_secret }}',
      refreshToken: '{{ $node["Config"][0].google_refresh_token }}',
    },
    fields: [
      { name: 'clientId', label: 'Client ID', type: 'text' },
      { name: 'clientSecret', label: 'Client secret', type: 'text' },
      { name: 'refreshToken', label: 'Refresh token', type: 'text', hint: 'Mettilo dopo un nodo "Config". Gmail/Drive/Calendar useranno {{ $node["Google Token"][0].access_token }}' },
    ],
  },
  llm: {
    label: 'LLM (AI)', icon: '✨', color: 'var(--node-integration)', category: 'Integrazioni',
    desc: 'Chiama OpenAI, Claude, Gemini o OpenRouter',
    outputs: 1, inputs: 1,
    defaults: { provider: 'openai', apiKey: '', model: 'gpt-4o-mini', system: '', prompt: '{{ $json.prompt }}', maxTokens: 1024 },
    fields: [
      { name: 'provider', label: 'Provider', type: 'select', options: [
        { v: 'openai', t: 'OpenAI' }, { v: 'anthropic', t: 'Anthropic (Claude)' }, { v: 'gemini', t: 'Google Gemini' }, { v: 'openrouter', t: 'OpenRouter' },
      ]},
      { name: 'apiKey', label: 'API Key', type: 'text', hint: 'Es: {{ $node["Config"][0].openai_key }} oppure incolla la chiave' },
      { name: 'model', label: 'Modello', type: 'text', hint: 'openai: gpt-4o-mini · anthropic: claude-sonnet-4-6 · gemini: gemini-2.5-flash · openrouter: provider/modello' },
      { name: 'system', label: 'System prompt (opzionale)', type: 'textarea' },
      { name: 'prompt', label: 'Prompt', type: 'textarea', hint: 'Supporta {{ $json.campo }}' },
      { name: 'maxTokens', label: 'Max tokens', type: 'number' },
    ],
  },
  gmail: {
    label: 'Gmail', icon: '📧', color: 'var(--node-integration)', category: 'Integrazioni',
    desc: 'Invia, cerca o leggi email da Gmail',
    outputs: 1, inputs: 1,
    defaults: { operation: 'send', accessToken: '{{ $node["Google Token"][0].access_token }}', to: '', subject: '', text: '', query: 'is:unread', maxResults: 10, messageId: '{{ $json.id }}' },
    fields: [
      { name: 'operation', label: 'Operazione', type: 'select', options: [
        { v: 'send', t: 'Invia email' }, { v: 'search', t: 'Cerca email' }, { v: 'get', t: 'Leggi messaggio' },
      ]},
      { name: 'accessToken', label: 'Access token Google', type: 'text', hint: 'Usa il nodo "Google Token"' },
      { name: 'to', label: 'A', type: 'text', showIf: { operation: 'send' } },
      { name: 'subject', label: 'Oggetto', type: 'text', showIf: { operation: 'send' } },
      { name: 'text', label: 'Testo', type: 'textarea', showIf: { operation: 'send' } },
      { name: 'query', label: 'Query Gmail (q)', type: 'text', hint: 'es: is:unread from:luca newer_than:1d', showIf: { operation: 'search' } },
      { name: 'maxResults', label: 'Max risultati', type: 'number', showIf: { operation: 'search' } },
      { name: 'messageId', label: 'ID messaggio', type: 'text', showIf: { operation: 'get' } },
    ],
  },
  email: {
    label: 'Email', icon: '✉️', color: 'var(--node-integration)', category: 'Integrazioni',
    desc: 'Invia email transazionali (Resend o SendGrid)',
    outputs: 1, inputs: 1,
    defaults: { provider: 'resend', apiKey: '', from: 'Nome <noreply@tuodominio.it>', to: '', subject: '', html: '<p>{{ $json.risposta }}</p>' },
    fields: [
      { name: 'provider', label: 'Provider', type: 'select', options: [ { v: 'resend', t: 'Resend' }, { v: 'sendgrid', t: 'SendGrid' } ] },
      { name: 'apiKey', label: 'API Key', type: 'text', hint: 'Es: {{ $node["Config"][0].resend_key }}' },
      { name: 'from', label: 'Da (from)', type: 'text' },
      { name: 'to', label: 'A (to)', type: 'text' },
      { name: 'subject', label: 'Oggetto', type: 'text' },
      { name: 'html', label: 'Corpo HTML', type: 'textarea' },
    ],
  },
  googleDrive: {
    label: 'Google Drive', icon: '📁', color: 'var(--node-integration)', category: 'Integrazioni',
    desc: 'Elenca, scarica o crea file/cartelle su Drive',
    outputs: 1, inputs: 1,
    defaults: { operation: 'list', accessToken: '{{ $node["Google Token"][0].access_token }}', query: '', pageSize: 20, fileId: '{{ $json.id }}', name: '', content: '' },
    fields: [
      { name: 'operation', label: 'Operazione', type: 'select', options: [
        { v: 'list', t: 'Elenca / cerca' }, { v: 'download', t: 'Scarica contenuto' }, { v: 'createFolder', t: 'Crea cartella' }, { v: 'createFile', t: 'Crea file di testo' },
      ]},
      { name: 'accessToken', label: 'Access token Google', type: 'text', hint: 'Usa il nodo "Google Token"' },
      { name: 'query', label: 'Query (q)', type: 'text', hint: "es: name contains 'report'", showIf: { operation: 'list' } },
      { name: 'pageSize', label: 'Max risultati', type: 'number', showIf: { operation: 'list' } },
      { name: 'fileId', label: 'ID file', type: 'text', showIf: { operation: 'download' } },
      { name: 'name', label: 'Nome cartella', type: 'text', showIf: { operation: 'createFolder' } },
      { name: 'name', label: 'Nome file', type: 'text', showIf: { operation: 'createFile' } },
      { name: 'content', label: 'Contenuto', type: 'textarea', showIf: { operation: 'createFile' } },
    ],
  },
  googleCalendar: {
    label: 'Google Calendar', icon: '📅', color: 'var(--node-integration)', category: 'Integrazioni',
    desc: 'Elenca o crea eventi su Google Calendar',
    outputs: 1, inputs: 1,
    defaults: { operation: 'list', accessToken: '{{ $node["Google Token"][0].access_token }}', calendarId: 'primary', maxResults: 10, summary: '', description: '', start: '', end: '', timeZone: 'Europe/Rome' },
    fields: [
      { name: 'operation', label: 'Operazione', type: 'select', options: [ { v: 'list', t: 'Prossimi eventi' }, { v: 'create', t: 'Crea evento' } ] },
      { name: 'accessToken', label: 'Access token Google', type: 'text', hint: 'Usa il nodo "Google Token"' },
      { name: 'calendarId', label: 'Calendar ID', type: 'text' },
      { name: 'maxResults', label: 'Max risultati', type: 'number', showIf: { operation: 'list' } },
      { name: 'summary', label: 'Titolo', type: 'text', showIf: { operation: 'create' } },
      { name: 'description', label: 'Descrizione', type: 'textarea', showIf: { operation: 'create' } },
      { name: 'start', label: 'Inizio (ISO)', type: 'text', hint: '2026-06-20T15:00:00', showIf: { operation: 'create' } },
      { name: 'end', label: 'Fine (ISO)', type: 'text', hint: '2026-06-20T16:00:00', showIf: { operation: 'create' } },
      { name: 'timeZone', label: 'Fuso orario', type: 'text', showIf: { operation: 'create' } },
    ],
  },
  fathom: {
    label: 'Fathom', icon: '🎙️', color: 'var(--node-integration)', category: 'Integrazioni',
    desc: 'Recupera meeting, trascrizioni e team da Fathom',
    outputs: 1, inputs: 1,
    defaults: { operation: 'listMeetings', apiKey: '{{ $node["Config"][0].fathom_key }}', includeTranscript: true, includeHighlights: false, createdAfter: '' },
    fields: [
      { name: 'operation', label: 'Operazione', type: 'select', options: [ { v: 'listMeetings', t: 'Elenca meeting' }, { v: 'listTeams', t: 'Elenca team' } ] },
      { name: 'apiKey', label: 'API Key Fathom', type: 'text', hint: 'Es: {{ $node["Config"][0].fathom_key }}' },
      { name: 'includeTranscript', label: 'Includi trascrizione', type: 'checkbox', showIf: { operation: 'listMeetings' } },
      { name: 'includeHighlights', label: 'Includi highlights', type: 'checkbox', showIf: { operation: 'listMeetings' } },
      { name: 'createdAfter', label: 'Creati dopo (ISO)', type: 'text', hint: '2026-06-01T00:00:00Z', showIf: { operation: 'listMeetings' } },
    ],
  },

  // ============ Messaggistica ============
  telegram: {
    label: 'Telegram', icon: '✈️', color: 'var(--node-message)', category: 'Messaggistica',
    desc: 'Invia un messaggio tramite un bot Telegram',
    outputs: 1, inputs: 1,
    defaults: { botToken: '{{ $vars.TELEGRAM_BOT_TOKEN }}', chatId: '', text: '{{ $json.risposta }}', parseMode: 'none', disablePreview: false },
    fields: [
      { name: 'botToken', label: 'Bot token', type: 'text', hint: 'Da @BotFather. Es: {{ $vars.TELEGRAM_BOT_TOKEN }}' },
      { name: 'chatId', label: 'Chat ID', type: 'text', hint: 'ID chat o @username del canale' },
      { name: 'text', label: 'Testo', type: 'textarea', hint: 'Supporta {{ $json.campo }}' },
      { name: 'parseMode', label: 'Formattazione', type: 'select', options: [
        { v: 'none', t: 'Nessuna' }, { v: 'Markdown', t: 'Markdown' }, { v: 'HTML', t: 'HTML' },
      ]},
      { name: 'disablePreview', label: 'Disabilita anteprima link', type: 'checkbox' },
    ],
  },
  discord: {
    label: 'Discord', icon: '🎮', color: 'var(--node-message)', category: 'Messaggistica',
    desc: 'Invia un messaggio su un canale Discord via webhook',
    outputs: 1, inputs: 1,
    defaults: { webhookUrl: '{{ $vars.DISCORD_WEBHOOK }}', content: '{{ $json.risposta }}', username: '' },
    fields: [
      { name: 'webhookUrl', label: 'Webhook URL', type: 'text', hint: 'Impostazioni canale → Integrazioni → Webhook' },
      { name: 'content', label: 'Messaggio', type: 'textarea', hint: 'Supporta {{ $json.campo }} (max 2000 caratteri)' },
      { name: 'username', label: 'Nome mittente (opzionale)', type: 'text' },
    ],
  },

  // ============ Social / contenuti ============
  placid: {
    label: 'Placid', icon: '🖼️', color: 'var(--node-social)', category: 'Social',
    desc: 'Genera immagini o PDF dinamici da un template Placid',
    outputs: 1, inputs: 1,
    defaults: { apiToken: '{{ $vars.PLACID_TOKEN }}', templateId: '', kind: 'image', layers: '{\n  "title": { "text": "{{ $json.titolo }}" }\n}' },
    fields: [
      { name: 'apiToken', label: 'API token', type: 'text', hint: 'Es: {{ $vars.PLACID_TOKEN }}' },
      { name: 'templateId', label: 'Template UUID', type: 'text' },
      { name: 'kind', label: 'Tipo', type: 'select', options: [ { v: 'image', t: 'Immagine' }, { v: 'pdf', t: 'PDF' } ] },
      { name: 'layers', label: 'Layers (JSON)', type: 'textarea', hint: 'Mappa dei layer del template. Supporta {{ $json.campo }}' },
    ],
  },
  metricool: {
    label: 'Metricool', icon: '📈', color: 'var(--node-social)', category: 'Social',
    desc: 'Programma un post sui social tramite Metricool',
    outputs: 1, inputs: 1,
    defaults: { userToken: '{{ $vars.METRICOOL_TOKEN }}', userId: '{{ $vars.METRICOOL_USER_ID }}', blogId: '', networks: 'twitter', text: '{{ $json.testo }}', mediaUrl: '', publicationDate: '', timezone: 'Europe/Rome', autoPublish: true },
    fields: [
      { name: 'userToken', label: 'User token', type: 'text', hint: 'Es: {{ $vars.METRICOOL_TOKEN }}' },
      { name: 'userId', label: 'User ID', type: 'text' },
      { name: 'blogId', label: 'Blog ID (marca)', type: 'text' },
      { name: 'networks', label: 'Reti social', type: 'text', hint: 'Separate da virgola: twitter, facebook, instagram, linkedin' },
      { name: 'text', label: 'Testo del post', type: 'textarea', hint: 'Supporta {{ $json.campo }}' },
      { name: 'mediaUrl', label: 'URL media (opzionale)', type: 'text', hint: 'Immagine/video da allegare' },
      { name: 'publicationDate', label: 'Data pubblicazione (ISO)', type: 'text', hint: 'Vuoto = subito. Es: 2026-06-20T15:00:00' },
      { name: 'timezone', label: 'Fuso orario', type: 'text' },
      { name: 'autoPublish', label: 'Pubblica automaticamente', type: 'checkbox' },
    ],
  },
};

// ============ Stato ============
let workflows = [];
let wf = null;              // workflow corrente { id, name, active, nodes, connections }
let selectedNodeId = null;
let dirty = false;
let pan = { x: 60, y: 60 };
let zoom = 1;
let lastExecResults = null; // mappa nodeId -> status dell'ultima esecuzione
let lastExecData = {};       // mappa nodeId -> { input, output, status, error, logs }

// Salva input/output/stato di ogni nodo dai risultati di un'esecuzione
function captureExecData(exec) {
  lastExecResults = {};
  for (const nr of (exec.nodeResults || [])) {
    lastExecResults[nr.nodeId] = nr.status;
    lastExecData[nr.nodeId] = { input: nr.input, output: nr.output, status: nr.status, error: nr.error, logs: nr.logs };
  }
}

// ============ Riferimenti DOM ============
const $ = id => document.getElementById(id);
const canvasWrap = $('canvas-wrap'), canvas = $('canvas'),
      nodesLayer = $('nodes-layer'), connSvg = $('connections');

// gruppo SVG trasformato insieme al layer dei nodi
const connGroup = document.createElementNS('http://www.w3.org/2000/svg', 'g');
connSvg.appendChild(connGroup);

// ============ Utility ============
function uid(prefix) { return prefix + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 7); }
function toast(msg, type = '') {
  const t = $('toast');
  t.textContent = msg; t.className = type;
  clearTimeout(t._timer);
  t._timer = setTimeout(() => t.classList.add('hidden'), 2600);
}
async function api(method, url, body) {
  const res = await fetch(url, {
    method, headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || res.statusText);
  return data;
}
function screenToCanvas(cx, cy) {
  const r = canvasWrap.getBoundingClientRect();
  return { x: (cx - r.left - pan.x) / zoom, y: (cy - r.top - pan.y) / zoom };
}

// ============ Lista workflow ============
async function loadWorkflowList() {
  workflows = await api('GET', '/api/workflows');
  const list = $('workflow-list');
  list.innerHTML = '';
  for (const w of workflows) {
    const el = document.createElement('div');
    el.className = 'wf-item' + (wf && wf.id === w.id ? ' selected' : '');
    el.innerHTML = `<div class="wf-item-name"></div>
      <div class="wf-item-meta"><span class="dot${w.active ? ' active' : ''}"></span>${w.nodeCount} nodi
        <span class="wf-item-actions">
          <button class="btn-icon wf-dup" title="Duplica">⧉</button>
          <button class="btn-icon wf-del" title="Elimina">🗑</button>
        </span></div>`;
    el.querySelector('.wf-item-name').textContent = w.name;
    el.onclick = () => openWorkflow(w.id);
    el.querySelector('.wf-dup').onclick = (e) => { e.stopPropagation(); duplicateWorkflow(w.id); };
    el.querySelector('.wf-del').onclick = async (e) => {
      e.stopPropagation();
      if (!confirm(`Eliminare il workflow "${w.name}"?`)) return;
      await api('DELETE', '/api/workflows/' + w.id);
      if (wf && wf.id === w.id) { wf = null; closeConfig(); render(); }
      loadWorkflowList();
      toast('Workflow eliminato', 'success');
    };
    list.appendChild(el);
  }
}

async function openWorkflow(id) {
  if (dirty && !confirm('Modifiche non salvate. Continuare?')) return;
  wf = await api('GET', '/api/workflows/' + id);
  selectedNodeId = null;
  lastExecResults = null;
  lastExecData = {};
  dirty = false;
  $('wf-name').value = wf.name;
  $('wf-active').checked = !!wf.active;
  closeConfig();
  render();
  loadWorkflowList();
}

async function newWorkflow() {
  const w = await api('POST', '/api/workflows', { name: 'Nuovo workflow' });
  await loadWorkflowList();
  openWorkflow(w.id);
}

async function saveWorkflow(silent) {
  if (!wf) return;
  wf.name = $('wf-name').value || 'Senza nome';
  wf.active = $('wf-active').checked;
  wf = await api('PUT', '/api/workflows/' + wf.id, wf);
  dirty = false;
  loadWorkflowList();
  if (!silent) toast('Workflow salvato', 'success');
}

// ============ Rendering ============
function render() {
  renderNodes();
  renderConnections();
  applyTransform();
  $('canvas-hint').style.display = (wf && wf.nodes.length) ? 'none' : 'block';
}

function applyTransform() {
  nodesLayer.style.transform = `translate(${pan.x}px, ${pan.y}px) scale(${zoom})`;
  connGroup.setAttribute('transform', `translate(${pan.x}, ${pan.y}) scale(${zoom})`);
}

function renderNodes() {
  nodesLayer.innerHTML = '';
  if (!wf) return;
  for (const node of wf.nodes) {
    const def = NODE_TYPES[node.type] || { label: node.type, icon: '?', color: 'var(--border)', inputs: 1, outputs: 1 };
    const el = document.createElement('div');
    el.className = 'node' + (node.id === selectedNodeId ? ' selected' : '') + (node.disabled ? ' disabled' : '');
    if (lastExecResults && lastExecResults[node.id]) {
      el.classList.add(lastExecResults[node.id] === 'error' ? 'exec-error' : 'exec-success');
    }
    el.style.left = node.position.x + 'px';
    el.style.top = node.position.y + 'px';
    el.dataset.nodeId = node.id;

    el.innerHTML = `
      <div class="node-header">
        <div class="node-icon" style="background:${def.color}">${def.icon}</div>
        <div class="node-titles">
          <div class="node-name"></div>
          <div class="node-type-label">${def.label}</div>
        </div>
      </div>`;
    el.querySelector('.node-name').textContent = node.name;

    if (lastExecResults && lastExecResults[node.id]) {
      const ok = lastExecResults[node.id] !== 'error';
      const badge = document.createElement('div');
      badge.className = 'node-badge' + (ok ? '' : ' err');
      badge.textContent = ok ? '✓' : '!';
      el.appendChild(badge);
    }

    // Porta input
    if (def.inputs > 0) {
      const pin = document.createElement('div');
      pin.className = 'port port-in';
      pin.dataset.nodeId = node.id;
      el.appendChild(pin);
    }
    // Porte output
    if (def.outputs === 2) {
      const pTrue = document.createElement('div');
      pTrue.className = 'port port-out port-true';
      pTrue.dataset.nodeId = node.id; pTrue.dataset.output = '0';
      pTrue.innerHTML = '<span class="port-label">true</span>';
      el.appendChild(pTrue);
      const pFalse = document.createElement('div');
      pFalse.className = 'port port-out port-false';
      pFalse.dataset.nodeId = node.id; pFalse.dataset.output = '1';
      pFalse.innerHTML = '<span class="port-label">false</span>';
      el.appendChild(pFalse);
    } else if (def.outputs >= 1) {
      const pout = document.createElement('div');
      pout.className = 'port port-out';
      pout.dataset.nodeId = node.id; pout.dataset.output = '0';
      el.appendChild(pout);
    }

    el.addEventListener('mousedown', onNodeMouseDown);
    el.addEventListener('click', e => {
      if (el._dragged) return;
      e.stopPropagation();
      selectNode(node.id);
    });
    nodesLayer.appendChild(el);
  }
}

function portPosition(node, kind, outputIndex) {
  const def = NODE_TYPES[node.type] || { outputs: 1 };
  const W = 180, H = 54;
  if (kind === 'in') return { x: node.position.x, y: node.position.y + H / 2 };
  if (def.outputs === 2) {
    const y = outputIndex === 0 ? H * 0.32 : H * 0.68;
    return { x: node.position.x + W, y: node.position.y + y };
  }
  return { x: node.position.x + W, y: node.position.y + H / 2 };
}

function bezier(p1, p2) {
  const dx = Math.max(40, Math.abs(p2.x - p1.x) / 2);
  return `M ${p1.x} ${p1.y} C ${p1.x + dx} ${p1.y}, ${p2.x - dx} ${p2.y}, ${p2.x} ${p2.y}`;
}

function renderConnections() {
  connGroup.innerHTML = '';
  if (!wf) return;
  const nodeMap = new Map(wf.nodes.map(n => [n.id, n]));
  wf.connections.forEach((c, idx) => {
    const from = nodeMap.get(c.from), to = nodeMap.get(c.to);
    if (!from || !to) return;
    const p1 = portPosition(from, 'out', c.fromOutput || 0);
    const p2 = portPosition(to, 'in');
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', bezier(p1, p2));
    path.setAttribute('class', 'conn-path');
    path.addEventListener('click', e => {
      e.stopPropagation();
      if (confirm('Eliminare questa connessione?')) {
        wf.connections.splice(idx, 1);
        dirty = true;
        renderConnections();
      }
    });
    connGroup.appendChild(path);
  });
}

// ============ Interazioni canvas: pan, zoom ============
let panning = false, panStart = null;
canvas.addEventListener('mousedown', e => {
  if (e.target !== canvas && e.target !== nodesLayer && e.target !== connSvg) return;
  panning = true;
  panStart = { x: e.clientX - pan.x, y: e.clientY - pan.y };
  canvas.classList.add('panning');
});
window.addEventListener('mousemove', e => {
  if (panning) {
    pan.x = e.clientX - panStart.x;
    pan.y = e.clientY - panStart.y;
    applyTransform();
  }
});
window.addEventListener('mouseup', () => {
  panning = false;
  canvas.classList.remove('panning');
});
canvas.addEventListener('click', e => {
  if (e.target === canvas || e.target === connSvg) {
    selectedNodeId = null;
    closeConfig();
    renderNodes();
  }
});
canvas.addEventListener('dblclick', e => {
  if (e.target === canvas || e.target === connSvg) openPalette(screenToCanvas(e.clientX, e.clientY));
});
canvasWrap.addEventListener('wheel', e => {
  e.preventDefault();
  const factor = e.deltaY < 0 ? 1.1 : 0.9;
  const r = canvasWrap.getBoundingClientRect();
  const mx = e.clientX - r.left, my = e.clientY - r.top;
  const newZoom = Math.min(2.5, Math.max(0.3, zoom * factor));
  pan.x = mx - (mx - pan.x) * (newZoom / zoom);
  pan.y = my - (my - pan.y) * (newZoom / zoom);
  zoom = newZoom;
  applyTransform();
}, { passive: false });

$('zoom-in').onclick = () => { zoom = Math.min(2.5, zoom * 1.2); applyTransform(); };
$('zoom-out').onclick = () => { zoom = Math.max(0.3, zoom / 1.2); applyTransform(); };
$('zoom-reset').onclick = () => { zoom = 1; pan = { x: 60, y: 60 }; applyTransform(); };

// ============ Drag dei nodi e connessioni ============
let dragNode = null, dragOffset = null, tempConn = null;

function onNodeMouseDown(e) {
  const el = e.currentTarget;
  el._dragged = false;

  // Inizio connessione da porta output
  if (e.target.classList.contains('port-out')) {
    e.stopPropagation(); e.preventDefault();
    const fromId = e.target.dataset.nodeId;
    const fromOutput = Number(e.target.dataset.output || 0);
    tempConn = { from: fromId, fromOutput };
    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('class', 'conn-path temp');
    connGroup.appendChild(path);
    tempConn.path = path;

    const move = ev => {
      const node = wf.nodes.find(n => n.id === tempConn.from);
      const p1 = portPosition(node, 'out', tempConn.fromOutput);
      const p2 = screenToCanvas(ev.clientX, ev.clientY);
      path.setAttribute('d', bezier(p1, p2));
    };
    const up = ev => {
      window.removeEventListener('mousemove', move);
      window.removeEventListener('mouseup', up);
      path.remove();
      const target = document.elementFromPoint(ev.clientX, ev.clientY);
      if (target && target.classList.contains('port-in')) {
        const toId = target.dataset.nodeId;
        if (toId !== tempConn.from &&
            !wf.connections.some(c => c.from === tempConn.from && c.fromOutput === tempConn.fromOutput && c.to === toId)) {
          wf.connections.push({ from: tempConn.from, fromOutput: tempConn.fromOutput, to: toId });
          dirty = true;
          renderConnections();
        }
      }
      tempConn = null;
    };
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', up);
    return;
  }

  if (e.target.classList.contains('port-in')) { e.stopPropagation(); return; }

  // Drag del nodo
  e.stopPropagation();
  const nodeId = el.dataset.nodeId;
  const node = wf.nodes.find(n => n.id === nodeId);
  const start = screenToCanvas(e.clientX, e.clientY);
  dragNode = node;
  dragOffset = { x: start.x - node.position.x, y: start.y - node.position.y };

  const move = ev => {
    const p = screenToCanvas(ev.clientX, ev.clientY);
    node.position.x = Math.round(p.x - dragOffset.x);
    node.position.y = Math.round(p.y - dragOffset.y);
    el._dragged = true;
    el.style.left = node.position.x + 'px';
    el.style.top = node.position.y + 'px';
    dirty = true;
    renderConnections();
  };
  const up = () => {
    window.removeEventListener('mousemove', move);
    window.removeEventListener('mouseup', up);
    dragNode = null;
    setTimeout(() => { el._dragged = false; }, 0);
  };
  window.addEventListener('mousemove', move);
  window.addEventListener('mouseup', up);
}

// ============ Palette nodi ============
let palettePos = null;
function openPalette(pos) {
  if (!wf) { toast('Crea o seleziona prima un workflow', 'error'); return; }
  palettePos = pos || screenToCanvas(canvasWrap.clientWidth / 2, canvasWrap.clientHeight / 2);
  $('palette-overlay').classList.remove('hidden');
  $('palette-search').value = '';
  renderPalette('');
  $('palette-search').focus();
}
function renderPalette(filter) {
  const list = $('palette-list');
  list.innerHTML = '';
  const cats = {};
  for (const [type, def] of Object.entries(NODE_TYPES)) {
    if (filter && !(def.label + def.desc).toLowerCase().includes(filter.toLowerCase())) continue;
    (cats[def.category] = cats[def.category] || []).push([type, def]);
  }
  for (const [cat, items] of Object.entries(cats)) {
    const catEl = document.createElement('div');
    catEl.className = 'palette-cat';
    catEl.textContent = cat;
    list.appendChild(catEl);
    for (const [type, def] of items) {
      const el = document.createElement('div');
      el.className = 'palette-item';
      el.innerHTML = `<div class="node-icon" style="background:${def.color}">${def.icon}</div>
        <div><div class="palette-item-name">${def.label}</div><div class="palette-item-desc">${def.desc}</div></div>`;
      el.onclick = () => { addNode(type); closePalette(); };
      list.appendChild(el);
    }
  }
}
function closePalette() { $('palette-overlay').classList.add('hidden'); }

function addNode(type) {
  const def = NODE_TYPES[type];
  // Nome univoco
  let name = def.label, i = 1;
  while (wf.nodes.some(n => n.name === name)) name = `${def.label} ${++i}`;
  const node = {
    id: uid('node'),
    type, name,
    position: { x: Math.round(palettePos.x - 90), y: Math.round(palettePos.y - 27) },
    parameters: JSON.parse(JSON.stringify(def.defaults)),
  };
  wf.nodes.push(node);
  dirty = true;
  render();
  selectNode(node.id);
}

// ============ Pannello configurazione ============
function selectNode(id) {
  selectedNodeId = id;
  renderNodes();
  const node = wf.nodes.find(n => n.id === id);
  if (!node) return;
  const def = NODE_TYPES[node.type];
  $('config-title').textContent = def.label;
  const body = $('config-body');
  body.innerHTML = '';

  // Nome del nodo
  body.appendChild(formGroup('Nome del nodo', (() => {
    const inp = document.createElement('input');
    inp.type = 'text'; inp.value = node.name;
    inp.oninput = () => { node.name = inp.value; dirty = true; renderNodes(); };
    return inp;
  })()));

  for (const field of def.fields) {
    renderField(body, node, field);
  }

  // Hint webhook URL
  if (node.type === 'webhook') {
    const hint = document.createElement('div');
    hint.className = 'form-hint';
    hint.style.marginBottom = '12px';
    const update = () => {
      hint.innerHTML = `URL completo: <b>${location.origin}/webhook/${(node.parameters.path || '').replace(/^\//, '')}</b>`;
    };
    update();
    body.addEventListener('input', update);
    body.appendChild(hint);
  }

  // Dati di ingresso/uscita dall'ultima esecuzione
  renderNodeIO(body, node);

  const tgl = $('btn-toggle-node');
  if (tgl) tgl.textContent = node.disabled ? 'Abilita' : 'Disabilita';
  $('config-panel').classList.remove('hidden');
}

// Mostra input e output del nodo dall'ultima esecuzione (se disponibili)
function renderNodeIO(body, node) {
  const data = lastExecData[node.id];
  const section = document.createElement('div');
  section.className = 'node-io';

  const title = document.createElement('div');
  title.className = 'node-io-title';
  title.textContent = 'Dati ultima esecuzione';
  section.appendChild(title);

  if (!data) {
    const empty = document.createElement('div');
    empty.className = 'io-empty';
    empty.textContent = 'Nessun dato. Esegui il workflow o usa "▶ Solo questo" per vedere input e output.';
    section.appendChild(empty);
    body.appendChild(section);
    return;
  }

  if (data.error) {
    const banner = document.createElement('div');
    banner.className = 'exec-error-banner';
    banner.textContent = data.error;
    section.appendChild(banner);
  }
  if (data.logs && data.logs.length) {
    const logs = document.createElement('div');
    logs.className = 'form-hint';
    logs.style.marginBottom = '8px';
    logs.textContent = 'console: ' + data.logs.join(' | ');
    section.appendChild(logs);
  }

  const count = v => Array.isArray(v) ? `${v.length} item` : (v == null ? '–' : '1');
  section.appendChild(ioBlock('Input', data.input, count(data.input), false));
  const okTag = data.status && data.status !== 'error' ? ' ok' : (data.status === 'error' ? ' err' : '');
  section.appendChild(ioBlock('Output', data.output, count(data.output), true, okTag));

  body.appendChild(section);
}

function ioBlock(label, value, countText, open, tagClass) {
  const det = document.createElement('details');
  det.className = 'io-block';
  if (open) det.open = true;
  const sum = document.createElement('summary');
  sum.innerHTML = `<span>${label}</span>` +
    (tagClass ? `<span class="io-tag${tagClass}">${tagClass.includes('err') ? 'errore' : 'ok'}</span>` : '') +
    `<span class="io-count">${countText}</span>`;
  det.appendChild(sum);
  const pre = document.createElement('pre');
  pre.textContent = value === undefined ? '(nessun dato)' : JSON.stringify(value, null, 2);
  det.appendChild(pre);
  return det;
}

function formGroup(labelText, inputEl, hintText) {
  const g = document.createElement('div');
  g.className = 'form-group';
  const lab = document.createElement('label');
  lab.textContent = labelText;
  g.appendChild(lab);
  g.appendChild(inputEl);
  if (hintText) {
    const h = document.createElement('div');
    h.className = 'form-hint';
    h.textContent = hintText;
    g.appendChild(h);
  }
  return g;
}

function renderField(body, node, field) {
  const p = node.parameters;
  // visibilità condizionale
  if (field.showIf) {
    const [k, v] = Object.entries(field.showIf)[0];
    if (p[k] !== v) {
      // ricontrolla quando cambia: gestito ridisegnando il pannello su select change
      return;
    }
  }
  let input;
  switch (field.type) {
    case 'select': {
      input = document.createElement('select');
      for (const opt of field.options) {
        const o = document.createElement('option');
        if (typeof opt === 'string') { o.value = opt; o.textContent = opt; }
        else { o.value = opt.v; o.textContent = opt.t; }
        input.appendChild(o);
      }
      input.value = p[field.name] ?? '';
      input.onchange = () => { p[field.name] = input.value; dirty = true; selectNode(node.id); };
      break;
    }
    case 'textarea': {
      input = document.createElement('textarea');
      input.value = p[field.name] ?? '';
      input.spellcheck = false;
      input.oninput = () => { p[field.name] = input.value; dirty = true; };
      break;
    }
    case 'number': {
      input = document.createElement('input');
      input.type = 'number';
      input.value = p[field.name] ?? '';
      input.oninput = () => { p[field.name] = Number(input.value); dirty = true; };
      break;
    }
    case 'time': {
      input = document.createElement('input');
      input.type = 'time';
      input.value = p[field.name] ?? '09:00';
      input.oninput = () => { p[field.name] = input.value; dirty = true; };
      break;
    }
    case 'checkbox': {
      const wrap = document.createElement('label');
      wrap.style.cssText = 'display:flex;align-items:center;gap:8px;cursor:pointer;font-size:13px;color:var(--text)';
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!p[field.name];
      cb.onchange = () => { p[field.name] = cb.checked; dirty = true; };
      wrap.appendChild(cb);
      wrap.appendChild(document.createTextNode(field.label));
      const g = document.createElement('div');
      g.className = 'form-group';
      g.appendChild(wrap);
      body.appendChild(g);
      return;
    }
    case 'keyvalue': {
      input = document.createElement('div');
      const rows = () => p[field.name] || (p[field.name] = []);
      const redraw = () => {
        input.innerHTML = '';
        rows().forEach((row, idx) => {
          const r = document.createElement('div');
          r.className = 'kv-row';
          const k = document.createElement('input');
          k.type = 'text'; k.placeholder = field.keyLabel || 'nome'; k.value = row.name || '';
          k.oninput = () => { row.name = k.value; dirty = true; };
          const v = document.createElement('input');
          v.type = 'text'; v.placeholder = field.valLabel || 'valore'; v.value = row.value || '';
          v.oninput = () => { row.value = v.value; dirty = true; };
          const del = document.createElement('button');
          del.className = 'btn-icon'; del.textContent = '✕';
          del.onclick = () => { rows().splice(idx, 1); dirty = true; redraw(); };
          r.append(k, v, del);
          input.appendChild(r);
        });
        const add = document.createElement('button');
        add.className = 'add-row-btn';
        add.textContent = '+ Aggiungi';
        add.onclick = () => { rows().push({ name: '', value: '' }); dirty = true; redraw(); };
        input.appendChild(add);
      };
      redraw();
      break;
    }
    default: {
      input = document.createElement('input');
      input.type = 'text';
      input.value = p[field.name] ?? '';
      input.oninput = () => { p[field.name] = input.value; dirty = true; };
    }
  }
  body.appendChild(formGroup(field.label, input, field.hint));
}

function closeConfig() { $('config-panel').classList.add('hidden'); }

function deleteSelectedNode() {
  if (!selectedNodeId) return;
  wf.nodes = wf.nodes.filter(n => n.id !== selectedNodeId);
  wf.connections = wf.connections.filter(c => c.from !== selectedNodeId && c.to !== selectedNodeId);
  selectedNodeId = null;
  dirty = true;
  closeConfig();
  render();
}

// ============ Scorciatoie nodo ============
function duplicateSelectedNode() {
  if (!wf || !selectedNodeId) return;
  const src = wf.nodes.find(n => n.id === selectedNodeId);
  if (!src) return;
  const def = NODE_TYPES[src.type] || { label: src.type };
  let name = src.name + ' copia', i = 1;
  while (wf.nodes.some(n => n.name === name)) name = `${src.name} copia ${++i}`;
  const clone = {
    id: uid('node'), type: src.type, name,
    position: { x: src.position.x + 40, y: src.position.y + 40 },
    parameters: JSON.parse(JSON.stringify(src.parameters || {})),
    disabled: !!src.disabled,
  };
  wf.nodes.push(clone);
  dirty = true;
  render();
  selectNode(clone.id);
  toast('Nodo duplicato', 'success');
}

function toggleSelectedNodeDisabled() {
  if (!wf || !selectedNodeId) return;
  const node = wf.nodes.find(n => n.id === selectedNodeId);
  if (!node) return;
  node.disabled = !node.disabled;
  dirty = true;
  render();
  selectNode(node.id);
  toast(node.disabled ? 'Nodo disabilitato' : 'Nodo abilitato', 'success');
}

async function runFromSelectedNode() {
  if (!wf || !selectedNodeId) return;
  await saveWorkflow(true);
  toast('Esecuzione da questo nodo…');
  try {
    const exec = await api('POST', `/api/workflows/${wf.id}/execute`, { triggerNodeId: selectedNodeId });
    captureExecData(exec);
    renderNodes();
    if (selectedNodeId) selectNode(selectedNodeId);
    toast(exec.status === 'success' ? `Eseguito in ${exec.durationMs}ms ✓` : (exec.error || 'Errore'), exec.status === 'success' ? 'success' : 'error');
  } catch (e) { toast('Errore: ' + e.message, 'error'); }
}

// Esegue SOLO il nodo selezionato, usando come input i dati dell'ultima esecuzione (se presenti)
async function runSingleNode() {
  if (!wf || !selectedNodeId) return;
  await saveWorkflow(true);
  const prev = lastExecData[selectedNodeId];
  const input = prev && Array.isArray(prev.input) ? prev.input : undefined;
  toast('Esecuzione del nodo…');
  try {
    const exec = await api('POST', `/api/workflows/${wf.id}/execute`, { singleNodeId: selectedNodeId, input });
    for (const nr of (exec.nodeResults || [])) {
      if (!lastExecResults) lastExecResults = {};
      lastExecResults[nr.nodeId] = nr.status;
      lastExecData[nr.nodeId] = { input: nr.input, output: nr.output, status: nr.status, error: nr.error, logs: nr.logs };
    }
    renderNodes();
    selectNode(selectedNodeId);
    toast(exec.status === 'success' ? `Nodo eseguito in ${exec.durationMs}ms ✓` : (exec.error || 'Errore'), exec.status === 'success' ? 'success' : 'error');
  } catch (e) { toast('Errore: ' + e.message, 'error'); }
}

// ============ Duplica workflow ============
async function duplicateWorkflow(id) {
  const src = await api('GET', '/api/workflows/' + id);
  const copy = await api('POST', '/api/workflows', {
    name: src.name + ' (copia)', active: false,
    nodes: src.nodes || [], connections: src.connections || [],
  });
  await loadWorkflowList();
  openWorkflow(copy.id);
  toast('Workflow duplicato', 'success');
}

// ============ Import / Export ============
function openExport() {
  if (!wf) { toast('Nessun workflow aperto', 'error'); return; }
  const payload = { name: wf.name, nodes: wf.nodes, connections: wf.connections };
  $('io-title').textContent = '⤓ Esporta: ' + wf.name;
  $('io-hint').innerHTML = 'Copia questo JSON per salvarlo o condividerlo. <b>Attenzione:</b> può contenere chiavi API se non usi le variabili globali.';
  $('io-text').value = JSON.stringify(payload, null, 2);
  $('io-text').readOnly = true;
  const actions = $('io-actions');
  actions.innerHTML = '';
  const copyBtn = document.createElement('button');
  copyBtn.className = 'btn btn-primary'; copyBtn.textContent = 'Copia negli appunti';
  copyBtn.onclick = async () => {
    try { await navigator.clipboard.writeText($('io-text').value); toast('Copiato ✓', 'success'); }
    catch { $('io-text').select(); document.execCommand('copy'); toast('Copiato ✓', 'success'); }
  };
  const dlBtn = document.createElement('button');
  dlBtn.className = 'btn'; dlBtn.textContent = 'Scarica .json';
  dlBtn.onclick = () => {
    const blob = new Blob([$('io-text').value], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = (wf.name || 'workflow').replace(/[^\w-]+/g, '_') + '.json';
    a.click(); URL.revokeObjectURL(a.href);
  };
  actions.append(copyBtn, dlBtn);
  $('io-overlay').classList.remove('hidden');
}

function openImport() {
  $('io-title').textContent = '⤒ Importa workflow';
  $('io-hint').innerHTML = 'Incolla il JSON di un workflow (o un blocco da BLOCCHI-PRONTI.md). Verrà creato un nuovo workflow.';
  $('io-text').value = '';
  $('io-text').readOnly = false;
  const actions = $('io-actions');
  actions.innerHTML = '';
  const impBtn = document.createElement('button');
  impBtn.className = 'btn btn-primary btn-block'; impBtn.textContent = 'Importa';
  impBtn.onclick = doImport;
  actions.appendChild(impBtn);
  $('io-overlay').classList.remove('hidden');
  $('io-text').focus();
}

async function doImport() {
  let data;
  try { data = JSON.parse($('io-text').value); }
  catch (e) { toast('JSON non valido: ' + e.message, 'error'); return; }
  // accetta sia un workflow completo sia un array di nodi
  let nodes, connections, name;
  if (Array.isArray(data)) { nodes = data; connections = []; name = 'Importato'; }
  else { nodes = data.nodes || []; connections = data.connections || []; name = data.name || 'Importato'; }
  if (!Array.isArray(nodes) || !nodes.length) { toast('Nessun nodo trovato nel JSON', 'error'); return; }
  const w = await api('POST', '/api/workflows', { name, active: false, nodes, connections });
  $('io-overlay').classList.add('hidden');
  await loadWorkflowList();
  openWorkflow(w.id);
  toast('Workflow importato ✓', 'success');
}

// ============ Variabili globali ============
let varsCache = {};
async function openVars() {
  try { varsCache = await api('GET', '/api/vars'); } catch { varsCache = {}; }
  renderVarsList(Object.entries(varsCache).map(([name, value]) => ({ name, value })));
  $('vars-overlay').classList.remove('hidden');
}
function renderVarsList(rows) {
  const list = $('vars-list');
  list.innerHTML = '';
  const draw = () => {
    list.innerHTML = '';
    rows.forEach((row, idx) => {
      const r = document.createElement('div');
      r.className = 'var-row';
      const k = document.createElement('input');
      k.type = 'text'; k.placeholder = 'NOME'; k.value = row.name || '';
      k.oninput = () => { row.name = k.value; };
      const v = document.createElement('input');
      v.type = 'password'; v.placeholder = 'valore'; v.value = row.value || '';
      v.oninput = () => { row.value = v.value; };
      const eye = document.createElement('button');
      eye.className = 'btn-icon'; eye.textContent = '👁';
      eye.onclick = () => { v.type = v.type === 'password' ? 'text' : 'password'; };
      const del = document.createElement('button');
      del.className = 'btn-icon'; del.textContent = '✕';
      del.onclick = () => { rows.splice(idx, 1); draw(); };
      r.append(k, v, eye, del);
      list.appendChild(r);
    });
  };
  draw();
  $('vars-add').onclick = () => { rows.push({ name: '', value: '' }); draw(); };
  $('vars-save').onclick = async () => {
    const obj = {};
    for (const row of rows) if (row.name && row.name.trim()) obj[row.name.trim()] = row.value || '';
    varsCache = await api('PUT', '/api/vars', obj);
    $('vars-overlay').classList.add('hidden');
    toast('Variabili salvate ✓', 'success');
  };
}

// ============ Template ============
function openTemplates() {
  const list = $('tpl-list');
  list.innerHTML = '';
  WORKFLOW_TEMPLATES.forEach(tpl => {
    const el = document.createElement('div');
    el.className = 'tpl-item';
    el.innerHTML = `<div class="tpl-name"></div><div class="tpl-desc"></div>`;
    el.querySelector('.tpl-name').textContent = tpl.name;
    el.querySelector('.tpl-desc').textContent = tpl.desc;
    el.onclick = () => createFromTemplate(tpl);
    list.appendChild(el);
  });
  $('tpl-overlay').classList.remove('hidden');
}
async function createFromTemplate(tpl) {
  const w = await api('POST', '/api/workflows', {
    name: tpl.name, active: false,
    nodes: JSON.parse(JSON.stringify(tpl.nodes)),
    connections: JSON.parse(JSON.stringify(tpl.connections)),
  });
  $('tpl-overlay').classList.add('hidden');
  await loadWorkflowList();
  openWorkflow(w.id);
  toast('Workflow creato dal template ✓', 'success');
}

// ============ Esecuzione ============
async function runWorkflow() {
  if (!wf) return;
  if (!wf.nodes.length) { toast('Aggiungi almeno un nodo trigger', 'error'); return; }
  await saveWorkflow(true);
  const btn = $('btn-run');
  btn.disabled = true; btn.textContent = '⏳ In corso...';
  try {
    const exec = await api('POST', `/api/workflows/${wf.id}/execute`, {});
    captureExecData(exec);
    renderNodes();
    if (selectedNodeId) selectNode(selectedNodeId);
    if (exec.status === 'success') toast(`Eseguito in ${exec.durationMs}ms ✓`, 'success');
    else toast(exec.error || 'Errore di esecuzione', 'error');
  } catch (e) {
    toast('Errore: ' + e.message, 'error');
  } finally {
    btn.disabled = false; btn.textContent = '▶ Esegui';
  }
}

// ============ Pannello esecuzioni ============
async function openExecutions() {
  if (!wf) return;
  $('exec-overlay').classList.remove('hidden');
  const list = $('exec-list');
  list.innerHTML = '<div class="muted" style="padding:10px">Caricamento...</div>';
  $('exec-detail').innerHTML = '<div class="muted">Seleziona un\'esecuzione per i dettagli</div>';
  const execs = await api('GET', '/api/executions?workflowId=' + wf.id);
  list.innerHTML = execs.length ? '' : '<div class="muted" style="padding:10px">Nessuna esecuzione</div>';
  for (const ex of execs) {
    const el = document.createElement('div');
    el.className = 'exec-item';
    const date = new Date(ex.startedAt);
    el.innerHTML = `
      <div class="exec-item-top">
        <span class="exec-status ${ex.status}">${ex.status === 'success' ? 'OK' : 'ERRORE'}</span>
        <span class="muted" style="font-size:11px">${ex.durationMs ?? '–'}ms</span>
      </div>
      <div class="exec-item-time">${date.toLocaleString('it-IT')}</div>`;
    el.onclick = async () => {
      list.querySelectorAll('.exec-item').forEach(x => x.classList.remove('selected'));
      el.classList.add('selected');
      showExecDetail(ex.id);
    };
    list.appendChild(el);
  }
}

async function showExecDetail(id) {
  const detail = $('exec-detail');
  detail.innerHTML = '<div class="muted">Caricamento...</div>';
  const ex = await api('GET', '/api/executions/' + id);
  detail.innerHTML = '';
  if (ex.error) {
    const banner = document.createElement('div');
    banner.className = 'exec-error-banner';
    banner.textContent = ex.error;
    detail.appendChild(banner);
  }
  for (const nr of ex.nodeResults) {
    const el = document.createElement('div');
    el.className = 'node-result';
    const header = document.createElement('div');
    header.className = 'node-result-header';
    header.innerHTML = `<span class="status-dot ${nr.status}"></span>
      <span>${escapeHtml(nr.nodeName)}</span>
      <span class="muted" style="font-size:11px;margin-left:auto">${nr.durationMs ?? 0}ms</span>
      <span class="muted">▾</span>`;
    const bodyEl = document.createElement('div');
    bodyEl.className = 'node-result-body hidden';
    let content = '';
    if (nr.error) content += `<div class="exec-error-banner">${escapeHtml(nr.error)}</div>`;
    if (nr.logs && nr.logs.length) content += `<div class="form-hint" style="margin-bottom:6px">console: ${escapeHtml(nr.logs.join(' | '))}</div>`;
    content += `<pre>${escapeHtml(JSON.stringify(nr.output ?? null, null, 2))}</pre>`;
    bodyEl.innerHTML = content;
    header.onclick = () => bodyEl.classList.toggle('hidden');
    el.append(header, bodyEl);
    detail.appendChild(el);
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

// ============ Template di workflow ============
const WORKFLOW_TEMPLATES = [
  {
    name: 'Digest meeting → Claude → Email',
    desc: 'Ogni mattina: prende i meeting Fathom, li riassume con Claude e invia l\'email. Usa le variabili FATHOM_KEY, ANTHROPIC_KEY, RESEND_KEY.',
    nodes: [
      { id: 'sch', type: 'schedule', name: 'Ogni mattina 08:00', position: { x: 0, y: 0 }, parameters: { mode: 'dailyAt', time: '08:00', minutes: 5, hours: 1 } },
      { id: 'fth', type: 'fathom', name: 'Fathom Meetings', position: { x: 240, y: 0 }, parameters: { operation: 'listMeetings', apiKey: '{{ $vars.FATHOM_KEY }}', includeTranscript: true, includeHighlights: false, createdAfter: '' } },
      { id: 'cod', type: 'code', name: 'Prepara prompt', position: { x: 480, y: 0 }, parameters: { code: `const ms = items.filter(x => x && x.title); const blob = ms.map(x => 'Meeting: ' + x.title + '\\nTrascrizione: ' + String(x.transcript || '').slice(0, 4000)).join('\\n\\n---\\n\\n'); return [{ prompt: 'Riassumi in italiano questi meeting, con punti chiave e action item:\\n\\n' + (blob || 'Nessun meeting recente.') }];` } },
      { id: 'llm', type: 'llm', name: 'Claude riassume', position: { x: 720, y: 0 }, parameters: { provider: 'anthropic', apiKey: '{{ $vars.ANTHROPIC_KEY }}', model: 'claude-sonnet-4-6', system: 'Sei un assistente che scrive riassunti chiari e sintetici in italiano.', prompt: '{{ $json.prompt }}', maxTokens: 1500 } },
      { id: 'eml', type: 'email', name: 'Invia digest', position: { x: 960, y: 0 }, parameters: { provider: 'resend', apiKey: '{{ $vars.RESEND_KEY }}', from: 'Digest <noreply@tuodominio.it>', to: 'umasterinfo@gmail.com', subject: 'Digest meeting di oggi', html: '<div style="font-family:sans-serif;white-space:pre-wrap">{{ $json.risposta }}</div>' } },
    ],
    connections: [
      { from: 'sch', fromOutput: 0, to: 'fth' }, { from: 'fth', fromOutput: 0, to: 'cod' },
      { from: 'cod', fromOutput: 0, to: 'llm' }, { from: 'llm', fromOutput: 0, to: 'eml' },
    ],
  },
  {
    name: 'Webhook → Claude → risposta',
    desc: 'Endpoint AI: ricevi POST con {"prompt":"..."} su /webhook/ai, Claude risponde e il webhook restituisce la risposta. Richiede ANTHROPIC_KEY e workflow attivo.',
    nodes: [
      { id: 'wh', type: 'webhook', name: 'Webhook', position: { x: 0, y: 0 }, parameters: { path: 'ai', method: 'ANY' } },
      { id: 'llm', type: 'llm', name: 'Claude', position: { x: 240, y: 0 }, parameters: { provider: 'anthropic', apiKey: '{{ $vars.ANTHROPIC_KEY }}', model: 'claude-sonnet-4-6', system: '', prompt: '{{ $json.body.prompt }}', maxTokens: 1024 } },
      { id: 'out', type: 'set', name: 'Risposta', position: { x: 480, y: 0 }, parameters: { keepOnlySet: true, fields: [{ name: 'risposta', value: '{{ $json.risposta }}' }] } },
    ],
    connections: [ { from: 'wh', fromOutput: 0, to: 'llm' }, { from: 'llm', fromOutput: 0, to: 'out' } ],
  },
  {
    name: 'AI playground (manuale)',
    desc: 'Banco di prova: scrivi un prompt nel nodo Edit Fields e premi Esegui per vedere la risposta dell\'LLM. Richiede OPENAI_KEY.',
    nodes: [
      { id: 'man', type: 'manualTrigger', name: 'Manual Trigger', position: { x: 0, y: 0 }, parameters: {} },
      { id: 'set', type: 'set', name: 'Il tuo prompt', position: { x: 240, y: 0 }, parameters: { keepOnlySet: true, fields: [{ name: 'prompt', value: 'Spiega cos\'è un workflow no-code in 3 frasi.' }] } },
      { id: 'llm', type: 'llm', name: 'LLM', position: { x: 480, y: 0 }, parameters: { provider: 'openai', apiKey: '{{ $vars.OPENAI_KEY }}', model: 'gpt-4o-mini', system: '', prompt: '{{ $json.prompt }}', maxTokens: 800 } },
    ],
    connections: [ { from: 'man', fromOutput: 0, to: 'set' }, { from: 'set', fromOutput: 0, to: 'llm' } ],
  },
  {
    name: 'Agenda del giorno via email',
    desc: 'Ogni mattina prende gli eventi di Google Calendar e te li invia per email. Richiede GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN, RESEND_KEY.',
    nodes: [
      { id: 'sch', type: 'schedule', name: 'Ogni mattina 07:30', position: { x: 0, y: 0 }, parameters: { mode: 'dailyAt', time: '07:30', minutes: 5, hours: 1 } },
      { id: 'tok', type: 'googleToken', name: 'Google Token', position: { x: 240, y: 0 }, parameters: { clientId: '{{ $vars.GOOGLE_CLIENT_ID }}', clientSecret: '{{ $vars.GOOGLE_CLIENT_SECRET }}', refreshToken: '{{ $vars.GOOGLE_REFRESH_TOKEN }}' } },
      { id: 'cal', type: 'googleCalendar', name: 'Eventi di oggi', position: { x: 480, y: 0 }, parameters: { operation: 'list', accessToken: '{{ $node["Google Token"][0].access_token }}', calendarId: 'primary', maxResults: 10 } },
      { id: 'cod', type: 'code', name: 'Formatta', position: { x: 720, y: 0 }, parameters: { code: `const evs = items.filter(e => e && e.summary); const rows = evs.map(e => '• ' + String(e.start || '') + ' — ' + e.summary).join('<br>'); return [{ html: '<h3>Agenda di oggi</h3>' + (rows || 'Nessun evento in programma.') }];` } },
      { id: 'eml', type: 'email', name: 'Invia agenda', position: { x: 960, y: 0 }, parameters: { provider: 'resend', apiKey: '{{ $vars.RESEND_KEY }}', from: 'Agenda <noreply@tuodominio.it>', to: 'umasterinfo@gmail.com', subject: 'La tua agenda di oggi', html: '{{ $json.html }}' } },
    ],
    connections: [
      { from: 'sch', fromOutput: 0, to: 'tok' }, { from: 'tok', fromOutput: 0, to: 'cal' },
      { from: 'cal', fromOutput: 0, to: 'cod' }, { from: 'cod', fromOutput: 0, to: 'eml' },
    ],
  },
];

// ============ Event listeners globali ============
$('btn-new-workflow').onclick = newWorkflow;
$('btn-template').onclick = openTemplates;
$('btn-import').onclick = openImport;
$('btn-export').onclick = openExport;
$('btn-vars').onclick = openVars;
$('btn-dup-node').onclick = duplicateSelectedNode;
$('btn-runfrom-node').onclick = runFromSelectedNode;
$('btn-runnode-node').onclick = runSingleNode;
$('btn-save-node').onclick = () => saveWorkflow();
$('btn-toggle-node').onclick = toggleSelectedNodeDisabled;
$('vars-close').onclick = () => $('vars-overlay').classList.add('hidden');
$('vars-overlay').onclick = e => { if (e.target.id === 'vars-overlay') $('vars-overlay').classList.add('hidden'); };
$('io-close').onclick = () => $('io-overlay').classList.add('hidden');
$('io-overlay').onclick = e => { if (e.target.id === 'io-overlay') $('io-overlay').classList.add('hidden'); };
$('tpl-close').onclick = () => $('tpl-overlay').classList.add('hidden');
$('tpl-overlay').onclick = e => { if (e.target.id === 'tpl-overlay') $('tpl-overlay').classList.add('hidden'); };
$('btn-save').onclick = () => saveWorkflow();
$('btn-run').onclick = runWorkflow;
$('btn-add-node').onclick = () => openPalette();
$('btn-executions').onclick = openExecutions;
$('btn-delete-node').onclick = deleteSelectedNode;
$('config-close').onclick = () => { selectedNodeId = null; closeConfig(); renderNodes(); };
$('palette-close').onclick = closePalette;
$('palette-overlay').onclick = e => { if (e.target.id === 'palette-overlay') closePalette(); };
$('palette-search').oninput = e => renderPalette(e.target.value);
$('exec-close').onclick = () => $('exec-overlay').classList.add('hidden');
$('exec-overlay').onclick = e => { if (e.target.id === 'exec-overlay') $('exec-overlay').classList.add('hidden'); };
$('wf-name').oninput = () => { dirty = true; };
$('wf-active').onchange = () => { dirty = true; saveWorkflow(true).then(() => toast($('wf-active').checked ? 'Workflow attivato' : 'Workflow disattivato', 'success')); };

window.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 's') { e.preventDefault(); saveWorkflow(); }
  if ((e.ctrlKey || e.metaKey) && (e.key === 'd' || e.key === 'D') && selectedNodeId) { e.preventDefault(); duplicateSelectedNode(); }
  if (e.key === 'Delete' && selectedNodeId && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) {
    deleteSelectedNode();
  }
  if (e.key === 'Escape') {
    closePalette();
    ['exec-overlay', 'vars-overlay', 'io-overlay', 'tpl-overlay'].forEach(id => $(id).classList.add('hidden'));
  }
});
window.addEventListener('beforeunload', e => { if (dirty) e.preventDefault(); });

// ============ Avvio ============
(async function init() {
  await loadWorkflowList();
  if (workflows.length) openWorkflow(workflows[0].id);
})();
