export const metadata = {
  title: "Terms of Service | TenderPilot",
};

const LAST_UPDATED = "2026-01-20";

export default function TermsPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Terms of Service</h1>
        <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Service description</h2>
        <p className="text-sm text-muted-foreground">
          TenderPilot helps you review tender documents by extracting text and generating structured outputs such as
          requirements, risks, clarifications, and a draft outline.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Decision support only</h2>
        <p className="text-sm text-muted-foreground">
          Outputs are drafting and decision support aids only. You are responsible for verifying outputs against the
          original tender documents. TenderPilot does not provide legal, financial, or procurement advice.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your responsibilities</h2>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
          <li>You confirm you have the right to upload and process the documents you provide.</li>
          <li>You are responsible for protecting confidential information and complying with applicable obligations.</li>
          <li>You must not use the service for unlawful or abusive purposes.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Content and outputs</h2>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
          <li>You retain ownership of the documents you upload.</li>
          <li>You are responsible for how you use generated outputs.</li>
          <li>We store extracted text and outputs to provide the service and let you access past reviews.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Availability</h2>
        <p className="text-sm text-muted-foreground">
          We aim for reliable uptime, but downtime may occur due to maintenance or outages.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Limitation of liability</h2>
        <p className="text-sm text-muted-foreground">
          To the maximum extent permitted by law, TenderPilot is not liable for indirect or consequential losses arising
          from your use of the service. Your use is at your own risk.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Termination</h2>
        <p className="text-sm text-muted-foreground">
          You may stop using the service at any time. We may suspend access in cases of abuse or unlawful use.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Changes</h2>
        <p className="text-sm text-muted-foreground">
          We may update these terms from time to time. Continued use means you accept the updated terms.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Contact</h2>
        <p className="text-sm text-muted-foreground">
          Support contact is coming soon.
        </p>
      </section>
    </div>
  );
}
