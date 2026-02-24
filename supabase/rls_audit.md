# RLS and Storage Isolation Verification Pack

This pack is the publish gate for TenderPilot.

## Goal

Prove that one user cannot access another user's jobs, results, events, work items, metadata, or uploaded files.

## Guardrails

No schema changes.
Only RLS policy verification and corrections.
Storage policy work is allowed.


## What you verify

### Data isolation

Tables that must be isolated by the authenticated user

1. public.jobs
2. public.job_results
3. public.job_events if present
4. bid room or work item tables if present
5. any job metadata tables used by the cockpit if present

Expected behavior

User A can only select and update their own rows.
User A cannot read User B rows even if they know the UUID.


### Storage isolation

Bucket

uploads

Expected behavior

User A cannot list, read, or create signed URLs for objects owned by User B.
Uploads should be tied to the uploader by storage ownership or a path prefix that includes the user id.


## Manual verification checklist

Preparation

1. Create two test users
   User A
   User B
2. Sign in as User A and upload a PDF
3. Sign in as User B and upload a different PDF
4. Ensure you have one completed job for each user

App checks

1. As User A, open User A job detail page
   Expected: Works
2. As User A, try to open User B job detail URL directly
   Expected: Not found or access denied
3. As User A, try exports for User B job id
   Expected: 401 or 403 or not found
4. As User A, open Locate in source on evidence
   Expected: Signed URL is generated only for User A objects

Browser console checks

While signed in, run a simple select via the browser client

1. Try to fetch User B job_results by job id
   Expected: Empty result or error
2. Try to create a signed URL for a User B upload path
   Expected: Error


## Service role containment checklist

The client must never use a service role key.

Search the repo

1. Search for service role usage
   grep -RIn "SUPABASE_SERVICE_ROLE_KEY" app components lib supabase
2. Confirm it is only used in server only code
   Next route handlers
   Server actions
   Supabase Edge Functions
3. Confirm there is no NEXT_PUBLIC service role key
   grep -RIn "NEXT_PUBLIC_.*SERVICE" .

If you find service role usage in a client component, that is a publish blocker.


## SQL pack

File

supabase/rls_audit.sql

How to run

Run it in Supabase SQL Editor.

Notes

The SQL editor often runs with elevated privileges.
Use the SQL pack as a configuration and policy inventory.
The definitive proof is the manual test using the app with two users.


## Common fixes

If a table is missing RLS

1. Enable RLS
2. Add select, insert, update, delete policies scoped to auth.uid()

If storage allows cross user access

1. Ensure storage.objects policies restrict access by owner
2. Ensure list, read, and signed URL creation cannot be used to access other users
