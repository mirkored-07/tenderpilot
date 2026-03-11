# TenderPilot benchmark scaffold

This folder provides a lightweight evaluation scaffold for Phase 6 hardening.

## Purpose

Use the same small gold set to compare:

- previous GPT baseline
- current production GPT baseline
- benchmark-only Gemini runs
- future rule-pack or prompt changes

The goal is not full automation yet. The goal is repeatable review with less guesswork.

## Gold set structure

Create a small set of representative tenders that cover at least:

1. expired tender with clear deadline evidence
2. open tender with portal submission route
3. open tender with explicit exclusion wording
4. tender with missing annexes or weak evidence
5. multi-lot tender with contract term and validity period

Store the case definitions in `tenderpilot-gold-set.template.json` and duplicate it for real internal cases.

## Dimensions to score

For each run, review these dimensions:

- deadline correctness
- tender status correctness
- final decision correctness
- main blocker correctness
- evidence support quality
- bidder-unknown separation
- structural completeness
- confidence signal quality

## Suggested scoring scale

Use a simple 0 to 2 scale.

- 0 = wrong or missing
- 1 = partially correct / weakly supported
- 2 = correct and well supported

## Minimum review workflow

1. Run the same tender through the candidate version.
2. Export or capture:
   - executive summary
   - decision badge and decision source
   - hard stop reasons
   - structured pre-extracted facts
   - key blockers / MUST items / risks
   - confidence fields
3. Compare against the expected gold-set record.
4. Record reviewer notes.
5. Only promote a change when the new version is at least neutral on all critical cases and clearly better on the targeted dimension.

## Critical fail conditions

Treat these as blockers for promotion:

- expired tender not forced to No-Go
- Go returned while critical MUST evidence is unresolved
- strong blocker without evidence support
- structured deadline missing while narrative claims a deadline exists
- bidder-side unknowns presented as confirmed tender facts

## Optional SQL review helpers

You can review recent runs with queries such as:

```sql
select
  id,
  created_at,
  result->'executive_summary'->>'finalDecisionBadge' as final_decision,
  result->'executive_summary'->>'decisionSource' as decision_source,
  result->'executive_summary'->>'submissionDeadlineIso' as deadline_iso,
  result->'executive_summary'->>'tenderStatus' as tender_status,
  pipeline->'ai'->'pre_extracted_facts' as pre_extracted_facts
from job_results
order by created_at desc
limit 20;
```

```sql
select
  id,
  file_name,
  status,
  pipeline->'ai'->'pre_extracted_facts' as pre_extracted_facts
from jobs
order by created_at desc
limit 20;
```

## Notes

Keep Gemini benchmark-only unless explicitly promoted.
Keep OpenAI as the stable production baseline.
