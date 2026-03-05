import LoginClient from "./LoginClient";
import { cookies } from "next/headers";
import { AppI18nProvider } from "@/app/app/_components/app-i18n-provider";

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

  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get("tp_locale")?.value ?? null;

  return (
    <AppI18nProvider initialLocale={cookieLocale} initialOutputLanguage={cookieLocale}>
      <LoginClient nextPath={nextPath} />
    </AppI18nProvider>
  );
}
