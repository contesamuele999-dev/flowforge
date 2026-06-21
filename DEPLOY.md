# Deploy FlowForge su Render + Supabase (gratis)

## 1. Crea il database su Supabase

1. Vai su [supabase.com](https://supabase.com) → crea un account gratuito
2. Crea un nuovo progetto (scegli una regione europea)
3. Vai su **SQL Editor** e incolla questo script per creare le tabelle:

```sql
create table workflows (
  id text primary key,
  data jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table executions (
  id text primary key,
  workflow_id text,
  started_at timestamptz,
  status text,
  data jsonb not null
);

create table vars (
  key text primary key,
  value text
);
```

4. Clicca **Run** per eseguire lo script
5. Vai su **Project Settings → API** e copia:
   - **Project URL** (es. `https://xxxx.supabase.co`)
   - **anon public key** (la chiave lunga sotto "Project API keys")

---

## 2. Pubblica il codice su GitHub

1. Vai su [github.com](https://github.com) → crea un account gratuito se non ce l'hai
2. Crea un nuovo repository (es. `flowforge`)
3. Carica tutti i file della cartella `no code automation` nel repository
   - **NON** caricare la cartella `node_modules` (è pesante e non serve)

---

## 3. Deploy su Render

1. Vai su [render.com](https://render.com) → crea un account gratuito
2. Clicca **New → Web Service**
3. Connetti il tuo account GitHub e seleziona il repository `flowforge`
4. Render rileverà automaticamente le impostazioni da `render.yaml`
5. Prima di cliccare Deploy, aggiungi le variabili d'ambiente:
   - `SUPABASE_URL` → il Project URL copiato al passo 1
   - `SUPABASE_KEY` → la anon public key copiata al passo 1
6. Clicca **Create Web Service**

Render farà il build automaticamente e in pochi minuti l'app sarà online.

---

## 4. Tieni il server sempre sveglio con UptimeRobot (gratis)

Il piano gratuito di Render mette il server in sleep dopo 15 minuti senza traffico. UptimeRobot lo "pinga" ogni 5 minuti, tenendolo sempre attivo.

1. Vai su [uptimerobot.com](https://uptimerobot.com) → crea un account gratuito
2. Clicca **Add New Monitor**
3. Imposta:
   - **Monitor Type**: HTTP(s)
   - **Friendly Name**: FlowForge
   - **URL**: l'indirizzo della tua app su Render (es. `https://flowforge.onrender.com`)
   - **Monitoring Interval**: 5 minutes
4. Clicca **Create Monitor**

Da questo momento il server non andrà mai in sleep e i tuoi workflow funzioneranno 24/7 anche a PC spento.

---

## Note importanti

- **Piano gratuito Render**: senza UptimeRobot, il server va in sleep dopo 15 minuti. Con UptimeRobot rimane sempre attivo.
- **Piano gratuito Supabase**: 500MB di storage, 2GB di banda/mese. Più che sufficiente per FlowForge.
- **Lo scheduler** (trigger "ogni X minuti") funziona correttamente solo se il server è sempre sveglio — per questo UptimeRobot è importante.
