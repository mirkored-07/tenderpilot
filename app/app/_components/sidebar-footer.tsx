"use client";

import { Badge } from "@/components/ui/badge";
import { ModeToggle } from "@/components/mode-toggle";
import { cn } from "@/lib/utils";
import { useAppI18n } from "./app-i18n-provider";

export function SidebarFooter({
  creditsBalance,
  tone = "dark",
}: {
  creditsBalance: number | null;
  tone?: "dark" | "light";
}) {
  const { t } = useAppI18n();
  const isDark = tone === "dark";

  return (
    <div className={cn("border-t p-4 space-y-4", isDark ? "border-white/15" : "border-border")}>
      <div
        className={cn(
          "rounded-2xl p-4 ring-1",
          isDark ? "bg-white/12 ring-white/15" : "bg-card ring-border"
        )}
      >
        <p className={cn("text-xs font-medium", isDark ? "text-white/80" : "text-muted-foreground")}>
          {t("app.credits.title")}
        </p>
        <div className="mt-2 flex items-center justify-between">
          <Badge variant="secondary" className="rounded-full">
            {typeof creditsBalance === "number" ? creditsBalance : "—"}
          </Badge>
          <span className={cn("text-xs font-medium", isDark ? "text-white/80" : "text-muted-foreground")}>
            {t("app.credits.left")}
          </span>
        </div>
        <p className={cn("mt-3 text-xs leading-relaxed", isDark ? "text-white/75" : "text-muted-foreground")}>
          {t("app.credits.help")}
        </p>
      </div>

      <div className="flex w-full items-center justify-between px-2">
        <span className={cn("text-xs font-medium", isDark ? "text-white/80" : "text-muted-foreground")}>
          {t("app.common.theme")}
        </span>

        <div className={cn(isDark ? "[&_button]:text-white [&_svg]:text-white" : "")}>
          <ModeToggle
            labels={{
              toggleTheme: t("app.common.theme"),
              light: t("app.common.light"),
              dark: t("app.common.dark"),
              system: t("app.common.system"),
            }}
          />
        </div>
      </div>
    </div>
  );
}
