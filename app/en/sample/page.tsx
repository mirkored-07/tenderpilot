import type { Metadata } from "next";
import { SampleOutputContent } from "@/components/marketing/SampleOutputContent";

export const metadata: Metadata = {
  title: "Sample output | TenderPilot",
  description:
    "See an example Go/Hold/No-Go decision cockpit with MUST items, risks, clarifications, compliance matrix, bid room tasks, and exports.",
};

export default async function SamplePage() {
  const dict = (await import("@/dictionaries/en.json")).default as any;
  return <SampleOutputContent localePrefix="/en" dict={dict.samplePage} />;
}
