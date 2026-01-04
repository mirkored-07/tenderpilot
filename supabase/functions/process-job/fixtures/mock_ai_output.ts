export const MOCK_AI_OUTPUT = {
  checklist: [
    {
      type: "MUST",
      text: "Submit by 2026-02-01 12:00 CET.",
      source: "SECTION 1 — Submission",
    },
    {
      type: "MUST",
      text: "Include a signed cover letter.",
      source: "SECTION 1 — Submission",
    },
    {
      type: "MUST",
      text: "Provide delivery to Graz, Austria.",
      source: "SECTION 2 — Scope",
    },
    {
      type: "MUST",
      text: "Include 12 months warranty minimum.",
      source: "SECTION 2 — Scope",
    },
    {
      type: "MUST",
      text: "Quote in EUR, fixed price.",
      source: "SECTION 3 — Commercial",
    },
    {
      type: "MUST",
      text: "GDPR compliance for any personal data.",
      source: "SECTION 4 — Compliance & Security",
    },
    {
      type: "SHOULD",
      text: "Provide a single PDF in addition to editable source.",
      source: "SECTION 1 — Submission",
    },
    {
      type: "SHOULD",
      text: "Provide implementation plan and timeline.",
      source: "SECTION 2 — Scope",
    },
    {
      type: "SHOULD",
      text: "Provide ISO 27001 certification evidence (if available).",
      source: "SECTION 4 — Compliance & Security",
    },
    {
      type: "INFO",
      text: "Payment terms preferred Net 30.",
      source: "SECTION 3 — Commercial",
    },
  ],
  risks: [
    {
      severity: "High",
      text: "Strict submission deadline and format increases disqualification risk.",
      mitigation: "Create a submission checklist and submit at least 24 hours early.",
    },
    {
      severity: "Medium",
      text: "Warranty requirement may be overlooked in the response.",
      mitigation: "Include a dedicated warranty section and confirm 12 months minimum.",
    },
    {
      severity: "Low",
      text: "ISO 27001 evidence is requested but optional.",
      mitigation: "Attach certification if available; otherwise provide security controls summary.",
    },
  ],
  proposal_draft: {
    sections: [
      {
        title: "Executive summary",
        bullets: [
          "We will deliver the requested scope to Graz with a fixed EUR price.",
          "We confirm GDPR compliance and include a clear 12-month warranty.",
        ],
      },
      {
        title: "Compliance & submission",
        bullets: [
          "Signed cover letter included.",
          "Submission prepared ahead of the 2026-02-01 12:00 CET deadline.",
        ],
      },
      {
        title: "Delivery & warranty",
        bullets: [
          "Delivery to Graz confirmed.",
          "Warranty: 12 months minimum (or better if offered).",
        ],
      },
      {
        title: "Implementation plan",
        bullets: [
          "A phased plan with timeline, milestones, and responsibilities is included.",
        ],
      },
      {
        title: "Commercial terms",
        bullets: [
          "Fixed price in EUR.",
          "Payment terms: Net 30 preferred (can be discussed).",
        ],
      },
    ],
  },
};
