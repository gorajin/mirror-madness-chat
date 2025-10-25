-- Create jobs table for reaction video generation
create table if not exists public.reaction_jobs (
  id uuid primary key,
  status text not null check (status in ('queued','running','succeeded','failed')),
  video_url text,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- Timestamp trigger
create or replace function public.update_updated_at_column()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists trg_reaction_jobs_updated_at on public.reaction_jobs;
create trigger trg_reaction_jobs_updated_at
before update on public.reaction_jobs
for each row execute function public.update_updated_at_column();

-- Enable RLS and allow public read (write happens via edge function with service role)
alter table public.reaction_jobs enable row level security;

drop policy if exists "Allow read job status (public)" on public.reaction_jobs;
create policy "Allow read job status (public)"
  on public.reaction_jobs
  for select
  using (true);
