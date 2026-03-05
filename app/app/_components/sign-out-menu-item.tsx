"use client";

import { useRouter } from "next/navigation";

import { supabaseBrowser } from "@/lib/supabase/browser";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { useAppI18n } from "./app-i18n-provider";

export function SignOutMenuItem() {
  const router = useRouter();
  const { t } = useAppI18n();

  return (
    <DropdownMenuItem
      onClick={async () => {
        await supabaseBrowser().auth.signOut();
        router.push("/");
      }}
    >
      {t("app.account.profile.signOut")}
    </DropdownMenuItem>
  );
}
