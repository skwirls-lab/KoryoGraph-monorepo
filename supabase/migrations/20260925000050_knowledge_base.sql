-- 0050 Knowledge base for RAG (§2.5, M4.03). Documents (policies, FAQs, curriculum text, an auto-generated
-- schedule digest) are chunked and embedded; search is hybrid — reciprocal rank fusion of vector cosine
-- similarity and full-text rank. Embeddings record their model: a query only compares against chunks
-- embedded by the same model, and chunks without an embedding are still found by text. Every tenant member
-- can read the KB (the Home assistant answers from it); settings.manage edits it.

create table public.kb_documents (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  kind text not null default 'policy' check (kind in ('policy', 'faq', 'curriculum', 'schedule_digest', 'other')),
  title text not null check (length(trim(title)) > 0),
  body text not null default '',
  source text not null default 'manual' check (source in ('manual', 'auto')),
  audience text not null default 'everyone' check (audience in ('everyone', 'staff')),
  chunk_count int not null default 0,
  embedding_model text,
  indexed_at timestamptz,
  index_error text,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
select app.setup_tenant_table('public.kb_documents', 'settings.manage', null);

create table public.kb_chunks (
  id uuid primary key default gen_random_uuid(),
  tenant_id uuid not null references public.tenants (id) on delete cascade,
  document_id uuid not null,
  ordinal int not null,
  content text not null,
  embedding extensions.vector,
  embedding_model text,
  tsv tsvector generated always as (to_tsvector('english', content)) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (document_id, ordinal),
  foreign key (tenant_id, document_id) references public.kb_documents (tenant_id, id) on delete cascade
);
create index kb_chunks_tsv on public.kb_chunks using gin (tsv);
select app.setup_tenant_table('public.kb_chunks', 'settings.manage', null);

-- Staff-only documents stay out of member reads (the Home assistant only sees 'everyone' documents).
drop policy if exists kb_documents_tenant_select on public.kb_documents;
create policy kb_documents_member_select on public.kb_documents for select to authenticated
  using (tenant_id = (select app.tenant_id()) and (audience = 'everyone' or (select app.has_permission('desk.access'))));
drop policy if exists kb_chunks_tenant_select on public.kb_chunks;
create policy kb_chunks_member_select on public.kb_chunks for select to authenticated
  using (tenant_id = (select app.tenant_id()) and document_id in (select id from public.kb_documents));

-- Hybrid search (security invoker: the caller's RLS applies). p_embedding/p_model may be null → text only.
create or replace function public.kb_search(p_query text, p_embedding extensions.vector default null, p_model text default null, p_k int default 5)
returns table (chunk_id uuid, document_id uuid, title text, kind text, content text, score double precision, vector_rank int, text_rank int)
language sql
stable
security invoker
set search_path = ''
as $$
  with v as (
    select c.id, row_number() over (order by c.embedding operator(extensions.<=>) p_embedding) as r
    from public.kb_chunks c
    where p_embedding is not null and c.embedding is not null and c.embedding_model = p_model
      and extensions.vector_dims(c.embedding) = extensions.vector_dims(p_embedding)
    order by c.embedding operator(extensions.<=>) p_embedding
    limit 50
  ),
  t as (
    select c.id, row_number() over (order by ts_rank_cd(c.tsv, q) desc) as r
    from public.kb_chunks c, websearch_to_tsquery('english', coalesce(p_query, '')) q
    where c.tsv @@ q
    order by ts_rank_cd(c.tsv, q) desc
    limit 50
  ),
  fused as (
    select coalesce(v.id, t.id) as id, coalesce(1.0 / (60 + v.r), 0) + coalesce(1.0 / (60 + t.r), 0) as score, v.r::int as vr, t.r::int as tr
    from v full join t on t.id = v.id
  )
  select c.id, c.document_id, d.title, d.kind, c.content, f.score, f.vr, f.tr
  from fused f join public.kb_chunks c on c.id = f.id join public.kb_documents d on d.id = c.document_id
  order by f.score desc, c.ordinal
  limit greatest(1, least(p_k, 20));
$$;
grant execute on function public.kb_search(text, extensions.vector, text, int) to authenticated;

insert into public.jobs (name, schedule, description) values
  ('kb_schedule_digest', '30 3 * * *', 'Regenerate each school''s schedule digest in the knowledge base')
on conflict (name) do update set schedule = excluded.schedule, description = excluded.description;

select app.index_foreign_keys();
