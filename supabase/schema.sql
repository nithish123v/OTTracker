-- ============================================
-- OT TRACKER DATABASE
-- ============================================

create extension if not exists pgcrypto;

create table if not exists public.patients (
    id uuid primary key default gen_random_uuid(),
    name text not null,
    ip_no text not null,
    reg_no text,
    diagnosis text not null,
    category text not null,
    consulting_dr text,
    room_no text,
    referral_date date,
    created_at timestamptz default now(),
    updated_at timestamptz default now()
);

create table if not exists public.session_records (
    id uuid primary key default gen_random_uuid(),
    patient_id uuid not null references public.patients(id) on delete cascade,
    session_date date not null,
    seen boolean,
    reason text,
    notes text,
    created_at timestamptz default now(),
    updated_at timestamptz default now(),
    unique(patient_id, session_date)
);

create table if not exists public.staff_users (
    user_id uuid primary key references auth.users(id) on delete cascade,
    role text not null default 'staff' check (role in ('staff', 'admin')),
    active boolean not null default true,
    created_at timestamptz default now()
);

alter table public.patients enable row level security;
alter table public.session_records enable row level security;
alter table public.staff_users enable row level security;

-- Patients: signed-in users can view; active staff can write.
drop policy if exists "Authenticated users can view patients" on public.patients;
create policy "Authenticated users can view patients"
on public.patients for select to authenticated using (true);

drop policy if exists "Authorized staff can add patients" on public.patients;
create policy "Authorized staff can add patients"
on public.patients for insert to authenticated
with check (
    exists (
        select 1 from public.staff_users
        where user_id = auth.uid() and active = true
    )
);

drop policy if exists "Authorized staff can edit patients" on public.patients;
create policy "Authorized staff can edit patients"
on public.patients for update to authenticated
using (
    exists (
        select 1 from public.staff_users
        where user_id = auth.uid() and active = true
    )
)
with check (
    exists (
        select 1 from public.staff_users
        where user_id = auth.uid() and active = true
    )
);

drop policy if exists "Admins can delete patients" on public.patients;
create policy "Admins can delete patients"
on public.patients for delete to authenticated
using (
    exists (
        select 1 from public.staff_users
        where user_id = auth.uid() and role = 'admin' and active = true
    )
);

-- Session records: signed-in users can view; active staff can write.
drop policy if exists "Authenticated users can view sessions" on public.session_records;
create policy "Authenticated users can view sessions"
on public.session_records for select to authenticated using (true);

drop policy if exists "Authorized staff can add sessions" on public.session_records;
create policy "Authorized staff can add sessions"
on public.session_records for insert to authenticated
with check (
    exists (
        select 1 from public.staff_users
        where user_id = auth.uid() and active = true
    )
);

drop policy if exists "Authorized staff can edit sessions" on public.session_records;
create policy "Authorized staff can edit sessions"
on public.session_records for update to authenticated
using (
    exists (
        select 1 from public.staff_users
        where user_id = auth.uid() and active = true
    )
)
with check (
    exists (
        select 1 from public.staff_users
        where user_id = auth.uid() and active = true
    )
);

drop policy if exists "Admins can delete sessions" on public.session_records;
create policy "Admins can delete sessions"
on public.session_records for delete to authenticated
using (
    exists (
        select 1 from public.staff_users
        where user_id = auth.uid() and role = 'admin' and active = true
    )
);

-- Users can only see their own staff authorization row.
drop policy if exists "Users can view own staff record" on public.staff_users;
create policy "Users can view own staff record"
on public.staff_users for select to authenticated
using (user_id = auth.uid());

grant select on public.patients to authenticated;
grant insert, update, delete on public.patients to authenticated;
grant select on public.session_records to authenticated;
grant insert, update, delete on public.session_records to authenticated;
grant select on public.staff_users to authenticated;
