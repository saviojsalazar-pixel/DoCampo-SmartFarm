-- Do Campo SmartFarm 1.9.46 — INSTALAÇÃO E RESTAURAÇÃO DE FÁBRICA
-- ATENÇÃO: este é o único script oficial desta versão. Ele cria/atualiza a
-- arquitetura v2 e APAGA definitivamente todos os registros já existentes nas
-- tabelas v2. Execute uma única vez, antes de importar a planilha oficial.

begin;

create table if not exists public.docampo_app_state (
  id text primary key,
  generation uuid not null,
  schema_version integer not null,
  updated_at timestamptz not null default now()
);

insert into public.docampo_app_state (id, generation, schema_version, updated_at)
values ('primary', '8d487154-0a7b-4d39-9228-7c6cc414d979', 2, now())
on conflict (id) do update set
  generation = excluded.generation,
  schema_version = excluded.schema_version,
  updated_at = excluded.updated_at;

create table if not exists public.docampo_sync_events_v2 (
  server_sequence bigint generated always as identity primary key,
  id uuid not null unique,
  generation uuid not null,
  entity_type text not null,
  entity_id text not null,
  operation text not null check (operation in ('upsert', 'delete')),
  payload jsonb not null default '{}'::jsonb,
  device_id text not null,
  user_name text not null,
  client_created_at timestamptz not null,
  server_created_at timestamptz not null default now(),
  base_revision integer not null default 0,
  app_version text not null
);

create index if not exists docampo_sync_events_v2_generation_sequence_idx
  on public.docampo_sync_events_v2 (generation, server_sequence);
create index if not exists docampo_sync_events_v2_entity_idx
  on public.docampo_sync_events_v2 (generation, entity_type, entity_id, server_sequence desc);

create table if not exists public.docampo_entities_v2 (
  generation uuid not null,
  entity_type text not null,
  entity_id text not null,
  payload jsonb not null default '{}'::jsonb,
  operation text not null check (operation in ('upsert', 'delete')),
  server_sequence bigint not null,
  server_created_at timestamptz not null,
  device_id text not null,
  user_name text not null,
  app_version text not null,
  primary key (generation, entity_type, entity_id)
);

create index if not exists docampo_entities_v2_generation_sequence_idx
  on public.docampo_entities_v2 (generation, server_sequence);

create or replace function public.docampo_refresh_entity_v2()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.docampo_entities_v2 (
    generation, entity_type, entity_id, payload, operation,
    server_sequence, server_created_at, device_id, user_name, app_version
  )
  values (
    new.generation, new.entity_type, new.entity_id, new.payload, new.operation,
    new.server_sequence, new.server_created_at, new.device_id, new.user_name, new.app_version
  )
  on conflict (generation, entity_type, entity_id) do update set
    payload = excluded.payload,
    operation = excluded.operation,
    server_sequence = excluded.server_sequence,
    server_created_at = excluded.server_created_at,
    device_id = excluded.device_id,
    user_name = excluded.user_name,
    app_version = excluded.app_version
  where excluded.server_sequence > public.docampo_entities_v2.server_sequence
    and (
      public.docampo_entities_v2.operation <> 'delete'
      or excluded.operation = 'delete'
      or (
        coalesce(excluded.payload ->> 'restoredAt', '') <> ''
        and (excluded.payload ->> 'restoredAt') > coalesce(public.docampo_entities_v2.payload ->> 'deletedAt', '')
      )
    );
  return new;
end;
$$;

drop trigger if exists docampo_sync_events_v2_refresh_entity on public.docampo_sync_events_v2;
create trigger docampo_sync_events_v2_refresh_entity
after insert on public.docampo_sync_events_v2
for each row execute function public.docampo_refresh_entity_v2();

-- A limpeza acontece somente depois que todas as tabelas existem. Isso torna
-- o mesmo arquivo seguro tanto em projeto novo quanto em projeto já testado.
lock table public.docampo_sync_events_v2 in access exclusive mode;
lock table public.docampo_entities_v2 in access exclusive mode;
truncate table public.docampo_sync_events_v2 restart identity;
truncate table public.docampo_entities_v2;

