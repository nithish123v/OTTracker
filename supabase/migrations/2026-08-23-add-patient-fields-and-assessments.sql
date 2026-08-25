-- Migration: 2026-08-23 Add patient fields and patient_assessments
-- WARNING: Do NOT execute this file until reviewed and run in staging first.

BEGIN;

-- 1) Add new patient columns (idempotent)
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS session_time text,
  ADD COLUMN IF NOT EXISTS location text,
  ADD COLUMN IF NOT EXISTS stroke_type text,
  ADD COLUMN IF NOT EXISTS is_active boolean,
  ADD COLUMN IF NOT EXISTS admission_date date,
  ADD COLUMN IF NOT EXISTS discharge_date date;

-- 2) Ensure a safe default for future inserts on is_active WITHOUT changing existing rows
-- Existing rows remain NULL (no backfill). Future INSERTs will use DEFAULT true.
ALTER TABLE public.patients
  ALTER COLUMN is_active SET DEFAULT true;

-- 3) Add a CHECK constraint to enforce session_time values are 'AM' or 'PM' or NULL
-- Guarded with DO $$ to avoid using non-supported ADD CONSTRAINT IF NOT EXISTS.
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

-- 4) Create patient_assessments table matching React payload (idempotent)
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

-- 5) Indexes to support common queries used by frontend and future filters
CREATE INDEX IF NOT EXISTS idx_patient_assessments_patient_date ON public.patient_assessments (patient_id, assessment_date);
CREATE INDEX IF NOT EXISTS idx_patient_assessments_assessment_date ON public.patient_assessments (assessment_date);

-- 6) Enable row-level security for patient_assessments and create policies mirroring existing patterns
ALTER TABLE public.patient_assessments ENABLE ROW LEVEL SECURITY;

-- Authenticated selects allowed (mirror existing pattern)
DROP POLICY IF EXISTS "Authenticated users can view assessments" ON public.patient_assessments;
CREATE POLICY "Authenticated users can view assessments"
  ON public.patient_assessments FOR SELECT
  TO authenticated
  USING (true);

-- Only active staff (staff_users.user_id = auth.uid() and active = true) can insert
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

-- Only active staff can update
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

-- Only admins (role = 'admin' and active = true) can delete
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

-- 7) Grants for authenticated role (consistent with other tables)
GRANT SELECT ON public.patient_assessments TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.patient_assessments TO authenticated;

-- 8) Important: Do not modify session_records; unique(patient_id, session_date) remains intact.
--    This script intentionally does not alter public.session_records or its unique constraint.

COMMIT;
