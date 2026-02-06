# TenderRay V1

TenderRay is an AI-assisted tender review tool designed to help teams quickly assess bid eligibility, risks, and drafting readiness.

## Current status
This repository represents a stable MVP with a fully working job-processing pipeline.

Key features:
- PDF and DOCX support
- Automated extraction of tender requirements (MUST / SHOULD / INFO)
- Disqualification detection
- Risk and clarification placeholders
- Draft outline generation
- Async job processing via Supabase Edge Functions

## Architecture overview
- Frontend: Next.js App Router
- Backend: Supabase (Postgres, Edge Functions, pg_net)
- Processing: Async job pipeline (process-job)
- Storage: Supabase Storage
- Auth: Supabase Auth

## Mock / Demo mode
For development, testing, and demos, the system supports a deterministic mock mode.

Required Supabase Edge Function secrets:

TP_MOCK_EXTRACT=1  
TP_MOCK_AI=1  

When enabled:
- No real extractor is used
- No external AI calls are made
- Deterministic fixture data is injected
- Full UX and job lifecycle are preserved

This mode is intentionally executed **before** runtime capability checks to ensure Edge compatibility.

## Notes
- Always verify results against the original tender document
- Draft output is a starting point and must be tailored before submission

## License
Private MVP – not licensed for redistribution.
