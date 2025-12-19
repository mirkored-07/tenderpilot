export const MOCK_AI_OUTPUT = {
  checklist: [
    {
      id: "C1",
      type: "MUST",
      text: "Submit proposal before the stated deadline",
      source: "RFP – Submission rules",
    },
    {
      id: "C2",
      type: "MUST",
      text: "Provide at least 3 relevant project references",
      source: "Section 3.1",
    },
    {
      id: "C3",
      type: "SHOULD",
      text: "Include a detailed project timeline",
      source: "Section 4.2",
    },
  ],
  risks: [
    {
      id: "R1",
      severity: "HIGH",
      title: "Fixed-price scope ambiguity",
      detail: "Scope is described at high level and may expand during execution.",
      mitigation: "Clarify assumptions and include change request mechanism.",
    },
    {
      id: "R2",
      severity: "MEDIUM",
      title: "Aggressive delivery timeline",
      detail: "Requested delivery within 8 weeks.",
      mitigation: "Propose phased delivery with milestones.",
    },
  ],
  proposal_draft: {
    sections: [
      {
        title: "Executive Summary",
        bullets: [
          "We propose a compliant and low-risk website redesign.",
          "Our phased approach ensures quality and predictability.",
        ],
      },
      {
        title: "Technical Approach",
        bullets: [
          "Discovery workshop",
          "UX/UI design sprint",
          "Implementation and QA",
          "Deployment and training",
        ],
      },
      {
        title: "Project Plan",
        bullets: [
          "Week 1: Discovery",
          "Weeks 2–3: Design",
          "Weeks 4–7: Development and testing",
          "Week 8: Go-live and handover",
        ],
      },
    ],
  },
};
