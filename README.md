# OTTrack — Offline + Online

OTTrack is an offline-first Occupational Therapy patient/session tracker.

## Stack
- React + Vite
- IndexedDB (`idb`) for offline persistence
- Supabase/PostgreSQL for shared cloud data
- PWA manifest
- XLSX export

## Setup
1. Create a Supabase project.
2. Run `supabase/schema.sql` in Supabase SQL Editor.
3. Enable Email/Password authentication.
4. Copy `.env.example` to `.env`.
5. Add your Supabase project URL and publishable key.
6. Run `npm install`.
7. Run `npm run dev`.

## Important
Do not put a Supabase service-role/secret key in the frontend or GitHub.
Patient data belongs in Supabase, not in GitHub.

The included schema gives authenticated users shared access. Before using real patient data in a clinical environment, tighten RLS according to your institution's authorization requirements.
