# 🧱 Blocchi pronti per FlowForge

Libreria di nodi preconfigurati per costruire workflow velocemente: Gmail, email transazionali, LLM (OpenAI / Anthropic / Gemini / OpenRouter), Google Drive, Google Calendar e Fathom.

FlowForge non ha nodi nativi per questi servizi: ogni blocco è un nodo **HTTP Request** (o **Code**) già impostato verso la REST API del servizio. Basta copiare i valori dei campi.

---

## Come usare un blocco

Hai tre modi, dal più semplice al più potente:

1. **Copia i campi nel pannello** (consigliato). Aggiungi il tipo di nodo indicato (`HTTP Request`, `Code` o `Edit Fields`) dal pulsante **+ Nodo**, poi incolla *Metodo*, *URL*, *Headers* e *Body* dai valori del blocco.
2. **Incolla il JSON in `data/workflows.json`**. Ogni blocco ha sotto lo spoiler "JSON nodo" la versione completa: incollala dentro l'array `nodes` di un workflow, aggiungi le `connections`, salva e ricarica la pagina.
3. **Via API REST**. `POST http://localhost:5678/api/workflows` con un body `{ "name": "...", "nodes": [...], "connections": [...] }`.

> Negli URL, headers e body puoi usare le espressioni `{{ $json.campo }}`, `{{ $node["Nome Nodo"][0].body.x }}` e `{{ $now }}`, esattamente come nel resto di FlowForge.

---

## ⚠️ Gestione delle chiavi API (leggi prima)

FlowForge **non ha un archivio credenziali**: le chiavi finiscono in chiaro nei nodi e quindi in `data/workflows.json`. Quindi:

- **Non condividere** il file `workflows.json` né esportazioni del workflow con le chiavi dentro.
- Tieni le chiavi in **un solo punto**: metti un nodo **Edit Fields** chiamato `Config` all'inizio (vedi sotto) e referenzialo con `{{ $node["Config"][0].nomeChiave }}`. Così cambi la chiave in un posto solo.
- Per le API Google (Gmail/Drive/Calendar) serve un **access token OAuth2**, che scade dopo ~1 ora: usa il blocco **"Google → Access Token"** in fondo per generarne uno fresco a ogni esecuzione.

### Blocco `Config` (Edit Fields)

| Campo | Valore |
|---|---|
| Tipo nodo | **Edit Fields** |
| `keepOnlySet` | ✅ attivo |

Campi (nome → valore):

```
openai_key        sk-...
anthropic_key     sk-ant-...
gemini_key        AIza...
google_client_id      xxxxx.apps.googleusercontent.com
google_client_secret  GOCSPX-...
google_refresh_token  1//0g...
fathom_key        fathom_api_...
resend_key        re_...
```

Poi nei blocchi sotto usa `{{ $node["Config"][0].openai_key }}` al posto della chiave scritta a mano.

<details><summary>JSON nodo</summary>

```json
{
  "id": "config",
  "type": "set",
  "name": "Config",
  "position": { "x": 0, "y": 0 },
  "parameters": {
    "keepOnlySet": true,
    "fields": [
      { "name": "openai_key", "value": "sk-..." },
      { "name": "anthropic_key", "value": "sk-ant-..." },
      { "name": "gemini_key", "value": "AIza..." },
      { "name": "google_client_id", "value": "xxxxx.apps.googleusercontent.com" },
      { "name": "google_client_secret", "value": "GOCSPX-..." },
      { "name": "google_refresh_token", "value": "1//0g..." },
      { "name": "fathom_key", "value": "fathom_api_..." },
      { "name": "resend_key", "value": "re_..." }
    ]
  }
}
```
</details>

---

# 🤖 LLM — chiamate API

> **Regola d'oro per i body dinamici:** se il prompt contiene virgolette o a capo, incollarlo dentro `{{ }}` rompe il JSON. In quel caso costruisci il payload in un nodo **Code** con `JSON.stringify(...)` (vedi blocco "Prompt builder") e passa `{{ $json.payload }}` nel body.

## OpenAI — Chat Completions

| Campo | Valore |
|---|---|
| Tipo nodo | **HTTP Request** |
| Metodo | `POST` |
| URL | `https://api.openai.com/v1/chat/completions` |

Headers:

```
Authorization    Bearer {{ $node["Config"][0].openai_key }}
Content-Type     application/json
```

Body:

