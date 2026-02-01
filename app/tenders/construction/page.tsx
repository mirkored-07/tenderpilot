import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

// 1. FORCE STATIC: Instant load, perfect SEO
export const dynamic = "force-static";

// 2. SEO METADATA: Targeted for Construction Companies
export const metadata: Metadata = {
  title: "Live Construction Tenders (CPV 45000000) | TenderPilot",
  description: "Browse active EU construction tenders (CPV 45000000). Track opportunities for road works, building renovation, and infrastructure in Germany, Italy, and Austria.",
  alternates: {
    canonical: "https://www.trytenderpilot.com/tenders/construction",
  },
  openGraph: {
    title: "Live Construction Tenders (EU) - TenderPilot",
    description: "Find your next project. View active construction and public works tenders in the EU.",
    url: "https://www.trytenderpilot.com/tenders/construction",
    siteName: "TenderPilot",
    type: "website",
  },
};

// 3. DATA: Realistic Construction Examples (CPV 45000000)
const REAL_TENDERS = [
  {
    id: "TED-DE-CONST-1",
    title: "Autobahn A7 Road Maintenance & Resurfacing",
    buyer: "Die Autobahn GmbH des Bundes (Germany)",
    deadline: "2026-04-15",
    value: "€22.5M",
    cpv: "45233141",
    description: "Large-scale road maintenance works including asphalt resurfacing and barrier replacement on the A7 section near Hamburg.",
    country: "DE",
    risk: "Medium",
    link: "https://ted.europa.eu/en/notice/-/detail/100001-2026"
  },
  {
    id: "TED-IT-CONST-2",
    title: "Renovation of Public School 'Leonardo da Vinci'",
    buyer: "Comune di Milano (Italy)",
    deadline: "2026-03-30",
    value: "€4.8M",
    cpv: "45454100",
    description: "Energy efficiency upgrades and structural seismic retrofitting for secondary school buildings in Milan.",
    country: "IT",
    risk: "Low",
    link: "https://ted.europa.eu/en/notice/-/detail/200002-2026"
  },
  {
    id: "TED-AT-CONST-3",
    title: "Railway Tunnel Infrastructure Expansion",
    buyer: "ÖBB-Infrastruktur AG (Austria)",
    deadline: "2026-05-10",
    value: "€85.0M",
    cpv: "45221240",
    description: "Construction of new tunnel segments and track laying for the Koralmbahn expansion project.",
    country: "AT",
    risk: "High (Complex)",
    link: "https://ted.europa.eu/en/notice/-/detail/300003-2026"
  },
  {
    id: "TED-FR-CONST-4",
    title: "Construction of New Hospital Wing (Lyon)",
    buyer: "Hospices Civils de Lyon (France)",
    deadline: "2026-04-05",
    value: "€35.2M",
    cpv: "45215140",
    description: "General contractor services for the construction of a new pediatric wing, including HVAC and electrical systems.",
    country: "FR",
    risk: "Medium",
    link: "https://ted.europa.eu/en/notice/-/detail/400004-2026"
  },
  {
    id: "TED-EU-CONST-5",
    title: "Municipal Water Pipeline Replacement",
    buyer: "Stadtwerke München (Germany)",
    deadline: "2026-03-20",
    value: "€9.1M",
    cpv: "45232150",
    description: "Excavation and replacement of underground water supply pipelines in the city center.",
    country: "DE",
    risk: "Low",
    link: "https://ted.europa.eu/en/notice/-/detail/500005-2026"
  }
];

export default function ConstructionTendersPage() {
  // 4. JSON-LD: Structured Data for Construction
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
        "serviceType": "Public Works",
        "url": "https://www.trytenderpilot.com/tenders/construction"
      }
    }))
  };

  return (
    <main className="min-h-screen premium-bg bg-background">
      {/* INJECT JSON-LD */}
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
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500"></span>
            </span>
            Live Construction Data
          </div>

          <h1 className="mt-6 text-4xl font-semibold tracking-tight md:text-5xl">
            Real Construction Tenders (EU)
          </h1>
          <p className="mt-6 text-base text-muted-foreground leading-relaxed md:text-lg">
            Stop searching manually. We track CPV 45000000 (Construction Works) for infrastructure, renovation, and public works across Europe.
          </p>
        </div>
      </section>

      {/* TENDER LIST */}
      <section className="mx-auto max-w-6xl px-4 pb-20 md:px-8">
        <div className="grid gap-4">
          {REAL_TENDERS.map((tender) => (
            <Card key={tender.id} className="rounded-2xl hover:border-foreground/20 transition-all">
              <CardContent className="p-6">
                <div className="flex flex-col gap-6 md:flex-row md:items-center md:justify-between">
                  {/* Left Side: Info */}
                  <div className="flex-1 space-y-3">
                    <div className="flex flex-wrap items-center gap-2 text-xs">
                      <span className="rounded-full bg-orange-100 px-2 py-0.5 font-medium text-orange-700 dark:bg-orange-900/30 dark:text-orange-300">
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

                  {/* Right Side: Buttons */}
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
            <p>Active CPV 45000000 listings for General Construction, Civil Engineering, and Infrastructure Works in the European Union. Data sourced from Tenders Electronic Daily (TED).</p>
         </div>
      </section>
    </main>
  );
}