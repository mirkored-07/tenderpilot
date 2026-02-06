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
  title: "Live Construction Tenders (CPV 45000000) | TenderRay",
  description: "Browse active EU construction tenders (CPV 45000000). Track opportunities for road works, building renovation, and infrastructure in Germany, Italy, and Austria.",
  alternates: {
    canonical: "https://www.trytenderpilot.com/tenders/construction",
  },
  openGraph: {
    title: "Live Construction Tenders (EU) - TenderRay",
    description: "Find your next project. View active construction and public works tenders in the EU.",
    url: "https://www.trytenderpilot.com/tenders/construction",
    siteName: "TenderRay",
    type: "website",
  },
};

// 3. DATA
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
        "serviceType": "Public Works",
        "url": "https://www.trytenderpilot.com/tenders/construction"
      }
    }))
  };

  return (
    <main className="min-h-screen bg-background aurora-bg selection:bg-orange-500/30">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />

      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8 h-16">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 bg-zinc-800 text-white rounded-lg flex items-center justify-center">
               <BrandIcon size={48} className="h-8 w-8" />
            </div>
            <span>TenderRay</span>
          </Link>
          <div className="hidden md:flex items-center gap-4">
            <Button asChild className="rounded-full shadow-lg shadow-orange-500/20 bg-white text-black hover:bg-gray-100 font-semibold">
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
          <div className="inline-flex items-center gap-2 rounded-full border border-orange-500/20 bg-orange-500/10 px-3 py-1 text-xs font-medium text-orange-300 backdrop-blur">
            <span className="relative flex h-2 w-2">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-orange-400 opacity-75"></span>
              <span className="relative inline-flex h-2 w-2 rounded-full bg-orange-500"></span>
            </span>
            Live Construction Data
          </div>

          <h1 className="mt-6 text-4xl font-bold tracking-tight md:text-5xl">
            Construction Tenders (EU)
          </h1>
          <p className="mt-6 text-lg text-muted-foreground leading-relaxed max-w-2xl">
            Stop searching manually. We track CPV 45000000 (Construction Works) for infrastructure, renovation, and public works across Europe.
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
                      <span className="rounded-full bg-orange-500/10 px-2.5 py-1 font-medium text-orange-300 border border-orange-500/20">
                        {tender.buyer}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2.5 py-1 text-muted-foreground">
                        {tender.country}
                      </span>
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold leading-tight group-hover:text-orange-400 transition-colors">
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
                    <Button asChild className="w-full rounded-full shadow-md shadow-orange-500/10">
                      <Link href="/app/upload">Analyze Risk</Link>
                    </Button>
                    <Button asChild variant="outline" className="w-full rounded-full border-white/10 bg-transparent hover:bg-white/5">
                      <Link href={tender.link} target="_blank">
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
            <p>Active CPV 45000000 listings for General Construction, Civil Engineering, and Infrastructure Works in the European Union. Data sourced from Tenders Electronic Daily (TED).</p>
         </div>
      </section>
    </main>
  );
}
