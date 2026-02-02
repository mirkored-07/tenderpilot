import { Suspense } from "react";
import { LanguageSwitcher } from "@/components/marketing/LanguageSwitcher";

export default function LanguageSwitcherSlot() {
  return (
    <Suspense fallback={null}>
      <LanguageSwitcher />
    </Suspense>
  );
}
