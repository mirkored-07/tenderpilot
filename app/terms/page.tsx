import Link from "next/link";
import { ArrowLeft, AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandIcon } from "@/components/brand-icon";

export const metadata = {
  title: "Terms of Service | TenderRay",
  description: "Terms and conditions for using the TenderRay B2B SaaS platform.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-background aurora-bg selection:bg-blue-500/30">
      
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo -> Home */}
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 rounded-lg flex items-center justify-center bg-transparent">

              <BrandIcon size={35} className="h-8 w-8" />
            </div>
            <span>TenderRay</span>
          </Link>

          <div className="flex items-center gap-4">
            {/* Back Button -> Home (Explicitly checked) */}
            <Button asChild variant="ghost" className="hidden sm:flex" size="sm">
                <Link href="/"><ArrowLeft className="mr-2 h-4 w-4"/> Back to Home</Link>
            </Button>

            <Button asChild className="rounded-full shadow-lg shadow-blue-500/20 bg-white text-black hover:bg-gray-100 font-semibold">
              <Link href="/app/upload">
                Get Audit Engine Access
              </Link>
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 py-20">
        
        <div className="mb-12 text-center">
            <h1 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">Terms of Service</h1>
            <p className="text-xl text-muted-foreground">
                Fair, transparent rules for professional use.
            </p>
        </div>

        {/* LEGAL CONTENT */}
        <div className="glass-card p-8 md:p-12 rounded-2xl border border-white/10 space-y-8 text-sm leading-relaxed text-muted-foreground">
            
            <section>
                <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                    <span className="text-blue-500">1.</span> Acceptance of Terms
                </h2>
                <p>
                    By accessing or using TenderRay ("the Service"), you agree to be bound by these Terms. If you are using the Service on behalf of a company or organization, you represent that you have the authority to bind that entity to these Terms.
                </p>
            </section>

            <section>
                <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                    <span className="text-blue-500">2.</span> Service Description & Disclaimer
                </h2>
                <p className="mb-4">
                    TenderRay is an AI-powered decision support tool for tender analysis. 
                </p>
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg text-amber-200 flex gap-3 items-start">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                        <strong>Important Disclaimer:</strong> The Service provides analysis based on Large Language Models, which may occasionally produce incorrect or incomplete information ("hallucinations"). You acknowledge that TenderRay is a support tool, not a substitute for professional legal or bid management advice. You are responsible for verifying all outputs against the original documents.
                    </div>
                </div>
            </section>

            <section>
                <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                    <span className="text-blue-500">3.</span> Usage & Restrictions
                </h2>
                <ul className="list-disc pl-5 space-y-2">
                    <li>You must not use the Service to upload classified government documents (e.g., Top Secret) or data violating third-party IP rights.</li>
                    <li>You must not reverse engineer, scrape, or attempt to replicate the underlying API or models.</li>
                    <li>Account sharing outside of your organization's licensed seats is prohibited.</li>
                </ul>
            </section>

            <section>
                <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                    <span className="text-blue-500">4.</span> Intellectual Property
                </h2>
                <p>
                    <strong>Your Data:</strong> You retain all rights to the documents you upload.
                </p>
                <p className="mt-2">
                    <strong>Our IP:</strong> TenderRay retains all rights to the interface, code, and proprietary prompting methodologies used to generate the analysis.
                </p>
            </section>

            <section>
                <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                    <span className="text-blue-500">5.</span> Limitation of Liability
                </h2>
                <p>
                    To the maximum extent permitted by law, TenderRay shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits or revenue, arising from your use of the Service or reliance on its outputs.
                </p>
            </section>

             <section>
                <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                    <span className="text-blue-500">6.</span> Early Access / Beta
                </h2>
                <p>
                    During the "Early Access" phase, the Service is provided "AS IS". Features may change, and temporary downtime may occur. We appreciate your feedback to improve the system.
                </p>
            </section>

            <section className="pt-8 border-t border-white/10">
                <p className="text-xs">
                    Last Updated: February 2026. <br/>
                    Contact: <a href="mailto:support@tenderpilot.com" className="text-foreground underline">support@tenderpilot.com</a>
                </p>
            </section>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-12 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} TenderRay
          </div>
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <Link href="/how-it-works" className="text-muted-foreground hover:text-foreground">
              How it works
            </Link>
            <Link href="/sample" className="text-muted-foreground hover:text-foreground">
              Sample output
            </Link>
            <Link  href="/tenders/software" className="text-sm text-muted-foreground hover:text-foreground">
              Browse Software Tenders
            </Link>
            <Link href="/app/upload" className="text-muted-foreground hover:text-foreground">
              Get audit access
            </Link>
            <Link href="/privacy" className="text-muted-foreground hover:text-foreground">
              Privacy
            </Link>
            <Link href="/terms" className="text-foreground font-medium cursor-default">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
