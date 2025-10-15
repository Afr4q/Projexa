-- Create users table
create table if not exists public.users (
  id uuid primary key default auth.uid(),
  email text unique not null,
  name text,
  role text check (role in ('admin', 'guide', 'student')) default 'student',
  department text,
  specialization text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Enable RLS
alter table public.users enable row level security;

-- Add a trigger to update updated_at
create or replace function public.handle_updated_at() 
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger users_updated_at
  before update on public.users
  for each row
  execute function public.handle_updated_at();

-- Create user profile function
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, email, role)
  values (new.id, new.email, 'student')
  on conflict (id) do nothing;
  return new;
end;
$$ language plpgsql;

-- Add trigger for new user signup
create or replace trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Policies
-- 1. Everyone can read their own data
create policy "Users can view own user data"
  on public.users
  for select
  using (auth.uid() = id);

-- 2. Admin can read all users
create policy "Admins can view all users"
  on public.users
  for select
  using (
    exists (
      select 1 from public.users
      where id = auth.uid()
      and role = 'admin'
    )
  );

-- 3. Admin can create users
create policy "Admins can create users"
  on public.users
  for insert
  with check (
    exists (
      select 1 from public.users
      where id = auth.uid()
      and role = 'admin'
    )
  );

-- 4. Admin can update users
create policy "Admins can update users"
  on public.users
  for update
  using (
    exists (
      select 1 from public.users
      where id = auth.uid()
      and role = 'admin'
    )
  );

-- 5. Users can update their own name, department, and specialization
create policy "Users can update own profile"
  on public.users
  for update
  using (auth.uid() = id)
  with check (
    auth.uid() = id 
    and new.role = old.role -- Can't change own role
    and new.email = old.email -- Can't change email
  );