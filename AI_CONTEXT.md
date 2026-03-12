# TenderPilot AI Engineering Context

## Current Product Status
TenderPilot is transitioning from MVP to a hardened production application. The core feature set (triage, bid room, extraction) is stable. The current development phase is strictly focused on **consistency hardening**:
- One clean source of truth for deadlines and decisions (`getEffectiveReviewState`).
- One clean dashboard latest-review model.
- Surfacing confidence and provenance to the user.

## Completed Sprints
1. **[March 2026] Dashboard Harmonization:** Fixed `app/app/dashboard/page.tsx` to use the unified `submissionDeadlineDisplayText`, guaranteeing that the dashboard and the jobs list show the exact same deadline string.

## Active Sprint / Next Steps
- **Step 3:** Audit the Bid Room (`app/app/jobs/[id]/page.tsx` and related components) to ensure the execution layer uses the exact same deadline and decision rendering logic as the portfolio layer.

## Known Issues / Audit Findings (March 2026)
1. **Bid Room Save (`job_work_items` check constraint):** The UI added support for `deadline`, `submission`, and `admin` types but the database `job_work_items_type_check` constraint wasn't updated. A fix script was added to `supabase/job_work_items_type_check.sql` to drop and recreate the constraint to allow these types.
2. **TypeScript `any` Types:** The codebase has ~850 `any` type usages flagged by the linter. Future work should incrementally adopt strict type definitions to prevent runtime regressions.

## AI Execution Rules (Strict)
1. **Full File Output:** When writing or refactoring code, the AI must output the *entire, complete file content* (no truncating or saying "rest of the code goes here"). 
2. **File Paths:** The AI must always state the exact folder structure and file name above the code block so the user can easily copy and paste to replace the local file (e.g., `app/app/jobs/[id]/page.tsx`).
3. **Preserve Trust:** Keep backend logic auditable. Do not do giant rewrites of the AI/extraction functions unless explicitly requested.