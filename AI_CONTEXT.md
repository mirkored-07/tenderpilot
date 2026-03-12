# TenderPilot AI Engineering Context

## Current Product Status
TenderPilot is transitioning from MVP to a hardened production application. The core feature set (triage, bid room, extraction) is stable. The current development phase is shifting from **consistency hardening** into **organizational memory** (AI Knowledge Base).
- One clean source of truth for deadlines and decisions (`getEffectiveReviewState`).
- One clean dashboard latest-review model.
- Vector-driven answer library for future automation.

## Completed Sprints
1. **[March 2026] Dashboard Harmonization:** Fixed `app/app/dashboard/page.tsx` to use the unified `submissionDeadlineDisplayText`, guaranteeing that the dashboard and the jobs list show the exact same deadline string.
2. **[March 2026] Bid Room Refactor:** Upgraded `BidRoomPanel.tsx` into a lightning-fast spreadsheet-style data grid with inline status toggling and optimistic UI updates.
3. **[March 2026] Knowledge Base Foundation (Sprints 3 & 4):** - Created the `answer_library` Supabase table utilizing the `pgvector` extension.
   - Enforced strict Row Level Security (RLS) so users only access their own team's data.
   - Built `app/actions/knowledge-base.ts` to seamlessly generate `text-embedding-3-small` vectors via OpenAI and insert them into Supabase.
   - Added "Save for future bids" functionality directly inside `BidRoomPanel.tsx` for clarification notes.

## Active Sprint / Next Steps
- **Phase 1 (The Auto-Draft Engine):** Now that the vector database is actively storing past answers, the next step is to update the extraction/processing pipeline. When a new tender is uploaded, the backend should query the `answer_library` using vector similarity search to auto-fill drafted responses for new requirements.

## Known Issues / Audit Findings (March 2026)
1. **Bid Room Save (`job_work_items` check constraint):** The UI added support for `deadline`, `submission`, and `admin` types but the database `job_work_items_type_check` constraint wasn't updated. A fix script was added to `supabase/job_work_items_type_check.sql` to drop and recreate the constraint to allow these types.
2. **TypeScript `any` Types:** The codebase has ~850 `any` type usages flagged by the linter. Future work should incrementally adopt strict type definitions to prevent runtime regressions.
3. **Ghost Components:** `BuyerQuestions.tsx` and older isolated tab components are currently orphans not rendered in the app due to the `BidRoomPanel` unification.

## AI Execution Rules (Strict)
1. **Full File Output:** When writing or refactoring code, the AI must output the *entire, complete file content* (no truncating or saying "rest of the code goes here"). 
2. **File Paths:** The AI must always state the exact folder structure and file name above the code block so the user can easily copy and paste to replace the local file (e.g., `app/app/jobs/[id]/page.tsx`).
3. **Preserve Trust:** Keep backend logic auditable. Do not do giant rewrites of the AI/extraction functions unless explicitly requested.