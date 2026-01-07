"use client";

import { useEffect } from "react";
import { initTelemetry, track } from "@/lib/telemetry";

export function TelemetryInit() {
  useEffect(() => {
    initTelemetry();
    track("app_loaded");
  }, []);

  return null;
}
