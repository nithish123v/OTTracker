-- OTTrack database
create extension if not exists pgcrypto;

create table if not exists public.patients (
  id bigint primary key,
  name text not null,
  ip_no text not null,
  reg_no text,
  diagnosis text not null,
  category text not null,
  consulting_dr text,
  room_no text,
  referral_date date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.session_records (
  id text primary key,
  patient_id bigint not null references public.patients(id) on delete cascade,
  session_date date not null,
  seen boolean,
  reason text,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(patient_id, session_date)
);

alter table public.patients enable row level security;
alter table public.session_records enable row level security;

-- Authenticated users can use the shared OT database.
create policy "authenticated users read patients"
on public.patients for select to authenticated using (true);

create policy "authenticated users insert patients"
on public.patients for insert to authenticated with check (true);

create policy "authenticated users update patients"
on public.patients for update to authenticated using (true) with check (true);

create policy "authenticated users delete patients"
on public.patients for delete to authenticated using (true);

create policy "authenticated users read sessions"
on public.session_records for select to authenticated using (true);

create policy "authenticated users insert sessions"
on public.session_records for insert to authenticated with check (true);

create policy "authenticated users update sessions"
on public.session_records for update to authenticated using (true) with check (true);

create policy "authenticated users delete sessions"
on public.session_records for delete to authenticated using (true);