```json
{
  "model": "gpt-4o-mini",
  "messages": [
    { "role": "system", "content": "Sei un assistente conciso." },
    { "role": "user", "content": "{{ $json.prompt }}" }
  ]
}
```

➡️ Risposta in `body.choices[0].message.content`.

<details><summary>JSON nodo</summary>

```json
{
  "id": "openai",
  "type": "httpRequest",
  "name": "OpenAI",
  "position": { "x": 250, "y": 0 },
  "parameters": {
    "method": "POST",
    "url": "https://api.openai.com/v1/chat/completions",
    "headers": [
      { "name": "Authorization", "value": "Bearer {{ $node[\"Config\"][0].openai_key }}" },
      { "name": "Content-Type", "value": "application/json" }
    ],
    "body": "{ \"model\": \"gpt-4o-mini\", \"messages\": [ { \"role\": \"user\", \"content\": \"{{ $json.prompt }}\" } ] }"
  }
}
```
</details>

## Anthropic — Messages (Claude)

| Campo | Valore |
|---|---|
| Tipo nodo | **HTTP Request** |
| Metodo | `POST` |
| URL | `https://api.anthropic.com/v1/messages` |

Headers:

```
x-api-key           {{ $node["Config"][0].anthropic_key }}
anthropic-version   2023-06-01
Content-Type        application/json
```

Body:

```json
{
  "model": "claude-sonnet-4-6",
  "max_tokens": 1024,
  "messages": [
    { "role": "user", "content": "{{ $json.prompt }}" }
  ]
}
```

➡️ Risposta in `body.content[0].text`. Modelli: `claude-sonnet-4-6` (equilibrato), `claude-opus-4-8` (massima qualità), `claude-haiku-4-5-20251001` (veloce/economico).

<details><summary>JSON nodo</summary>

```json
{
  "id": "anthropic",
  "type": "httpRequest",
  "name": "Claude",
  "position": { "x": 250, "y": 0 },
  "parameters": {
    "method": "POST",
    "url": "https://api.anthropic.com/v1/messages",
    "headers": [
      { "name": "x-api-key", "value": "{{ $node[\"Config\"][0].anthropic_key }}" },
      { "name": "anthropic-version", "value": "2023-06-01" },
      { "name": "Content-Type", "value": "application/json" }
    ],
    "body": "{ \"model\": \"claude-sonnet-4-6\", \"max_tokens\": 1024, \"messages\": [ { \"role\": \"user\", \"content\": \"{{ $json.prompt }}\" } ] }"
  }
}
```
</details>

## Google Gemini — generateContent

| Campo | Valore |
|---|---|
| Tipo nodo | **HTTP Request** |
| Metodo | `POST` |
| URL | `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={{ $node["Config"][0].gemini_key }}` |

Headers: `Content-Type` → `application/json`

Body:

```json
{
  "contents": [
    { "parts": [ { "text": "{{ $json.prompt }}" } ] }
  ]
}
```

➡️ Risposta in `body.candidates[0].content.parts[0].text`. La chiave Gemini va nella query `?key=`, non nell'header.

<details><summary>JSON nodo</summary>

```json
{
  "id": "gemini",
  "type": "httpRequest",
  "name": "Gemini",
  "position": { "x": 250, "y": 0 },
  "parameters": {
    "method": "POST",
    "url": "https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key={{ $node[\"Config\"][0].gemini_key }}",
    "headers": [ { "name": "Content-Type", "value": "application/json" } ],
    "body": "{ \"contents\": [ { \"parts\": [ { \"text\": \"{{ $json.prompt }}\" } ] } ] }"
  }
}
```
</details>

## OpenRouter — un solo endpoint per 200+ modelli

Stessa identica forma di OpenAI, ma cambia URL e chiave. Comodo per provare modelli diversi senza riscrivere il blocco.

| Campo | Valore |
|---|---|
| URL | `https://openrouter.ai/api/v1/chat/completions` |
| Header `Authorization` | `Bearer {{ $node["Config"][0].openrouter_key }}` |
| `model` nel body | es. `anthropic/claude-sonnet-4.6`, `openai/gpt-4o-mini`, `google/gemini-2.5-flash` |

➡️ Risposta in `body.choices[0].message.content` (come OpenAI).

## Prompt builder (Code) — body sicuro per testi complessi

Mettilo **prima** del nodo LLM quando il prompt è lungo o contiene virgolette/a capo.

| Campo | Valore |
|---|---|
| Tipo nodo | **Code** |

