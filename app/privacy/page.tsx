export const metadata = {
  title: "Privacy Policy | TenderPilot",
};

const LAST_UPDATED = "2026-01-20";

export default function PrivacyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-12 space-y-8">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Privacy Policy</h1>
        <p className="text-sm text-muted-foreground">Last updated: {LAST_UPDATED}</p>
      </header>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Overview</h2>
        <p className="text-sm text-muted-foreground">
          TenderPilot helps you review tenders by extracting text from uploaded documents and generating structured
          outputs such as requirements, risks, clarifications, and a draft outline. This Privacy Policy explains what we
          collect, how we use it, and your choices.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">What we collect</h2>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
          <li>
            <span className="text-foreground">Account data</span>: your email address and optional profile information you
            provide, such as name and company.
          </li>
          <li>
            <span className="text-foreground">Uploaded content</span>: the documents you upload and the extracted text
            derived from them.
          </li>
          <li>
            <span className="text-foreground">Generated outputs</span>: requirements, risks, open questions, and a draft
            outline produced by the system.
          </li>
          <li>
            <span className="text-foreground">Operational and technical data</span>: basic logs needed to run and secure
            the service, such as error logs and request metadata.
          </li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">How we use data</h2>
        <ul className="list-disc pl-5 text-sm text-muted-foreground space-y-2">
          <li>To provide the service: extract text, generate outputs, store results, and enable downloads.</li>
          <li>To operate and secure the platform: prevent abuse, monitor reliability, and fix issues.</li>
          <li>We do not sell your personal data.</li>
        </ul>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Processors and subprocessors</h2>
        <p className="text-sm text-muted-foreground">
          TenderPilot may use third party providers to deliver the service, such as hosting, document extraction, and AI
          processing providers. These providers process data only to provide the service.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Retention</h2>
        <p className="text-sm text-muted-foreground">
          We retain account data and generated results while your account is active and as needed to provide the service.
          You can request deletion of your account and associated data.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Your choices and rights</h2>
        <p className="text-sm text-muted-foreground">
          You can request access, correction, export, or deletion of your data. If you are in the EEA or UK, you may have
          additional rights under GDPR.
        </p>
      </section>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold">Security</h2>
        <p className="text-sm text-muted-foreground">
          We use reasonable measures to protect your data. No system can be guaranteed completely secure.
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
