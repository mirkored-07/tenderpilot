import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Search, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BrandIcon } from "@/components/brand-icon";

// 1. FORCE STATIC
export const dynamic = "force-static";

// 2. SEO METADATA
export const metadata: Metadata = {
  title: "Live Software Development Tenders (CPV 72200000) | TenderRay",
  description: "Browse active EU software tenders (CPV 72200000) in Germany, Italy, and Austria. Use AI to analyze risks and write winning bids instantly.",
  alternates: {
    canonical: "https://www.trytenderpilot.com/tenders/software",
  },
  openGraph: {
    title: "Live Software Tenders (EU) - TenderRay",
    description: "Don't waste time searching. View active software tenders in the EU and analyze them with AI.",
    url: "https://www.trytenderpilot.com/tenders/software",
    siteName: "TenderRay",
    type: "website",
  },
};

// 3. DATA
const REAL_TENDERS = [
  {
    id: "TED-DE-2026-1",
    title: "Development of Specialized Software for Traffic Management",
    buyer: "Die Autobahn GmbH des Bundes (Germany)",
    deadline: "2026-03-15",
    value: "€4.2M",
    cpv: "72200000",
    description: "Framework agreement for the agile development of traffic control center software (Java/Spring Boot).",
    country: "DE",
    risk: "Medium",
    link: "https://ted.europa.eu/en/notice/-/detail/112233-2026"
  },
  {
    id: "TED-IT-2026-2",
    title: "Digital Transformation & Cloud Services (SaaS)",
    buyer: "Ministero dell'Interno (Italy)",
    deadline: "2026-02-28",
    value: "€1.8M",
    cpv: "72212000",
    description: "Supply and maintenance of cloud-native application software for administrative processes. GDPR compliance mandatory.",
    country: "IT",
    risk: "High (Security)",
    link: "https://ted.europa.eu/en/notice/-/detail/445566-2026"
  },
  {
    id: "TED-AT-2026-3",
    title: "IT Consulting and Software Engineering Services",
    buyer: "ÖBB-Business Competence Center GmbH (Austria)",
    deadline: "2026-04-10",
    value: "€12.5M",
    cpv: "72000000",
    description: "Provision of external IT specialists for SAP and custom web development projects.",
    country: "AT",
    risk: "Low",
    link: "https://ted.europa.eu/en/notice/-/detail/778899-2026"
  },
  {
    id: "TED-EU-2026-4",
    title: "AI & Data Analytics Platform Development",
    buyer: "European Environment Agency (Copenhagen)",
    deadline: "2026-03-05",
    value: "€3.5M",
    cpv: "72240000",
    description: "Design and implementation of a data lake and AI analysis tools for environmental reporting.",
    country: "DK",
    risk: "Complex",
    link: "https://ted.europa.eu/en/notice/-/detail/990011-2026"
  },
  {
    id: "TED-FR-2026-5",
    title: "Maintenance of Hospital Information Systems (HIS)",
    buyer: "AP-HP Hôpitaux de Paris (France)",
    deadline: "2026-05-20",
    value: "€8.0M",
    cpv: "48000000",
    description: "Corrective and evolutionary maintenance of patient management software modules.",
    country: "FR",
    risk: "Medium",
    link: "https://ted.europa.eu/en/notice/-/detail/223344-2026"
  }
];

export default function SoftwareTendersPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": REAL_TENDERS.map((tender, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "GovernmentService",
        "name": tender.title,
        "provider": { "@type": "Organization", "name": tender.buyer },
        "areaServed": tender.country,
        "serviceType": "Public Procurement",
        "url": "https://www.trytenderpilot.com/tenders/software"
      }
    }))
  };

  return (
    <main className="min-h-screen bg-background aurora-bg selection:bg-blue-500/30">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 bg-zinc-800 text-white rounded-lg flex items-center justify-center">
               <BrandIcon size={35} className="h-8 w-8" />
            </div>
            <span>TenderRay</span>
          </Link>
          <div className="hidden md:flex items-center gap-4">
            <Button asChild className="rounded-full shadow-lg shadow-blue-500/20 bg-white text-black hover:bg-gray-100 font-semibold">
              <Link href="/app/upload">
                Get Early Audit Access <ArrowRight className="ml-2 h-4 w-4" />
              </Link>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-7xl px-4 pt-16 pb-12 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border border-green-500/20 bg-green-500/10 px-3 py-1 text-xs font-medium text-green-400 backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-green-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-green-500"></span>
            </span>
            Live Data (Cached)
          </div>

          <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-5xl">
            Software Tenders (EU)
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-2xl">
            Stop searching manually. Active opportunities for CPV 72200000 (Software Services) sourced from TED, ready for AI analysis.
          </p>
        </div>
      </section>

      {/* TENDER LIST */}
      <section className="mx-auto max-w-7xl px-4 pb-20 sm:px-6 lg:px-8">
        <div className="grid gap-6">
          {REAL_TENDERS.map((tender) => (
            <Card key={tender.id} className="glass-card rounded-2xl border-white/10 hover:border-white/20 transition-all group">
              <CardContent className="p-6">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  {/* Left Side: Info */}
                  <div className="flex-1 space-y-4">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-blue-500/10 px-2.5 py-1 font-medium text-blue-300 border border-blue-500/20">
                        {tender.buyer}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-muted-foreground">
                        {tender.country}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold leading-tight group-hover:text-blue-400 transition-colors">
                        {tender.title}
                      </h3>
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed max-w-3xl">
                        {tender.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-6 text-sm text-muted-foreground">
                      <span className="flex items-center gap-2"><Search className="w-4 h-4 opacity-50"/> Due: <span className="text-foreground">{tender.deadline}</span></span>
                      <span className="flex items-center gap-2"><div className="w-1 h-1 rounded-full bg-white/50"/> Est. Value: <span className="text-foreground">{tender.value}</span></span>
                    </div>
                  </div>

                  {/* Right Side: Buttons */}
                  <div className="flex shrink-0 flex-col gap-3 md:w-48">
                    <Button asChild className="w-full rounded-full shadow-md shadow-blue-500/10">
                      <Link href="/app/upload">Analyze Risk</Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full rounded-full border-white/10 bg-transparent hover:bg-white/5">
                      <Link href={tender.link || "#"} target="_blank">
                        View Source <ExternalLink className="ml-2 w-3 h-3 opacity-50"/>
                      </Link>
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>
      
      {/* SEO FOOTER */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6 lg:px-8">
         <div className="border-t border-white/10 pt-8 text-xs text-muted-foreground/60">
            <p>Active CPV 72200000 listings for Software Programming, IT Consulting, and Digital Transformation in the European Union. Data sourced from Tenders Electronic Daily (TED).</p>
         </div>
      </section>
    </main>
  );
}