```javascript
// Costruisce un payload JSON valido a prova di virgolette.
return items.map(item => ({
  payload: JSON.stringify({
    model: "claude-sonnet-4-6",
    max_tokens: 1024,
    messages: [
      { role: "user", content: item.testo || "" }
    ]
  })
}));
```

Poi nel nodo LLM imposta **Body** = `{{ $json.payload }}`.

## Estrai risposta (Code) — normalizza l'output di qualsiasi LLM

Mettilo **dopo** il nodo LLM per avere sempre un campo `risposta` pulito.

```javascript
return items.map(item => {
  const b = item.body || {};
  const testo =
    b.choices?.[0]?.message?.content              // OpenAI / OpenRouter
    ?? b.content?.[0]?.text                        // Anthropic
    ?? b.candidates?.[0]?.content?.parts?.[0]?.text // Gemini
    ?? '';
  return { risposta: testo };
});
```

---

# 📧 Email

## Resend — invio email (il più semplice, niente OAuth)

Per inviare email senza configurare OAuth Google. Registra un dominio su [resend.com](https://resend.com) e usa una chiave `re_...`.

| Campo | Valore |
|---|---|
| Tipo nodo | **HTTP Request** |
| Metodo | `POST` |
| URL | `https://api.resend.com/emails` |

Headers:

```
Authorization    Bearer {{ $node["Config"][0].resend_key }}
Content-Type     application/json
```

Body:

```json
{
  "from": "Nome <noreply@tuodominio.it>",
  "to": ["{{ $json.destinatario }}"],
  "subject": "{{ $json.oggetto }}",
  "html": "<p>{{ $json.risposta }}</p>"
}
```

<details><summary>JSON nodo</summary>

```json
{
  "id": "resend",
  "type": "httpRequest",
  "name": "Resend",
  "position": { "x": 500, "y": 0 },
  "parameters": {
    "method": "POST",
    "url": "https://api.resend.com/emails",
    "headers": [
      { "name": "Authorization", "value": "Bearer {{ $node[\"Config\"][0].resend_key }}" },
      { "name": "Content-Type", "value": "application/json" }
    ],
    "body": "{ \"from\": \"Nome <noreply@tuodominio.it>\", \"to\": [\"{{ $json.destinatario }}\"], \"subject\": \"{{ $json.oggetto }}\", \"html\": \"<p>{{ $json.risposta }}</p>\" }"
  }
}
```
</details>

## SendGrid — alternativa

| Campo | Valore |
|---|---|
| URL | `https://api.sendgrid.com/v3/mail/send` |
| Header `Authorization` | `Bearer {{ $node["Config"][0].sendgrid_key }}` |

Body:

```json
{
  "personalizations": [ { "to": [ { "email": "{{ $json.destinatario }}" } ] } ],
  "from": { "email": "noreply@tuodominio.it" },
  "subject": "{{ $json.oggetto }}",
  "content": [ { "type": "text/html", "value": "<p>{{ $json.risposta }}</p>" } ]
}
```

---

# ✉️ Gmail (API Google)

> Tutte le API Google qui sotto richiedono un **access token OAuth2** nell'header `Authorization: Bearer ...`. Genera il token col blocco **"Google → Access Token"** in fondo e referenzialo con `{{ $node["Google Token"][0].body.access_token }}`. Scope necessari: `gmail.send`, `gmail.readonly`.

## Gmail — invia email

Serve un nodo **Code** che codifica il messaggio in base64url, poi un **HTTP Request** che lo invia.

**1) Code — costruisci il messaggio**

```javascript
return items.map(item => {
  const a   = item.a || "destinatario@example.com";
  const ogg = item.oggetto || "Senza oggetto";
  const txt = item.testo || "";
  const mime =
    `To: ${a}\r\n` +
    `Subject: ${ogg}\r\n` +
    `Content-Type: text/plain; charset="UTF-8"\r\n\r\n` +
    txt;
  // base64url
  const raw = Buffer.from(mime, "utf8").toString("base64")
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  return { raw };
});
```

**2) HTTP Request — invia**

| Campo | Valore |
|---|---|
| Metodo | `POST` |
| URL | `https://gmail.googleapis.com/gmail/v1/users/me/messages/send` |
| Header `Authorization` | `Bearer {{ $node["Google Token"][0].body.access_token }}` |
| Header `Content-Type` | `application/json` |
| Body | `{ "raw": "{{ $json.raw }}" }` |

