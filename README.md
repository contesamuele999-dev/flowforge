# ⚡ FlowForge — clone semplificato di n8n

Automazione no-code con editor visuale di workflow. Backend Node.js + frontend vanilla, zero dipendenze native.

## Avvio

Serve Node.js 18+ (https://nodejs.org). Poi, in questa cartella:

```
npm install
npm start
```

Apri **http://localhost:5678** nel browser.

## Come si usa

1. **+ Nuovo workflow** nella sidebar
2. Doppio click sul canvas (o **+ Nodo**) per aggiungere nodi
3. Trascina dalla porta destra di un nodo alla porta sinistra di un altro per collegarli
4. Click su un nodo per configurarlo nel pannello a destra
5. **▶ Esegui** per lanciare il workflow, **Esecuzioni** per vedere i risultati nodo per nodo

## Nodi disponibili

| Nodo | Tipo | Descrizione |
|---|---|---|
| Manual Trigger | Trigger | Avvio manuale con ▶ Esegui |
| Webhook | Trigger | Avvio via HTTP su `/webhook/<path>` (richiede workflow **attivo**) |
| Schedule | Trigger | Ogni N minuti/ore o ogni giorno a un orario (richiede workflow **attivo**) |
| HTTP Request | Azione | Chiama API esterne (GET/POST/PUT/PATCH/DELETE, headers, body) |
| Edit Fields | Azione | Aggiunge/modifica campi degli item |
| Code | Azione | JavaScript libero sugli item (`items` in input, `return` per l'output) |
| IF | Logica | Due rami: true / false |
| Filter | Logica | Lascia passare solo gli item che soddisfano la condizione |
| Merge | Logica | Unisce più rami |
| Wait | Logica | Pausa (max 30s) |
| Google Token | Integrazioni | Genera un access token OAuth2 dal refresh token Google |
| LLM (AI) | Integrazioni | Chiama OpenAI, Claude, Gemini o OpenRouter |
| Gmail | Integrazioni | Invia, cerca o legge email |
| Email | Integrazioni | Email transazionali via Resend o SendGrid |
| Google Drive | Integrazioni | Elenca, scarica o crea file/cartelle |
| Google Calendar | Integrazioni | Elenca o crea eventi |
| Fathom | Integrazioni | Meeting, trascrizioni e team |

## Integrazioni (nodi nativi)

I nodi nella categoria **Integrazioni** chiamano direttamente le API dei servizi: niente HTTP Request da configurare a mano. Per le chiavi e l'autenticazione (incluso come ottenere il refresh token Google una volta sola) vedi **[BLOCCHI-PRONTI.md](BLOCCHI-PRONTI.md)**.

Pattern consigliato: un nodo **Edit Fields** chiamato `Config` con tutte le chiavi → (per Google) un nodo **Google Token** → i nodi Gmail/Drive/Calendar, che usano di default `{{ $node["Google Token"][0].access_token }}`. I nodi LLM e Fathom usano direttamente la chiave da `{{ $node["Config"][0].nome_chiave }}`.

> Suggerimento: invece di ripetere le chiavi nel nodo Config, usa le **Variabili globali** (sotto) e richiamale con `{{ $vars.NOME }}`.

## Produttività (novità)

- **Variabili globali** — pulsante `🔑 Variabili globali` nella sidebar. Salva chiavi/segreti una volta sola e richiamali ovunque con `{{ $vars.NOME }}` (anche nel nodo Code). Sono salvate in `data/vars.json`, mascherate nell'UI e condivise da tutti i workflow.
- **Template** — `📋 Da template`: crea un workflow pronto con un click (digest meeting, webhook→Claude, AI playground, agenda via email).
- **Import / Export** — `📥 Importa JSON` (crea un workflow da JSON, anche dai blocchi di BLOCCHI-PRONTI.md) e `Esporta` (copia/scarica il workflow corrente).
- **Scorciatoie editor** — nel pannello del nodo: `⧉ Duplica` (anche **Ctrl+D**), `▶ Da qui` (esegue partendo dal nodo selezionato), `Disabilita/Abilita` (salta il nodo). Nella sidebar ogni workflow ha `⧉` duplica e `🗑` elimina.

> ⚠️ Le chiavi finiscono in chiaro in `data/workflows.json`/`data/vars.json`: non condividere quei file. In esportazione, preferisci le variabili globali così il JSON non contiene segreti.

## Espressioni

Nei campi testo puoi usare `{{ ... }}` con accesso ai dati dell'item corrente:

- `{{ $json.campo }}` — campo dell'item in ingresso
- `{{ $json.prezzo * 2 }}` — espressioni JavaScript
- `{{ $node["Nome Nodo"] }}` — output di un nodo precedente
- `{{ $now }}` — timestamp corrente

Nel webhook, i dati della richiesta arrivano come `{{ $json.body.x }}`, `{{ $json.query.x }}`, `{{ $json.headers.x }}`.

## Esempio: webhook che risponde

1. Nodo **Webhook** con path `prova` → nodo **Edit Fields** con campo `ricevuto` = `{{ $json.body.nome }}`
2. Attiva il workflow (toggle in alto) e salva
3. `curl -X POST http://localhost:5678/webhook/prova -H "Content-Type: application/json" -d "{\"nome\":\"samuele\"}"`

## Struttura

```
server.js     → API REST, webhook, scheduler
engine.js     → motore di esecuzione dei nodi
storage.js    → persistenza su file JSON (cartella data/)
public/       → editor visuale (HTML/CSS/JS)
data/         → workflow ed esecuzioni salvate (creata al primo salvataggio)
```

Scorciatoie: `Ctrl+S` salva, `Canc` elimina il nodo selezionato, rotella = zoom, trascina lo sfondo = pan, click su una connessione = eliminala.
