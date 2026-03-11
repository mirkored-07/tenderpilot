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

## AI Execution Rules (Strict)
1. **Full File Output:** When writing or refactoring code, the AI must output the *entire, complete file content* (no truncating or saying "rest of the code goes here"). 
2. **File Paths:** The AI must always state the exact folder structure and file name above the code block so the user can easily copy and paste to replace the local file (e.g., `app/app/jobs/[id]/page.tsx`).
3. **Preserve Trust:** Keep backend logic auditable. Do not do giant rewrites of the AI/extraction functions unless explicitly requested.