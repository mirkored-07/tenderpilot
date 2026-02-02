import Link from "next/link";
import {
  ArrowRight,
  CheckCircle2,
  Command,
  ShieldAlert,
  Zap,
  Clock,
  Euro,
  XCircle,
  Check,
  Search,
  FileText,
  ShieldCheck,
  Sparkles,
  FileSearch,
  ListChecks,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { WaitlistInline } from "@/components/marketing/WaitlistInline";
import { ModeToggle } from "@/components/mode-toggle";

// --- 3D SCANNER HERO (Fixed: Looping Animation) ---
function ScannerHero() {
  return (
    <div className="relative w-full max-w-[340px] mx-auto aspect-[210/297] perspective-[2000px] group select-none mt-8 md:mt-0">
      
      {/* Document Shadow/Glow */}
      <div className="absolute -inset-4 bg-blue-500/20 blur-3xl opacity-20 rounded-full" />

      {/* --- FLOATING RISK BADGE (Loops perfectly with scanner) --- */}
      <div 
        className="absolute top-[45%] -right-12 z-50 flex items-center gap-2 opacity-0 pointer-events-none"
        style={{ animation: 'cycle-risk-badge 4s ease-in-out infinite' }} // Matches the 4s scanner-bar animation
      >
          {/* Connecting Line */}
          <div className="w-8 h-px bg-red-500/50" />
          {/* The Badge */}
          <div className="bg-red-600 text-white text-xs font-bold px-3 py-1.5 rounded-lg shadow-[0_10px_20px_rgba(220,38,38,0.4)] flex items-center gap-2 border border-red-400/50 backdrop-blur-md">
              <ShieldAlert className="w-4 h-4 text-white" /> 
              <span>Liability Risk</span>
          </div>
      </div>

      {/* 3D Paper Container */}
      <div className="absolute inset-0 bg-[#ffffff] dark:bg-[#18181b] rounded-md shadow-2xl overflow-hidden transform rotate-x-2 rotate-y-2 border border-white/10 ring-1 ring-white/5">
        
        {/* Paper Header */}
        <div className="h-16 bg-zinc-100 dark:bg-zinc-900/50 border-b border-zinc-200 dark:border-zinc-800 flex items-center justify-between px-6">
            <div className="flex items-center gap-2">
                 <div className="h-3 w-3 rounded-full bg-red-400/80" />
                 <div className="h-3 w-3 rounded-full bg-amber-400/80" />
                 <div className="h-3 w-3 rounded-full bg-green-400/80" />
            </div>
            <div className="h-2 w-16 bg-zinc-300 dark:bg-zinc-700 rounded-full" />
        </div>

        {/* Paper Content */}
        <div className="p-8 space-y-6 opacity-90 relative z-10 bg-[url('https://www.transparenttextures.com/patterns/cubes.png')]">
            {/* Title */}
            <div className="space-y-2">
                <div className="h-5 w-3/4 bg-zinc-800/20 dark:bg-zinc-100/20 rounded animate-pulse" style={{animationDuration: '3s'}} />
                <div className="h-5 w-1/2 bg-zinc-800/20 dark:bg-zinc-100/20 rounded animate-pulse" style={{animationDuration: '4s'}} />
            </div>

            {/* Text Paragraphs */}
            <div className="space-y-2 pt-4">
                <div className="h-2 w-full bg-zinc-500/20 dark:bg-zinc-400/10 rounded" />
                <div className="h-2 w-full bg-zinc-500/20 dark:bg-zinc-400/10 rounded" />
                <div className="h-2 w-5/6 bg-zinc-500/20 dark:bg-zinc-400/10 rounded" />
            </div>

            {/* THE RISK ZONE (Internal Highlight) */}
            <div className="space-y-2 pt-2 relative">
                {/* This box lights up when scanned */}
                <div className="relative p-1 -m-1 rounded transition-all duration-500 animate-reveal-risk">
                    <div className="h-2 w-full bg-zinc-500/20 dark:bg-zinc-400/10 rounded" />
                    <div className="h-2 w-11/12 bg-zinc-500/20 dark:bg-zinc-400/10 rounded mt-2" />
                </div>
            </div>

            <div className="space-y-2 pt-4">
                <div className="h-2 w-full bg-zinc-500/20 dark:bg-zinc-400/10 rounded" />
                <div className="h-2 w-4/5 bg-zinc-500/20 dark:bg-zinc-400/10 rounded" />
            </div>
            
             {/* Signature Area */}
            <div className="pt-8 flex items-end justify-between opacity-50">
                 <div className="h-8 w-24 border-b-2 border-zinc-300 dark:border-zinc-700" />
                 <div className="h-10 w-10 bg-zinc-200 dark:bg-zinc-800 rounded-full" />
            </div>
        </div>

        {/* --- OPTICAL SCANNER BEAM --- */}
        <div className="absolute inset-x-0 h-[80px] -translate-y-[80px] animate-scanner-bar z-20 pointer-events-none">
             {/* The Laser Line */}
             <div className="absolute bottom-0 left-0 right-0 h-[2px] bg-blue-500 shadow-[0_0_20px_2px_rgba(59,130,246,1)]" />
             {/* The Light Wash */}
             <div className="absolute bottom-[2px] left-0 right-0 h-full bg-gradient-to-t from-blue-500/20 to-transparent" />
        </div>
      </div>
    </div>
  );
}

function FeatureCard({
  title,
  subtitle,
  bullets,
  icon,
}: {
  title: string;
  subtitle: string;
  bullets: string[];
  icon?: React.ReactNode;
}) {
  return (
    <Card className="rounded-2xl transition-all duration-200 hover:-translate-y-1 hover:shadow-xl glass-card border-white/5">
      <CardContent className="p-6">
        <div className="flex items-start gap-4">
          {icon ? (
            <div className="mt-1 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg border border-white/10 bg-zinc-800/80 text-white shadow-inner">
              {icon}
            </div>
          ) : null}

          <div>
            <div className="text-base font-bold text-foreground">{title}</div>
            <p className="mt-2 text-sm text-muted-foreground leading-relaxed">
              {subtitle}
            </p>
          </div>
        </div>

        <ul className="mt-5 space-y-3">
          {bullets.map((b) => (
            <li key={b} className="flex gap-3 text-sm text-zinc-400">
              <CheckCircle2 className="h-4 w-4 shrink-0 text-blue-500" />
              <span>{b}</span>
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function RoiBenefitGraphic() {
  return (
    <div className="mt-12">
      <div className="grid gap-2 sm:grid-cols-[1fr_auto] sm:items-start mb-6">
		  <div>
			<h3 className="text-lg font-semibold">Time and cost impact</h3>
			<p className="text-muted-foreground">
			  Built to reduce non-billable review effort instantly.
			</p>
		  </div>
	  </div>

      <div className="grid gap-4 md:grid-cols-3 md:items-stretch">
        <div className="h-full rounded-2xl border border-white/10 bg-zinc-600/20 p-6 backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <Clock className="h-6 w-6 text-blue-400" />
            <div>
              <div className="font-bold text-white">Save 4+ Hours</div>
              <p className="mt-1 text-sm text-zinc-600">
                Per tender on manual reading and extraction.
              </p>
            </div>
          </div>
        </div>

        <div className="h-full rounded-2xl border border-white/10 bg-zinc-600/20 p-6 backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <Euro className="h-6 w-6 text-emerald-400" />
            <div>
              <div className="font-bold text-white">Protect Margin</div>
              <p className="mt-1 text-sm text-zinc-600">
                Avoid bidding on projects with hidden penalties.
              </p>
            </div>
          </div>
        </div>

        <div className="h-full rounded-2xl border border-white/10 bg-zinc-600/20 p-6 backdrop-blur-sm">
          <div className="flex items-start gap-4">
            <ShieldCheck className="h-6 w-6 text-purple-400" />
            <div>
              <div className="font-bold text-white">Compliance</div>
              <p className="mt-1 text-sm text-zinc-600">
                Never miss a mandatory ISO or GDPR requirement.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen bg-background aurora-bg selection:bg-blue-500/30 overflow-x-hidden">
      
      {/* Header */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/90 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 md:h-16 md:px-8 md:py-0">
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-lg flex items-center justify-center shadow-lg">
              <Command className="h-5 w-5" />
            </div>
            <span>TenderPilot</span>
          </Link>

          {/* Desktop nav */}
          <div className="hidden md:flex items-center gap-4">
            <Link href="/how-it-works" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                How it works
            </Link>
            <Link href="/sample" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
                Sample output
            </Link>
            <Button asChild className="rounded-full shadow-lg shadow-blue-500/20 bg-primary text-primary-foreground ml-2">
              <Link href="#early-access">
                Get Audit Engine Access
              </Link>
            </Button>
            {/* Added Toggle Here */}
            <div className="ml-2 pl-2 border-l border-white/10">
               <ModeToggle />
            </div>
          </div>

          {/* Mobile nav */}
          <details className="relative md:hidden z-50">
            <summary className="cursor-pointer list-none rounded-full border border-white/10 bg-zinc-900/50 px-3 py-2 text-sm font-medium text-foreground backdrop-blur-md [&::-webkit-details-marker]:hidden">
              Menu
            </summary>

            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-white/10 bg-zinc-900/95 p-2 shadow-xl backdrop-blur-xl ring-1 ring-black/5">
              <Link
                href="/how-it-works"
                className="block rounded-xl px-3 py-2 text-sm hover:bg-white/5 text-muted-foreground hover:text-foreground"
              >
                How it works
              </Link>
              <Link
                href="/sample"
                className="block rounded-xl px-3 py-2 text-sm hover:bg-white/5 text-muted-foreground hover:text-foreground"
              >
                Sample output
              </Link>
              <Link
                href="#early-access"
                className="block rounded-xl px-3 py-2 text-sm font-medium text-blue-400 hover:bg-blue-500/10"
              >
                Get Audit Engine Access
              </Link>
              
              {/* Mobile Toggle */}
              <div className="mt-2 flex items-center justify-between border-t border-white/10 px-3 pt-3 pb-1">
                <span className="text-sm text-muted-foreground">Theme</span>
                <ModeToggle />
              </div>
            </div>
          </details>
        </div>
      </header>

      {/* HERO */}
      <section className="relative mx-auto max-w-7xl px-4 pt-20 pb-24 md:px-8 md:pt-32 overflow-hidden">
        
        {/* Background Glow */}
        <div className="pointer-events-none absolute top-1/2 left-0 -translate-x-1/2 h-[600px] w-[600px] bg-blue-600/10 blur-[120px] rounded-full opacity-50" />

        <div className="grid gap-16 lg:grid-cols-[1.1fr_0.9fr] lg:items-center relative z-10">
          <div>
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-zinc-900/50 border border-white/10 text-blue-300 text-xs font-medium mb-8 shadow-sm backdrop-blur-md">
                <Sparkles className="w-3 h-3 text-blue-400" />
                <span>Specialized Tender AI Model</span>
            </div>

            <h1 className="text-5xl font-bold tracking-tight md:text-7xl mb-8 leading-[1.1]">
              Stop Reading. <br/>
              <span className="text-gradient-brand">Start Deciding.</span>
            </h1>

            <p className="text-xl text-zinc-800 leading-relaxed mb-10 max-w-lg">
              The "Friday 4PM" solution. Upload complex tender PDFs and get an instant Go/No-Go decision based on risks and mandatory requirements.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 mb-10">
               <Button asChild size="lg" className="rounded-full text-base px-8 h-14 shadow-xl shadow-blue-500/20">
                  <Link href="#early-access">Get Audit Engine Access</Link>
               </Button>
               <Button asChild variant="outline" size="lg" className="rounded-full text-base px-8 h-14 bg-transparent border-white/10 hover:bg-white/70 hover:border-white/20 text-foreground transition-all">
				  <Link href="/sample">See Sample Output</Link>
				</Button>
            </div>

            <div className="flex items-center gap-4 text-sm text-zinc-500">
                <div className="flex -space-x-3">
                  {[1, 2, 3].map((i) => (
                    <div key={i} className="h-8 w-8 rounded-full border-2 border-background bg-zinc-800 flex items-center justify-center text-[10px] text-white/50">
                      U
                    </div>
                  ))}
                </div>
                <span>Validated in private pilots by <span className="font-semibold text-foreground">Tier-1 Consultants</span></span>
            </div>
          </div>

          {/* REALISTIC SCANNER COMPONENT */}
          <div className="relative pl-4 lg:pl-12">
            <ScannerHero />
          </div>
        </div>
      </section>

      {/* FEATURES */}
      <section className="mx-auto max-w-7xl px-4 pb-24 md:px-8">
        <div className="text-center mb-16">
            <h2 className="text-3xl font-bold">What you get from a tender document</h2>
            <p className="text-zinc-400 mt-4">We turn 100 pages of PDF into 3 actionable lists.</p>
        </div>

        <div className="grid gap-8 md:grid-cols-3">
          <FeatureCard
            title="Executive summary"
            subtitle="A concise, decision-oriented summary to support early go/no-go decisions and faster stakeholder alignment."
            bullets={["Scope and context", "Key constraints", "Decision points"]}
            icon={<FileSearch className="h-5 w-5" />}
          />
          <FeatureCard
            title="Mandatory requirements"
            subtitle="Requirements extracted and structured to reduce the risk of missing disqualifying conditions."
            bullets={[
              "Mandatory vs optional",
              "Clear pass / review",
              "Verification-ready",
            ]}
            icon={<ListChecks className="h-5 w-5" />}
          />
          <FeatureCard
            title="Risks and ambiguities"
            subtitle="Unclear clauses, gaps, and potential delivery or cost risks highlighted early so you can clarify sooner."
            bullets={["Severity labels", "Open points", "Clarification prompts"]}
            icon={<ShieldAlert className="h-5 w-5" />}
          />
        </div>

        <RoiBenefitGraphic />

        {/* ZERO TRAINING BADGE */}
        <div className="mt-20 flex justify-center">
            <div className="inline-flex items-center gap-3 px-6 py-3 rounded-full border border-white/10 bg-zinc-600/20 backdrop-blur-sm hover:bg-zinc-800/50 transition-colors cursor-default">
               <ShieldCheck className="w-5 h-5 text-emerald-400" />
               <span className="text-sm font-medium text-zinc-600">
                 <span className="text-white font-semibold">Zero-Training Policy:</span> We do not use your tender data to train our models.
               </span>
            </div>
        </div>
      </section>

      {/* EARLY ACCESS FORM */}
      <section
        id="early-access"
        className="mx-auto max-w-7xl px-4 pb-32 md:px-8 scroll-mt-24"
      >
          <div className="max-w-4xl mx-auto relative z-10 text-center">
             <h2 className="text-4xl md:text-5xl font-bold tracking-tight mb-6">Cut Tender Evaluation Time by 90%</h2>
             <p className="text-xl text-zinc-400 mb-12 max-w-2xl mx-auto">
                Secure your spot in the early access program. Analyze your first tender in minutes.
             </p>
             
             {/* Form Container */}
             <div className="max-w-md mx-auto bg-zinc-600/20 backdrop-blur-md border border-white/10 rounded-2xl p-8 shadow-2xl">
                 <WaitlistInline source="landing" />
                 <p className="mt-6 text-xs text-center text-zinc-500">
                   Limited spots available for the beta program.
                 </p>
             </div>
          </div>
          
          {/* Background Gradient for Bottom */}
          <div className="absolute bottom-0 left-0 right-0 h-[400px] bg-gradient-to-t from-blue-900/20 to-transparent pointer-events-none -z-10" />
      </section>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-12 bg-zinc-950">
        <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 md:flex-row md:items-center md:justify-between md:px-8">
          <div className="text-sm text-zinc-500">
            © {new Date().getFullYear()} TenderPilot
          </div>
          <div className="flex flex-wrap items-center gap-8 text-sm font-medium">
            <Link href="/how-it-works" className="text-zinc-400 hover:text-white transition-colors">
              How it works
            </Link>
            <Link href="/sample" className="text-zinc-400 hover:text-white transition-colors">
              Sample output
            </Link>
			<Link href="/tenders/software" className="text-zinc-400 hover:text-white transition-colors">
			  Browse Software Tenders
			</Link>
            <Link
              href="#early-access"
              className="text-blue-400 hover:text-blue-300"
            >
              Get Audit Engine Access
            </Link>
            <Link href="/privacy" className="text-zinc-400 hover:text-white transition-colors">
              Privacy
            </Link>
            <Link href="/terms" className="text-zinc-400 hover:text-white transition-colors">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}