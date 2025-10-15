-- Create rubrics table
create table if not exists public.rubrics (
  id uuid default gen_random_uuid() primary key,
  phase_id uuid references public.phases(id) on delete cascade,
  name text not null,
  description text not null,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- Enable RLS
alter table public.rubrics enable row level security;

-- Create policy to allow admin to manage rubrics for their department's phases
create policy "Admins can manage rubrics for their department's phases"
  on public.rubrics
  for all
  using (
    exists (
      select 1 from public.phases p
      inner join public.users u on u.id = auth.uid()
      where p.id = rubrics.phase_id
      and p.department = u.department
      and u.role = 'admin'
    )
  );

-- Create policy to allow any authenticated user to view rubrics
create policy "Users can view rubrics"
  on public.rubrics
  for select
  using (
    exists (
      select 1 from public.phases p
      inner join public.users u on u.id = auth.uid()
      where p.id = rubrics.phase_id
    )
  );