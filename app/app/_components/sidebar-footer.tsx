"use client";

import { Badge } from "@/components/ui/badge";
import { ModeToggle } from "@/components/mode-toggle";
import { useAppI18n } from "./app-i18n-provider";

export function SidebarFooter({ creditsBalance }: { creditsBalance: number | null }) {
  const { t } = useAppI18n();

  return (
    <div className="border-t border-white/15 p-4 space-y-4">
      <div className="rounded-2xl bg-white/12 p-4 ring-1 ring-white/15">
        <p className="text-xs font-medium text-white/80">{t("app.credits.title")}</p>
        <div className="mt-2 flex items-center justify-between">
          <Badge variant="secondary" className="rounded-full">
            {typeof creditsBalance === "number" ? creditsBalance : "—"}
          </Badge>
          <span className="text-xs font-medium text-white/80">{t("app.credits.left")}</span>
        </div>
        <p className="mt-3 text-xs text-white/75 leading-relaxed">{t("app.credits.help")}</p>
      </div>

      <div className="flex w-full items-center justify-between px-2">
        <span className="text-xs font-medium text-white/80">{t("app.common.theme")}</span>
        <div className="[&_button]:text-white [&_svg]:text-white">
          <ModeToggle />
        </div>
      </div>
    </div>
  );
}