## Gmail — cerca email (es. non lette)

| Campo | Valore |
|---|---|
| Metodo | `GET` |
| URL | `https://gmail.googleapis.com/gmail/v1/users/me/messages?q=is:unread&maxResults=10` |
| Header `Authorization` | `Bearer {{ $node["Google Token"][0].body.access_token }}` |

➡️ Ritorna gli ID in `body.messages[]`. Usa la query Gmail standard nel parametro `q` (`from:`, `subject:`, `newer_than:1d`, `has:attachment`…).

## Gmail — leggi un messaggio

| Campo | Valore |
|---|---|
| Metodo | `GET` |
| URL | `https://gmail.googleapis.com/gmail/v1/users/me/messages/{{ $json.id }}?format=full` |
| Header `Authorization` | `Bearer {{ $node["Google Token"][0].body.access_token }}` |

---

# 📁 Google Drive (API Google)

> Scope: `drive` o `drive.file`. Stesso access token OAuth2 dei blocchi Gmail.

## Drive — elenca / cerca file

| Campo | Valore |
|---|---|
| Metodo | `GET` |
| URL | `https://www.googleapis.com/drive/v3/files?q=name contains 'report'&pageSize=20&fields=files(id,name,mimeType,modifiedTime)` |
| Header `Authorization` | `Bearer {{ $node["Google Token"][0].body.access_token }}` |

➡️ File in `body.files[]`.

## Drive — scarica contenuto file

| Campo | Valore |
|---|---|
| Metodo | `GET` |
| URL | `https://www.googleapis.com/drive/v3/files/{{ $json.id }}?alt=media` |
| Header `Authorization` | `Bearer {{ $node["Google Token"][0].body.access_token }}` |

➡️ Ideale per file di testo/JSON (il body torna come testo). Per i Google Docs nativi usa `/export?mimeType=text/plain`.

## Drive — crea cartella

| Campo | Valore |
|---|---|
| Metodo | `POST` |
| URL | `https://www.googleapis.com/drive/v3/files` |
| Header `Authorization` | `Bearer {{ $node["Google Token"][0].body.access_token }}` |
| Header `Content-Type` | `application/json` |
| Body | `{ "name": "{{ $json.nome }}", "mimeType": "application/vnd.google-apps.folder" }` |

## Drive — crea file di testo

| Campo | Valore |
|---|---|
| Metodo | `POST` |
| URL | `https://www.googleapis.com/upload/drive/v3/files?uploadType=media` |
| Header `Authorization` | `Bearer {{ $node["Google Token"][0].body.access_token }}` |
| Header `Content-Type` | `text/plain` |
| Body | `{{ $json.contenuto }}` |

---

# 📅 Google Calendar (API Google)

> Scope: `calendar` o `calendar.events`. Stesso access token OAuth2.

## Calendar — prossimi eventi

| Campo | Valore |
|---|---|
| Metodo | `GET` |
| URL | `https://www.googleapis.com/calendar/v3/calendars/primary/events?timeMin={{ $now }}&singleEvents=true&orderBy=startTime&maxResults=10` |
| Header `Authorization` | `Bearer {{ $node["Google Token"][0].body.access_token }}` |

➡️ Eventi in `body.items[]`.

## Calendar — crea evento

| Campo | Valore |
|---|---|
| Metodo | `POST` |
| URL | `https://www.googleapis.com/calendar/v3/calendars/primary/events` |
| Header `Authorization` | `Bearer {{ $node["Google Token"][0].body.access_token }}` |
| Header `Content-Type` | `application/json` |

Body:

```json
{
  "summary": "{{ $json.titolo }}",
  "description": "{{ $json.descrizione }}",
  "start": { "dateTime": "{{ $json.inizio }}", "timeZone": "Europe/Rome" },
  "end":   { "dateTime": "{{ $json.fine }}",   "timeZone": "Europe/Rome" }
}
```

Le date in formato ISO 8601, es. `2026-06-20T15:00:00`.

---

# 🎙️ Fathom (API meeting)

> Auth: **Bearer** con la tua chiave Fathom (Settings → API). Base: `https://api.fathom.ai/external/v1`.

## Fathom — elenca meeting (con trascrizione)

| Campo | Valore |
|---|---|
| Metodo | `GET` |
| URL | `https://api.fathom.ai/external/v1/meetings?include_transcript=true&include_highlights=true` |
| Header `Authorization` | `Bearer {{ $node["Config"][0].fathom_key }}` |

