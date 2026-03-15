import { LandingPageContent } from "@/components/marketing/LandingPageContent";

export default async function LandingPage() {
  const dict = (await import("@/dictionaries/en.json")).default as any;

  return <LandingPageContent localePrefix="" nav={dict.nav} dict={dict.landing} />;
}
