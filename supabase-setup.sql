-- ============================================================
--  FlowForge — Schema database (Supabase / PostgreSQL)
--  Esegui questo script nel SQL Editor di Supabase.
--  È idempotente: puoi rieseguirlo senza rompere dati esistenti.
-- ============================================================

-- ---- Utenti ----
create table if not exists users (
  id            text primary key,
  email         text unique not null,
  password_hash text not null,
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);
-- email case-insensitive: indichiamo l'unicità su lower(email)
create unique index if not exists users_email_lower_idx on users (lower(email));

-- ---- Workflows ----
create table if not exists workflows (
  id         text primary key,
  data       jsonb not null,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
-- ogni workflow appartiene a un utente
alter table workflows add column if not exists user_id text;
create index if not exists workflows_user_idx on workflows (user_id);

-- ---- Executions ----
create table if not exists executions (
  id          text primary key,
  workflow_id text,
  started_at  timestamptz,
  status      text,
  data        jsonb not null
);
alter table executions add column if not exists user_id text;
create index if not exists executions_user_idx on executions (user_id);

-- ---- Variabili globali (ora per-utente) ----
-- La vecchia tabella vars aveva PK su (key). Ora la chiave è (user_id, key).
create table if not exists vars (
  key   text not null,
  value text,
  user_id text
);
-- se la tabella esisteva con pk su key, rilassiamo e creiamo la pk composta
do $$
begin
  if exists (
    select 1 from information_schema.table_constraints
    where table_name = 'vars' and constraint_type = 'PRIMARY KEY'
  ) then
    execute (
      select 'alter table vars drop constraint ' || quote_ident(constraint_name)
      from information_schema.table_constraints
      where table_name = 'vars' and constraint_type = 'PRIMARY KEY' limit 1
    );
  end if;
end $$;
alter table vars add column if not exists user_id text;
-- pulizia: rimuovi righe orfane (user_id null) PRIMA della PK, altrimenti
-- la primary key (user_id, key) fallisce con errore 23502 (null value).
delete from vars where user_id is null;
-- chiave primaria composta (un utente non può avere due var con lo stesso nome)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_name = 'vars' and constraint_type = 'PRIMARY KEY'
  ) then
    alter table vars add constraint vars_pkey primary key (user_id, key);
  end if;
end $$;

-- ============================================================
--  MIGRAZIONE DATI ESISTENTI (opzionale)
--  Se avevi già workflow/var creati PRIMA del login, erano
--  "senza proprietario". Assegnali a un utente owner.
--
--  COME FARE:
--  1) Registrati nell'app con la tua email -> crea il tuo utente.
--  2) Trova il tuo id:  select id, email from users;
--  3) Sostituisci 'IL-TUO-USER-ID' qui sotto e decommenta:
--
-- update workflows  set user_id = 'IL-TUO-USER-ID' where user_id is null;
-- update executions set user_id = 'IL-TUO-USER-ID' where user_id is null;
-- update vars       set user_id = 'IL-TUO-USER-ID' where user_id is null;
-- ============================================================


-- ============================================================
--  RLS (Row Level Security) — DIFESA SECONDARIA
--
--  Il server FlowForge usa la SERVICE_ROLE key e fa già da
--  guardiano filtrando ogni query per user_id. La service key
--  BYPASSA l'RLS, quindi queste policy NON limitano il server.
--
--  Le attiviamo come rete di sicurezza: se mai la tabella
--  venisse interrogata con la chiave 'anon' (es. dal browser),
--  di default NESSUNA riga sarà leggibile/scrivibile.
--  Questo è il comportamento "deny by default" che vuoi.
--
--  -> Attivare RLS qui è consigliato e a costo zero per l'app.
-- ============================================================
alter table users      enable row level security;
alter table workflows  enable row level security;
alter table executions enable row level security;
alter table vars       enable row level security;
-- Nota: non creiamo policy permissive per 'anon'. Senza policy,
-- con RLS attivo, l'accesso via anon key è negato. La service_role
-- key continua a funzionare normalmente per il backend.