alter table public.docampo_app_state enable row level security;
alter table public.docampo_sync_events_v2 enable row level security;
alter table public.docampo_entities_v2 enable row level security;

drop policy if exists docampo_v2_state_read on public.docampo_app_state;
drop policy if exists docampo_v2_events_read on public.docampo_sync_events_v2;
drop policy if exists docampo_v2_events_insert on public.docampo_sync_events_v2;
drop policy if exists docampo_v2_entities_read on public.docampo_entities_v2;

create policy docampo_v2_state_read
on public.docampo_app_state for select to authenticated
using (
  lower(auth.jwt() ->> 'email') in (
    'saviojsalazar@gmail.com',
    'glaucio.luciano.araujo@gmail.com'
  )
);

create policy docampo_v2_events_read
on public.docampo_sync_events_v2 for select to authenticated
using (
  generation = (
    select generation from public.docampo_app_state where id = 'primary'
  )
  and lower(auth.jwt() ->> 'email') in (
    'saviojsalazar@gmail.com',
    'glaucio.luciano.araujo@gmail.com'
  )
);

create policy docampo_v2_events_insert
on public.docampo_sync_events_v2 for insert to authenticated
with check (
  generation = (
    select generation from public.docampo_app_state where id = 'primary'
  )
  and lower(auth.jwt() ->> 'email') in (
    'saviojsalazar@gmail.com',
    'glaucio.luciano.araujo@gmail.com'
  )
);

create policy docampo_v2_entities_read
on public.docampo_entities_v2 for select to authenticated
using (
  generation = (
    select generation from public.docampo_app_state where id = 'primary'
  )
  and lower(auth.jwt() ->> 'email') in (
    'saviojsalazar@gmail.com',
    'glaucio.luciano.araujo@gmail.com'
  )
);

revoke all on public.docampo_app_state from anon;
revoke all on public.docampo_sync_events_v2 from anon;
revoke all on public.docampo_entities_v2 from anon;
grant select on public.docampo_app_state to authenticated;
grant select, insert on public.docampo_sync_events_v2 to authenticated;
grant select on public.docampo_entities_v2 to authenticated;
grant usage, select on sequence public.docampo_sync_events_v2_server_sequence_seq to authenticated;

-- Arquivos PDF compartilhados pelos aparelhos. O bucket é privado: somente os
-- dois usuários autenticados podem ler, gravar, substituir ou excluir arquivos.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'docampo-documents',
  'docampo-documents',
  false,
  26214400,
  array['application/pdf', 'image/jpeg']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists docampo_documents_select on storage.objects;
drop policy if exists docampo_documents_insert on storage.objects;
drop policy if exists docampo_documents_update on storage.objects;
drop policy if exists docampo_documents_delete on storage.objects;

create policy docampo_documents_select
on storage.objects for select to authenticated
using (
  bucket_id = 'docampo-documents'
  and lower(auth.jwt() ->> 'email') in (
    'saviojsalazar@gmail.com',
    'glaucio.luciano.araujo@gmail.com'
  )
);

create policy docampo_documents_insert
on storage.objects for insert to authenticated
with check (
  bucket_id = 'docampo-documents'
  and lower(auth.jwt() ->> 'email') in (
    'saviojsalazar@gmail.com',
    'glaucio.luciano.araujo@gmail.com'
  )
);

create policy docampo_documents_update
on storage.objects for update to authenticated
using (
  bucket_id = 'docampo-documents'
  and lower(auth.jwt() ->> 'email') in (
    'saviojsalazar@gmail.com',
    'glaucio.luciano.araujo@gmail.com'
  )
)
with check (
  bucket_id = 'docampo-documents'
  and lower(auth.jwt() ->> 'email') in (
    'saviojsalazar@gmail.com',
    'glaucio.luciano.araujo@gmail.com'
  )
);

create policy docampo_documents_delete
on storage.objects for delete to authenticated
using (
  bucket_id = 'docampo-documents'
  and lower(auth.jwt() ->> 'email') in (
    'saviojsalazar@gmail.com',
    'glaucio.luciano.araujo@gmail.com'
  )
);

commit;
