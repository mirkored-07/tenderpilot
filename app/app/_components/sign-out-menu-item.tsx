"use client";

import { useRouter } from "next/navigation";
import { DropdownMenuItem } from "@/components/ui/dropdown-menu";
import { supabaseBrowser } from "@/lib/supabase/browser";

export function SignOutMenuItem() {
  const router = useRouter();

  return (
    <DropdownMenuItem
      onSelect={async (e) => {
        e.preventDefault();
        const supabase = supabaseBrowser();
        await supabase.auth.signOut();
        router.replace("/login");
        router.refresh();
      }}
    >
      Sign out
    </DropdownMenuItem>
  );
}
