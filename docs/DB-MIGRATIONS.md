Step 1A: Migration plan artifacts

Files created for Step 1A (do NOT execute):
- supabase/migrations/2026-08-23-add-patient-fields-and-assessments.sql

Purpose:
- Make the repository's canonical schema reflect the intended DB structure for the React frontend.
- Do NOT run the SQL in this file until reviewed and tested in staging.

What this Step 1A migration changes (conceptually):
- Adds new columns to public.patients:
  - session_time text NULL (allowed values: 'AM', 'PM')
  - location text NULL
  - stroke_type text NULL
  - is_active boolean NULL with DEFAULT true (no backfill of existing rows)
  - admission_date date NULL
  - discharge_date date NULL

- Adds patients_session_time_check constraint to allow only 'AM'/'PM'/NULL for session_time.
- Creates public.patient_assessments table matching the OTTracker React payload:
  - id, patient_id, assessment_type, assessment_date, total_score, scores (jsonb), notes,
    entered_by (uuid referencing auth.users), entered_by_email, created_at, updated_at.
- Adds indexes on (patient_id, assessment_date) and (assessment_date) to support queries.
- Enables RLS on patient_assessments and creates policies mirroring existing patterns for patients/session_records
  (authenticated SELECT; active staff insert/update; admin delete).

What is NOT changed by this migration:
- public.session_records table is left unchanged. The UNIQUE(patient_id, session_date) constraint remains intact.
- No application code (React, Android, or offline sync) is modified in this step.
- No existing patient or session data is altered by the migration SQL as written (new columns are nullable and is_active is not backfilled).

Operational notes and staging-first procedure:
1. Create a staging environment (preferred) and run the migration SQL there first. Verify results.
2. Backup production database before running migration.
3. Run migration during a maintenance window if desired.
4. Verification queries (examples to run in staging after migration):
   - Check new columns:
     SELECT column_name, is_nullable, column_default
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'patients' AND column_name IN ('session_time','location','stroke_type','is_active','admission_date','discharge_date');

   - Confirm patient_assessments table:
     SELECT column_name, data_type
     FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'patient_assessments';

   - Check RLS enabled:
     SELECT relrowsecurity FROM pg_class WHERE relname = 'patient_assessments';

   - Test insert as staff user (staging only):
     INSERT INTO public.patient_assessments (patient_id, assessment_type, assessment_date, total_score, scores, notes, entered_by, entered_by_email) VALUES ('<patient-uuid>', 'MRS', CURRENT_DATE, 5, '{"a":1}', 'note', '<staff-uuid>', 'staff@example.com');

Rollback warnings:
- Dropping the added patient columns will permanently remove any data written after migration.
- If rollback is required, consider restoring from backup rather than dropping columns to preserve data.

RLS testing:
- Ensure staff accounts have rows in public.staff_users with active = true.
- Verify non-staff or unauthenticated users cannot INSERT/UPDATE patient_assessments.

Reminder and next steps:
- The SQL file exists in supabase/migrations but has NOT been executed.
- After you approve these files, run the migration in staging and perform the verification steps above.
- Offline sync changes are intentionally deferred to a later step.

