"use client";

import UploadForm from "./upload-form";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useAppI18n } from "../_components/app-i18n-provider";

export default function UploadPageClient() {
  const { t } = useAppI18n();

  return (
    <div className="mx-auto max-w-3xl">
      <Card className="rounded-2xl">
        <CardHeader className="pb-3">
          <CardTitle className="text-xl">{t("app.upload.title")}</CardTitle>
          <p className="text-sm text-muted-foreground">{t("app.upload.subtitle")}</p>
        </CardHeader>

        <CardContent className="space-y-4 pt-0">
          <UploadForm />
          <p className="text-xs leading-relaxed text-muted-foreground">{t("app.upload.disclaimer")}</p>
        </CardContent>
      </Card>
    </div>
  );
}
