# OTTrack — Shared Supabase OT Patient Tracker

OTTrack is a React + Vite Occupational Therapy patient/session tracker connected to Supabase.

## What this version does

- All signed-in users read the same patient and session data from Supabase.
- All signed-in users can view the shared records.
- Only active users in `staff_users` can add/edit records.
- Only active admins can delete records.
- Email/password login is handled by Supabase Auth.
- Patient and session data are stored in PostgreSQL, not browser-only storage.
- Excel export is still available.

## Setup

1. In Supabase, enable **Email** authentication.
2. Run `supabase/schema.sql` in the Supabase SQL Editor if the tables/policies are not already created.
3. Create staff accounts in Supabase Authentication.
4. Add each authorized user's Auth user ID to `public.staff_users`.
5. Keep `.env` local. It contains the project URL and publishable key. Never put a Supabase secret/service-role key in the frontend.
6. Run:
   - `npm install`
   - `npm run dev`

## Important

The application intentionally does not use `window.storage` or browser-only patient storage as the source of truth. Supabase is the shared source of truth.

The publishable key is designed for frontend use when Row Level Security (RLS) is configured. Never use a `sb_secret_...` or service-role key in this React app.

Before using real patient information in a clinical environment, review authorization, privacy, backups, and institutional requirements.
