create table if not exists public.docampo_sync_events (
  id uuid primary key,
  entity_type text not null,
  entity_id text not null,
  operation text not null check (operation in ('upsert','delete')),
  payload jsonb not null default '{}'::jsonb,
  device_id text not null,
  user_name text not null,
  created_at timestamptz not null,
  base_revision integer not null default 0,
  app_version text not null default '1.9.3'
);
create index if not exists docampo_sync_events_created_idx on public.docampo_sync_events(created_at);
create index if not exists docampo_sync_events_entity_idx on public.docampo_sync_events(entity_type,entity_id);
alter table public.docampo_sync_events enable row level security;
-- Não habilite acesso anônimo em produção. As políticas de usuários serão criadas
-- depois que os e-mails de Sávio e Gláucio forem cadastrados no Supabase Auth.
