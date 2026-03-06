"use client";

import * as React from "react";
import { usePathname } from "next/navigation";
import { Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { joinWaitlistAction } from "@/app/actions/waitlist";

type Props = {
  className?: string;
  source?: string;
};

type Copy = {
  success: string;
  missingEmail: string;
  invalidEmail: string;
  placeholder: string;
  ariaLabel: string;
  submit: string;
  footer: string;
};

const COPY: Record<string, Copy> = {
  en: {
    success: "You’re on the list. We’ll be in touch.",
    missingEmail: "Please enter your email.",
    invalidEmail: "Please enter a valid email address.",
    placeholder: "you@company.com",
    ariaLabel: "Email address",
    submit: "Get early access",
    footer: "No spam. One email when access opens.",
  },
  de: {
    success: "Du bist auf der Liste. Wir melden uns.",
    missingEmail: "Bitte gib deine E-Mail-Adresse ein.",
    invalidEmail: "Bitte gib eine gültige E-Mail-Adresse ein.",
    placeholder: "du@firma.com",
    ariaLabel: "E-Mail-Adresse",
    submit: "Early Access anfragen",
    footer: "Kein Spam. Eine E-Mail, sobald der Zugang geöffnet ist.",
  },
  it: {
    success: "Sei in lista. Ti contatteremo.",
    missingEmail: "Inserisci la tua email.",
    invalidEmail: "Inserisci un indirizzo email valido.",
    placeholder: "tu@azienda.com",
    ariaLabel: "Indirizzo email",
    submit: "Richiedi early access",
    footer: "Niente spam. Una sola email quando l’accesso sarà disponibile.",
  },
  fr: {
    success: "Vous êtes sur la liste. Nous vous contacterons.",
    missingEmail: "Veuillez saisir votre e-mail.",
    invalidEmail: "Veuillez saisir une adresse e-mail valide.",
    placeholder: "vous@entreprise.com",
    ariaLabel: "Adresse e-mail",
    submit: "Demander un early access",
    footer: "Pas de spam. Un seul e-mail quand l’accès ouvrira.",
  },
  es: {
    success: "Ya estás en la lista. Nos pondremos en contacto.",
    missingEmail: "Introduce tu correo electrónico.",
    invalidEmail: "Introduce una dirección de correo válida.",
    placeholder: "tu@empresa.com",
    ariaLabel: "Correo electrónico",
    submit: "Solicitar acceso anticipado",
    footer: "Sin spam. Un solo correo cuando el acceso esté disponible.",
  },
};

function detectLocale(pathname: string | null): keyof typeof COPY {
  const first = String(pathname ?? "/").split("/").filter(Boolean)[0]?.toLowerCase();
  if (first === "de" || first === "it" || first === "fr" || first === "es") return first;
  return "en";
}

export function WaitlistInline({ className, source = "landing" }: Props) {
  const pathname = usePathname();
  const copy = COPY[detectLocale(pathname)];
  const [email, setEmail] = React.useState("");
  const [status, setStatus] = React.useState<"idle" | "loading" | "success">("idle");
  const [error, setError] = React.useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    const trimmed = email.trim();
    if (!trimmed) return setError(copy.missingEmail);

    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
    if (!ok) return setError(copy.invalidEmail);

    setStatus("loading");
    const result = await joinWaitlistAction(trimmed, source);

    if (result.success) {
      setStatus("success");
    } else {
      setStatus("idle");
      setError(result.message);
    }
  }

  if (status === "success") {
    return (
      <div className={`flex items-center gap-2 rounded-2xl border bg-green-50/50 p-4 text-green-700 ${className}`}>
        <CheckCircle2 className="h-5 w-5" />
        <span className="text-sm font-medium">{copy.success}</span>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className={className}>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Input
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={copy.placeholder}
          type="email"
          className="h-11 rounded-full"
          aria-label={copy.ariaLabel}
          autoComplete="email"
          disabled={status === "loading"}
        />
        <Button
          type="submit"
          className="h-11 rounded-full min-w-[140px]"
          disabled={status === "loading"}
        >
          {status === "loading" ? <Loader2 className="h-4 w-4 animate-spin" /> : copy.submit}
        </Button>
      </div>
      <div className="mt-2 text-xs text-muted-foreground">{copy.footer}</div>
      {error ? <div className="mt-2 text-xs text-destructive">{error}</div> : null}
    </form>
  );
}
