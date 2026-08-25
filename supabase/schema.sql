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

-- =====================================================
-- Step 1A additions: patient fields and patient_assessments
-- (Added: session_time, location, stroke_type, is_active, admission_date, discharge_date,
--  and patient_assessments table + indexes + RLS + grants)
-- =====================================================

-- Add new patient columns (idempotent)
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS session_time text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS stroke_type text,
  ADD COLUMN IF NOT EXISTS is_active boolean,
  ADD COLUMN IF NOT EXISTS admission_date date,
  ADD COLUMN IF NOT EXISTS discharge_date date;

-- Ensure a safe default for future inserts on is_active WITHOUT changing existing rows
-- Existing rows remain NULL (no backfill). Future INSERTs will use DEFAULT true.
ALTER TABLE public.patients
  ALTER COLUMN is_active SET DEFAULT true;

-- Add a CHECK constraint to enforce session_time values are 'AM' or 'PM' or NULL
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint c
    JOIN pg_class t ON c.conrelid = t.oid
    JOIN pg_namespace n ON t.relnamespace = n.oid
    WHERE c.conname = 'patients_session_time_check'
      AND n.nspname = 'public'
      AND t.relname = 'patients'
  ) THEN
    ALTER TABLE public.patients
      ADD CONSTRAINT patients_session_time_check
      CHECK (session_time IN ('AM','PM') OR session_time IS NULL);
  END IF;
END$$ LANGUAGE plpgsql;

-- Create patient_assessments table matching React payload (idempotent)
CREATE TABLE IF NOT EXISTS public.patient_assessments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  assessment_type text NOT NULL,
  assessment_date date NOT NULL,
  total_score integer,
  scores jsonb,
  notes text,
  entered_by uuid REFERENCES auth.users(id),
  entered_by_email text,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes to support common queries used by frontend and future filters
CREATE INDEX IF NOT EXISTS idx_patient_assessments_patient_date ON public.patient_assessments (patient_id, assessment_date);
CREATE INDEX IF NOT EXISTS idx_patient_assessments_assessment_date ON public.patient_assessments (assessment_date);

-- Enable row-level security for patient_assessments and create policies mirroring existing patterns
ALTER TABLE public.patient_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Authenticated users can view assessments" ON public.patient_assessments;
CREATE POLICY "Authenticated users can view assessments"
  ON public.patient_assessments FOR SELECT
  TO authenticated
  USING (true);

DROP POLICY IF EXISTS "Authorized staff can add assessments" ON public.patient_assessments;
CREATE POLICY "Authorized staff can add assessments"
  ON public.patient_assessments FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_users
      WHERE user_id = auth.uid() AND active = true
    )
  );

DROP POLICY IF EXISTS "Authorized staff can edit assessments" ON public.patient_assessments;
CREATE POLICY "Authorized staff can edit assessments"
  ON public.patient_assessments FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_users
      WHERE user_id = auth.uid() AND active = true
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.staff_users
      WHERE user_id = auth.uid() AND active = true
    )
  );

DROP POLICY IF EXISTS "Admins can delete assessments" ON public.patient_assessments;
CREATE POLICY "Admins can delete assessments"
  ON public.patient_assessments FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.staff_users
      WHERE user_id = auth.uid() AND role = 'admin' AND active = true
    )
  );

-- Grants for authenticated role (consistent with other tables)
GRANT SELECT ON public.patient_assessments TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.patient_assessments TO authenticated;

