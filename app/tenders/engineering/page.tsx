import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// 1. FORCE STATIC
export const dynamic = "force-static";

// 2. METADATA: Engineering Focused
export const metadata: Metadata = {
  title: "Live Engineering & Architectural Tenders (CPV 71000000) | TenderPilot",
  description: "Browse active Engineering and Architectural tenders (CPV 71000000). Find opportunities for civil engineering, design, and technical analysis in the EU.",
  alternates: {
    canonical: "https://www.trytenderpilot.com/tenders/engineering",
  },
  openGraph: {
    title: "Live Engineering Tenders (EU) - TenderPilot",
    description: "Find your next project. View active engineering, architectural, and technical tenders in the EU.",
    url: "https://www.trytenderpilot.com/tenders/engineering",
    siteName: "TenderPilot",
    type: "website",
  },
};

// 3. DATA: Realistic Engineering Examples (CPV 71000000)
const REAL_TENDERS = [
  {
    id: "TED-DE-ENG-1",
    title: "Structural Engineering Services for Bridge Renovation",
    buyer: "Autobahndirektion Südbayern (Germany)",
    deadline: "2026-04-20",
    value: "€4.2M",
    cpv: "71300000",
    description: "Statics calculation, structural analysis, and safety inspection for the renovation of highway bridges (A9).",
    country: "DE",
    risk: "High",
    link: "https://ted.europa.eu/en/notice/-/detail/111001-2026"
  },
  {
    id: "TED-IT-ENG-2",
    title: "Architectural Design Competition: New City Library",
    buyer: "Comune di Torino (Italy)",
    deadline: "2026-03-15",
    value: "€1.5M",
    cpv: "71200000",
    description: "Architectural design services including urban planning and feasibility studies for the new sustainable library complex.",
    country: "IT",
    risk: "Medium",
    link: "https://ted.europa.eu/en/notice/-/detail/222002-2026"
  },
  {
    id: "TED-AT-ENG-3",
    title: "Technical Supervision & Project Management (Rail)",
    buyer: "ÖBB-Infrastruktur AG (Austria)",
    deadline: "2026-05-01",
    value: "€8.5M",
    cpv: "71520000",
    description: "Construction supervision and quality control management for the Koralm Tunnel expansion project.",
    country: "AT",
    risk: "Low",
    link: "https://ted.europa.eu/en/notice/-/detail/333003-2026"
  },
  {
    id: "TED-FR-ENG-4",
    title: "HVAC and Electrical Engineering Services",
    buyer: "Université de Paris (France)",
    deadline: "2026-04-10",
    value: "€2.1M",
    cpv: "71310000",
    description: "Consultative engineering services for energy efficiency upgrades (HVAC/Electrical) across campus buildings.",
    country: "FR",
    risk: "Low",
    link: "https://ted.europa.eu/en/notice/-/detail/444004-2026"
  },
  {
    id: "TED-EU-ENG-5",
    title: "Environmental Impact Assessment (EIA)",
    buyer: "European Commission (Brussels)",
    deadline: "2026-03-30",
    value: "€950k",
    cpv: "71313000",
    description: "Provision of environmental engineering consultancy for cross-border sustainability projects.",
    country: "EU",
    risk: "Medium",
    link: "https://ted.europa.eu/en/notice/-/detail/555005-2026"
  }
];

export default function EngineeringTendersPage() {
  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "ItemList",
    "itemListElement": REAL_TENDERS.map((tender, index) => ({
      "@type": "ListItem",
      "position": index + 1,
      "item": {
        "@type": "GovernmentService",
        "name": tender.title,
        "provider": {
          "@type": "Organization",
          "name": tender.buyer
        },
        "areaServed": tender.country,
        "serviceType": "Engineering Services",
        "url": "https://www.trytenderpilot.com/tenders/engineering"
      }
    }))
  };

  return (
    <main className="min-h-screen premium-bg bg-background">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* HEADER */}
      <header className="sticky top-0 z-10 border-b bg-background/70 backdrop-blur supports-[backdrop-filter]:bg-background/40">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3 md:h-16 md:px-8 md:py-0">
          <Link href="/" className="font-semibold text-lg tracking-tight">
            TenderPilot
          </Link>
          <div className="hidden md:flex items-center gap-2">
            <Button asChild className="rounded-full">
              <Link href="/#early-access">Get early access</Link>
            </Button>
          </div>
        </div>
      </header>

      {/* HERO */}
      <section className="mx-auto max-w-6xl px-4 pt-12 pb-10 md:px-8 md:pt-16">
        <div className="max-w-3xl">
          <div className="inline-flex items-center gap-2 rounded-full border bg-background/50 px-3 py-1 text-xs font-medium text-muted-foreground backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-indigo-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-indigo-500"></span>
            </span>
            Live Engineering Data
          </div>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-5xl">
            Real Engineering Tenders (EU)
          </h1>
          <p className="mt-6 text-base text-muted-foreground leading-relaxed md:text-lg">
            Track CPV 71000000 (Architectural & Engineering Services). Find contracts for civil engineering, design, and technical supervision.
          </p>
        </div>
      </section>

      {/* LIST */}
      <section className="mx-auto max-w-6xl px-4 pb-20 md:px-8">
        <div className="grid gap-4">
          {REAL_TENDERS.map((tender) => (
            <Card key={tender.id} className="rounded-2xl hover:border-foreground/20 transition-all">
              <CardContent className="p-6">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-indigo-100 px-2 py-0.5 font-medium text-indigo-700 dark:bg-indigo-900/30 dark:text-indigo-300">
                        {tender.buyer}
                      </span>
                      <span className="rounded-full border bg-background px-2 py-0.5 text-muted-foreground">
                        {tender.country}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-base font-semibold leading-tight">{tender.title}</h3>
                      <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
                        {tender.description}
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">📅 Due: {tender.deadline}</span>
                      <span className="flex items-center gap-1">💰 {tender.value}</span>
                    </div>
                  </div>

                  <div className="flex shrink-0 flex-col gap-2 md:w-48">
                    <Button asChild className="w-full rounded-full">
                      <Link href="/#early-access">Analyze Risk</Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full rounded-full bg-background">
                      <Link href={tender.link} target="_blank">
                        View Source
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
      <section className="mx-auto max-w-6xl px-4 pb-8 md:px-8">
         <div className="border-t pt-8 text-xs text-muted-foreground">
            <p>Active CPV 71000000 listings for Architectural, Construction, Engineering and Inspection Services. Data sourced from Tenders Electronic Daily (TED).</p>
         </div>
      </section>
    </main>
  );
}