➡️ Meeting in `body.items[]` (titolo, `meeting_url`, partecipanti, trascrizione, highlights). Filtra per data con `?created_after=2026-06-01T00:00:00Z&created_before=...`.

<details><summary>JSON nodo</summary>

```json
{
  "id": "fathom",
  "type": "httpRequest",
  "name": "Fathom Meetings",
  "position": { "x": 250, "y": 0 },
  "parameters": {
    "method": "GET",
    "url": "https://api.fathom.ai/external/v1/meetings?include_transcript=true&include_highlights=true",
    "headers": [
      { "name": "Authorization", "value": "Bearer {{ $node[\"Config\"][0].fathom_key }}" }
    ],
    "body": ""
  }
}
```
</details>

## Fathom — elenca team

| Campo | Valore |
|---|---|
| Metodo | `GET` |
| URL | `https://api.fathom.ai/external/v1/teams` |
| Header `Authorization` | `Bearer {{ $node["Config"][0].fathom_key }}` |

---

# 🔑 Google → Access Token (refresh)

Genera un access token OAuth2 valido a partire dal refresh token. Mettilo **subito dopo `Config`**: i blocchi Gmail/Drive/Calendar lo referenziano con `{{ $node["Google Token"][0].body.access_token }}`.

**Come ottenere il refresh token una volta sola:** crea credenziali OAuth "Desktop app" su [console.cloud.google.com](https://console.cloud.google.com), abilita le API Gmail/Drive/Calendar, poi usa l'[OAuth Playground](https://developers.google.com/oauthplayground) (ingranaggio → "Use your own OAuth credentials") per autorizzare gli scope e ottenere il `refresh_token`. Incollalo in `Config`.

| Campo | Valore |
|---|---|
| Tipo nodo | **HTTP Request** |
| Nome nodo | `Google Token` |
| Metodo | `POST` |
| URL | `https://oauth2.googleapis.com/token` |
| Header `Content-Type` | `application/x-www-form-urlencoded` |

Body (form-urlencoded, **non** JSON):

```
client_id={{ $node["Config"][0].google_client_id }}&client_secret={{ $node["Config"][0].google_client_secret }}&refresh_token={{ $node["Config"][0].google_refresh_token }}&grant_type=refresh_token
```

➡️ Token in `body.access_token` (valido ~1 ora; questo blocco lo rigenera a ogni run).

<details><summary>JSON nodo</summary>

```json
{
  "id": "googletoken",
  "type": "httpRequest",
  "name": "Google Token",
  "position": { "x": 250, "y": 0 },
  "parameters": {
    "method": "POST",
    "url": "https://oauth2.googleapis.com/token",
    "headers": [
      { "name": "Content-Type", "value": "application/x-www-form-urlencoded" }
    ],
    "body": "client_id={{ $node[\"Config\"][0].google_client_id }}&client_secret={{ $node[\"Config\"][0].google_client_secret }}&refresh_token={{ $node[\"Config\"][0].google_refresh_token }}&grant_type=refresh_token"
  }
}
```
</details>

---

# 🧪 Esempio completo: digest meeting via email ogni mattina

**Schedule** (ogni giorno alle 08:00) → **Config** → **Fathom Meetings** → **Code** (estrai trascrizioni) → **Claude** (riassumi) → **Estrai risposta** → **Resend** (invia).

Catena: `Schedule → Config → Fathom → Code → Claude → Estrai → Resend`.

Il nodo **Code** intermedio prepara il prompt:

```javascript
const meetings = items[0]?.body?.items || [];
const testo = meetings.map(m =>
  `Meeting: ${m.title}\nTrascrizione: ${(m.transcript || "").slice(0, 4000)}`
).join("\n\n---\n\n");
return [{
  payload: JSON.stringify({
    model: "claude-sonnet-4-6",
    max_tokens: 1500,
    messages: [{
      role: "user",
      content: "Riassumi questi meeting in punti chiave e action item:\n\n" + testo
    }]
  })
}];
```

Nel nodo **Claude** imposta Body = `{{ $json.payload }}`; dopo **Estrai risposta** avrai `{{ $json.risposta }}` da mettere nel body di **Resend**. Attiva il workflow (toggle in alto) perché lo Schedule funzioni.

---

*Endpoint e nomi modelli verificati a giugno 2026. I modelli LLM cambiano spesso: se un `model` dà errore, controlla la pagina modelli del provider e aggiorna solo quel campo.*
