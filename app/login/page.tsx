import LoginClient from "./LoginClient";

// This page depends on querystring routing (next=...), so keep it dynamic.
export const dynamic = "force-dynamic";

function safeNextPath(v: unknown) {
  const raw = typeof v === "string" ? v : "";
  // Only allow internal paths to avoid open-redirect risks.
  if (!raw || !raw.startsWith("/")) return "/app/upload";
  if (raw.startsWith("//")) return "/app/upload";
  return raw;
}

export default function LoginPage({
  searchParams,
}: {
  searchParams?: { [key: string]: string | string[] | undefined };
}) {
  const nextParam = searchParams?.next;
  const nextPath = safeNextPath(Array.isArray(nextParam) ? nextParam[0] : nextParam);
  return <LoginClient nextPath={nextPath} />;
}
