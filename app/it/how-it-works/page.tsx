import type { Metadata } from "next";
import { HowItWorksContent } from "@/components/marketing/HowItWorksContent";

export const metadata: Metadata = {
  title: "How it works | TenderPilot",
  description:
    "Upload a tender, get a Go/Hold/No-Go decision cockpit with evidence, execute MUST items in a compliance matrix, and export bid-ready outputs.",
};

export default async function HowItWorksPage() {
  const dict = (await import("@/dictionaries/it.json")).default as any;
  return <HowItWorksContent localePrefix="/it" dict={dict.howItWorksPage} />;
}
