-- ============================================================
--  FlowForge — FIX tabella "vars" (errore PK su user_id null)
--  Incolla ed esegui questo nel SQL Editor di Supabase.
--  Idempotente: puoi rieseguirlo senza problemi.
--
--  Causa: la tabella vars aveva righe vecchie con user_id NULL.
--  La primary key (user_id, key) non ammette NULL -> errore 23502.
--  Soluzione: cancelliamo le righe orfane, poi creiamo la PK.
-- ============================================================

-- 0) Assicura che la colonna user_id esista
alter table vars add column if not exists user_id text;

-- 1) (OPZIONALE) Guarda quante righe orfane hai PRIMA di cancellarle.
--    Decommenta per controllare:
-- select count(*) as orfane from vars where user_id is null;
-- select * from vars where user_id is null;

-- 2) Cancella le variabili senza proprietario (scelta: eliminarle)
delete from vars where user_id is null;

-- 3) Rimuovi un'eventuale primary key vecchia (es. PK solo su "key")
do $$
declare cname text;
begin
  select constraint_name into cname
  from information_schema.table_constraints
  where table_name = 'vars' and constraint_type = 'PRIMARY KEY'
  limit 1;
  if cname is not null then
    execute 'alter table vars drop constraint ' || quote_ident(cname);
  end if;
end $$;

-- 4) Ora la colonna non ha più NULL: crea la PK composta (user_id, key)
do $$
begin
  if not exists (
    select 1 from information_schema.table_constraints
    where table_name = 'vars' and constraint_type = 'PRIMARY KEY'
  ) then
    alter table vars add constraint vars_pkey primary key (user_id, key);
  end if;
end $$;

-- 5) Verifica finale: deve restituire 0 righe NULL e mostrare la PK
select count(*) as righe_null_rimaste from vars where user_id is null;
