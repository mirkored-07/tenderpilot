import LoginClient from "./LoginClient";

export const dynamic = "force-dynamic";

function safeNextPath(v: unknown) {
  const raw = typeof v === "string" ? v : "";
  if (!raw || !raw.startsWith("/")) return "/app/jobs";
  if (raw.startsWith("//")) return "/app/jobs";
  return raw;
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams?:
    | { [key: string]: string | string[] | undefined }
    | Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp =
    searchParams && typeof (searchParams as any)?.then === "function"
      ? await (searchParams as any)
      : (searchParams as any) || {};

  const nextParam = sp.next;
  const nextPath = safeNextPath(Array.isArray(nextParam) ? nextParam[0] : nextParam);

  return <LoginClient nextPath={nextPath} />;
}