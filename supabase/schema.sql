-- Enable pg_trgm for similarity
create extension if not exists pg_trgm;

-- Projects table minimal fields needed
create table if not exists public.projects (
	id uuid primary key default gen_random_uuid(),
	student_id uuid,
	title text not null,
	normalized_title text not null,
	phase0_status text check (phase0_status in ('accepted','rejected','pending')) default 'pending',
	phase0_similarity numeric default 0,
	created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_projects_title_trgm on public.projects using gin (title gin_trgm_ops);
create index if not exists idx_projects_normalized_title on public.projects (normalized_title);

-- Rubric tables
create table if not exists public.rubric_sets (
	id uuid primary key default gen_random_uuid(),
	name text not null,
	active boolean default true
);

create table if not exists public.rubric_items (
	id uuid primary key default gen_random_uuid(),
	rubric_set_id uuid references public.rubric_sets(id) on delete cascade,
	label text,
	required boolean default true,
	min_count int default 1,
	synonyms text[]
);

create table if not exists public.rubric_terms (
	id uuid primary key default gen_random_uuid(),
	rubric_item_id uuid references public.rubric_items(id) on delete cascade,
	term text not null
);

create table if not exists public.review_phases (
	id uuid primary key default gen_random_uuid(),
	project_id uuid references public.projects(id) on delete cascade,
	phase_number int not null,
	status text check (status in ('accepted','rejected','pending','temp_accepted','temp_rejected')) default 'pending',
	rubric_set_id uuid references public.rubric_sets(id),
	uploaded_pdf_url text,
	missing_terms text[],
	created_at timestamptz default now()
);

create table if not exists public.pdf_text_extractions (
	id uuid primary key default gen_random_uuid(),
	review_phase_id uuid references public.review_phases(id) on delete cascade,
	text text,
	extracted_at timestamptz default now()
);

-- Similarity RPC
create or replace function public.find_similar_projects(input_title text, threshold float)
returns table (id uuid, title text, similarity float)
language sql stable as $$
  select p.id, p.title, similarity(p.title, input_title) as similarity
  from public.projects p
  where similarity(p.title, input_title) >= threshold
  order by similarity desc
  limit 5;
$$;

-- Storage bucket note: create a bucket named 'reviews' in Supabase Storage.
