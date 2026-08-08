-- Do Campo SmartFarm - armazenamento privado de PDFs
-- Executar uma única vez no SQL Editor do projeto Supabase.

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('docampo-documents', 'docampo-documents', false, 20971520, array['application/pdf'])
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists "Do Campo documentos leitura" on storage.objects;
drop policy if exists "Do Campo documentos envio" on storage.objects;
drop policy if exists "Do Campo documentos atualizacao" on storage.objects;

create policy "Do Campo documentos leitura"
on storage.objects for select
to authenticated
using (
  bucket_id = 'docampo-documents'
  and lower(auth.jwt() ->> 'email') in ('saviojsalazar@gmail.com','glaucio.luciano.araujo@gmail.com')
);

create policy "Do Campo documentos envio"
on storage.objects for insert
to authenticated
with check (
  bucket_id = 'docampo-documents'
  and lower(auth.jwt() ->> 'email') in ('saviojsalazar@gmail.com','glaucio.luciano.araujo@gmail.com')
);

create policy "Do Campo documentos atualizacao"
on storage.objects for update
to authenticated
using (
  bucket_id = 'docampo-documents'
  and lower(auth.jwt() ->> 'email') in ('saviojsalazar@gmail.com','glaucio.luciano.araujo@gmail.com')
)
with check (
  bucket_id = 'docampo-documents'
  and lower(auth.jwt() ->> 'email') in ('saviojsalazar@gmail.com','glaucio.luciano.araujo@gmail.com')
);
