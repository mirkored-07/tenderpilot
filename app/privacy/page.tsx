import Link from "next/link";
import { ArrowLeft, Command, ShieldCheck, Lock, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Privacy Policy | TenderPilot",
  description: "How we handle your data, our zero-training policy, and security measures.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-background aurora-bg selection:bg-blue-500/30">
      
      {/* HEADER */}
      <header className="sticky top-0 z-50 border-b border-white/5 bg-background/80 backdrop-blur-xl">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          {/* Logo -> Home */}
          <Link href="/" className="flex items-center gap-2 font-bold text-lg tracking-tight hover:opacity-80 transition-opacity">
            <div className="h-8 w-8 bg-gradient-to-br from-blue-600 to-indigo-600 text-white rounded-lg flex items-center justify-center shadow-lg">
              <Command className="h-5 w-5" />
            </div>
            <span>TenderPilot</span>
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
            <h1 className="text-4xl md:text-5xl font-bold mb-6 tracking-tight">Privacy Policy</h1>
            <p className="text-xl text-muted-foreground">
                We treat your tender data as confidential. <br/>
                <span className="text-blue-400">We do not train our models on your documents.</span>
            </p>
        </div>

        {/* TRUST HIGHLIGHTS */}
        <div className="grid md:grid-cols-3 gap-4 mb-12">
            <div className="glass-card p-6 rounded-xl border-white/10 flex flex-col items-center text-center">
                <div className="h-10 w-10 bg-emerald-500/10 text-emerald-400 rounded-full flex items-center justify-center mb-4">
                    <ShieldCheck className="w-5 h-5"/>
                </div>
                <h3 className="font-semibold mb-2">Zero Training</h3>
                <p className="text-xs text-muted-foreground">Your uploads are processed and then discarded or stored encrypted. They never enter the model's training set.</p>
            </div>
            <div className="glass-card p-6 rounded-xl border-white/10 flex flex-col items-center text-center">
                <div className="h-10 w-10 bg-blue-500/10 text-blue-400 rounded-full flex items-center justify-center mb-4">
                    <Lock className="w-5 h-5"/>
                </div>
                <h3 className="font-semibold mb-2">Encryption</h3>
                <p className="text-xs text-muted-foreground">Data is encrypted at rest (AES-256) and in transit (TLS 1.3).</p>
            </div>
            <div className="glass-card p-6 rounded-xl border-white/10 flex flex-col items-center text-center">
                <div className="h-10 w-10 bg-purple-500/10 text-purple-400 rounded-full flex items-center justify-center mb-4">
                    <EyeOff className="w-5 h-5"/>
                </div>
                <h3 className="font-semibold mb-2">Access Control</h3>
                <p className="text-xs text-muted-foreground">Strict Row Level Security (RLS) ensures only your account can see your analysis.</p>
            </div>
        </div>

        {/* LEGAL CONTENT */}
        <div className="glass-card p-8 md:p-12 rounded-2xl border border-white/10 space-y-8 text-sm leading-relaxed text-muted-foreground">
            
            <section>
                <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                    <span className="text-blue-500">1.</span> Introduction
                </h2>
                <p>
                    TenderPilot ("we", "our", or "us") respects your privacy. This Privacy Policy explains how we collect, use, and protect your personal information and the sensitive business data (such as Tender Documents) you upload to our platform. By using TenderPilot, you agree to the practices described in this policy.
                </p>
            </section>

            <section>
                <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                    <span className="text-blue-500">2.</span> Data We Collect
                </h2>
                <ul className="list-disc pl-5 space-y-2">
                    <li><strong>Account Information:</strong> Email address, name, and company details provided during sign-up.</li>
                    <li><strong>Uploaded Documents:</strong> PDF, Word, or text files you upload for analysis ("Tender Data").</li>
                    <li><strong>Usage Data:</strong> Anonymized metrics on feature usage, error logs, and performance data to improve stability.</li>
                </ul>
            </section>

            <section>
                <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                    <span className="text-blue-500">3.</span> How We Use Your Data
                </h2>
                <p className="mb-4">We use your data solely to provide the Service:</p>
                <ul className="list-disc pl-5 space-y-2">
                    <li>To extract requirements, risks, and summaries from your uploaded documents via Large Language Models (LLMs).</li>
                    <li>To authenticate your access and manage your subscription.</li>
                    <li>To communicate with you regarding service updates or security alerts.</li>
                </ul>
                <div className="mt-4 p-4 bg-blue-500/10 border border-blue-500/20 rounded-lg text-blue-200">
                    <strong>Crucial:</strong> We contractually forbid our AI providers from using your data to train their foundation models. Your data remains yours.
                </div>
            </section>

            <section>
                <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                    <span className="text-blue-500">4.</span> Data Retention
                </h2>
                <p>
                    <strong>Tender Data:</strong> You have full control. You can delete individual audits at any time, which permanently removes the extracted data and associated files from our storage buckets immediately.
                </p>
                <p className="mt-2">
                    <strong>Account Data:</strong> Retained as long as your account is active. Upon cancellation, data is deleted within 30 days.
                </p>
            </section>

            <section>
                <h2 className="text-xl font-bold text-foreground mb-4 flex items-center gap-2">
                    <span className="text-blue-500">5.</span> Third-Party Subprocessors
                </h2>
                <p>We use trusted infrastructure providers to deliver the service:</p>
                <ul className="list-disc pl-5 mt-2 space-y-1">
                    <li><strong>Vercel / AWS:</strong> Hosting and Compute.</li>
                    <li><strong>Supabase:</strong> Database and Authentication.</li>
                    <li><strong>OpenAI / Anthropic:</strong> LLM inference (via Zero-Retention APIs).</li>
                </ul>
            </section>

            <section className="pt-8 border-t border-white/10">
                <p className="text-xs">
                    Last Updated: February 2026. <br/>
                    Contact: <a href="mailto:privacy@tenderpilot.com" className="text-foreground underline">privacy@tenderpilot.com</a>
                </p>
            </section>
        </div>
      </main>

      {/* FOOTER */}
      <footer className="border-t border-white/5 py-12 bg-background">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex flex-col md:flex-row justify-between items-center gap-6">
          <div className="text-sm text-muted-foreground">
            © {new Date().getFullYear()} TenderPilot
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
            <Link href="/privacy" className="text-foreground font-medium cursor-default">
              Privacy
            </Link>
            <Link href="/terms" className="text-muted-foreground hover:text-foreground">
              Terms
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}