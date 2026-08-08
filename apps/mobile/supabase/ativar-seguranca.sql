-- Execute uma vez no SQL Editor depois de cadastrar Sávio e Gláucio no Auth.
alter table public.docampo_sync_events enable row level security;

drop policy if exists "docampo_equipe_consultar" on public.docampo_sync_events;
drop policy if exists "docampo_equipe_inserir" on public.docampo_sync_events;

create policy "docampo_equipe_consultar"
on public.docampo_sync_events
for select
to authenticated
using (
  lower(auth.jwt() ->> 'email') in (
    'saviojsalazar@gmail.com',
    'glaucio.luciano.araujo@gmail.com'
  )
);

create policy "docampo_equipe_inserir"
on public.docampo_sync_events
for insert
to authenticated
with check (
  lower(auth.jwt() ->> 'email') in (
    'saviojsalazar@gmail.com',
    'glaucio.luciano.araujo@gmail.com'
  )
);
