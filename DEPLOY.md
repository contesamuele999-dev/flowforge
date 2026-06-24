# Deploy FlowForge su Render + Supabase (gratis)

> ⚠️ NOVITÀ: FlowForge ora ha il **login**. Ogni utente vede solo le proprie
> automazioni. Sono cambiati lo schema del DB e le variabili d'ambiente:
> leggi bene i passi 1 e 3.

## 1. Crea il database su Supabase

1. Vai su [supabase.com](https://supabase.com) → crea un account gratuito
2. Crea un nuovo progetto (scegli una regione europea)
3. Vai su **SQL Editor**, apri il file `supabase-setup.sql` (incluso nel progetto),
   incolla tutto il contenuto e clicca **Run**.
   Lo script crea le tabelle `users`, `workflows`, `executions`, `vars`
   (con la colonna `user_id` per l'isolamento tra utenti) e attiva l'RLS.
4. Vai su **Project Settings → API** e copia:
   - **Project URL** (es. `https://xxxx.supabase.co`)
   - **service_role key** (sezione "Project API keys" → `service_role`, la chiave *segreta*).
     ⚠️ NON la `anon public`: il server è un componente fidato e usa la service_role
     key. Questa chiave NON va mai messa nel browser o in un repository pubblico.

---

## 2. Pubblica il codice su GitHub

1. Vai su [github.com](https://github.com) → crea un account gratuito se non ce l'hai
2. Crea un nuovo repository **privato** (es. `flowforge`) — consigliato privato,
   anche se i segreti veri stanno solo nelle variabili d'ambiente di Render.
3. Carica tutti i file della cartella `no code automation` nel repository
   - **NON** caricare la cartella `node_modules`

---

## 3. Deploy su Render

1. Vai su [render.com](https://render.com) → crea un account gratuito
2. Clicca **New → Web Service** e connetti il repository `flowforge`
3. Render rileverà le impostazioni da `render.yaml`
4. Prima di cliccare Deploy, aggiungi le variabili d'ambiente:
   - `SUPABASE_URL` → il Project URL copiato al passo 1
   - `SUPABASE_KEY` → la **service_role key** copiata al passo 1
   - `JWT_SECRET` → una stringa lunga e casuale a tua scelta (firma le sessioni).
     Esempio per generarne una: su Render clicca "Generate" oppure usa una
     password lunga random. NON condividerla.
   - `NODE_ENV` → `production` (così i cookie di sessione viaggiano solo su HTTPS)
5. Clicca **Create Web Service**

Al primo avvio apri l'URL dell'app: verrai mandato alla pagina **/login**.
Clicca "Registrati", crea il tuo account e inizia a creare automazioni.

---

## 3b. (Solo se avevi già dati prima del login)

Se avevi workflow o variabili creati con la versione precedente, ora risultano
"senza proprietario" e non li vedrai. Per recuperarli:

1. Registrati nell'app con la tua email (crea il tuo utente).
2. Nel SQL Editor di Supabase: `select id, email from users;` e copia il tuo `id`.
3. Apri `supabase-setup.sql`, nella sezione "MIGRAZIONE DATI ESISTENTI" sostituisci
   `IL-TUO-USER-ID` con il tuo id, decommenta le tre `update` ed eseguile.

---

## 4. Tieni il server sempre sveglio con UptimeRobot (gratis)

Il piano gratuito di Render mette il server in sleep dopo 15 minuti senza traffico.
UptimeRobot lo "pinga" ogni 5 minuti, tenendolo sempre attivo.

1. Vai su [uptimerobot.com](https://uptimerobot.com) → crea un account gratuito
2. **Add New Monitor** → **HTTP(s)** → URL della tua app su Render →
   **Monitoring Interval**: 5 minutes → **Create Monitor**

Da questo momento il server non andrà in sleep e i tuoi workflow funzioneranno 24/7.

---

## Note importanti

- **service_role key vs anon key**: il backend usa la service_role key perché fa da
  guardiano e filtra ogni query per `user_id`. È l'isolamento *reale* tra utenti.
- **RLS (Row Level Security)**: attivato dallo script come *difesa secondaria*. La
  service_role key lo bypassa (è corretto), ma se mai una tabella venisse interrogata
  con la chiave `anon` (es. dal browser), per default nessuna riga sarebbe accessibile.
- **JWT_SECRET**: se cambi questo valore, tutte le sessioni attive vengono invalidate
  (gli utenti dovranno rifare il login). Tienilo stabile e segreto.
- **Webhook e scheduler** girano nel contesto del proprietario del workflow: ogni
  automazione usa le variabili globali (`$vars`) del suo utente.
- **Piani gratuiti**: Supabase 500MB / 2GB banca mese; Render sleep dopo 15 min
  senza UptimeRobot.
