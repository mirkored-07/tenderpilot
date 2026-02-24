"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { cn } from "@/lib/utils";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Separator } from "@/components/ui/separator";

import { useTheme } from "next-themes";
import { X, Pencil } from "lucide-react";

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  company: string | null;
};

type SettingsRow = {
  user_id: string;
  default_start_page: "upload" | "jobs" | null;
  theme: "system" | "light" | "dark" | null;
};

type InitialSnapshot = {
  fullName: string;
  company: string;
  defaultStartPage: "upload" | "jobs";
  theme: "system" | "light" | "dark";
};

type UsageSnapshot = {
  totalJobs: number;
  doneJobs: number;
  inProgressJobs: number;
};

function SegmentedChoice<T extends string>({
  value,
  onChange,
  options,
}: {
  value: T;
  onChange: (v: T) => void;
  options: { value: T; label: string }[];
}) {
  return (
    <div className="inline-flex rounded-xl border bg-background p-1">
      {options.map((opt) => {
        const active = opt.value === value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            className={cn(
              "px-3 py-1.5 text-sm rounded-lg transition",
              active
                ? "bg-muted text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground hover:bg-muted/40"
            )}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

type DeliveryMode = "remote" | "hybrid" | "onsite";
type CapacityBand = "low" | "medium" | "high";

type WorkspacePlaybook = {
  industry_tags: string[];
  offerings_summary: string;
  delivery_geographies: string[];
  languages_supported: string[];
  delivery_modes: DeliveryMode[];
  capacity_band: CapacityBand;
  typical_lead_time_weeks: number | null;
  certifications: string[];
  non_negotiables: string[];
};

const EMPTY_PLAYBOOK: WorkspacePlaybook = {
  industry_tags: [],
  offerings_summary: "",
  delivery_geographies: [],
  languages_supported: [],
  delivery_modes: [],
  capacity_band: "medium",
  typical_lead_time_weeks: null,
  certifications: [],
  non_negotiables: [],
};

function normalizeStringArray(input: unknown): string[] {
  const arr = Array.isArray(input) ? input : [];
  const out: string[] = [];
  for (const v of arr) {
    const s = String(v ?? "").trim();
    if (!s) continue;
    if (!out.includes(s)) out.push(s);
  }
  return out;
}

function normalizePlaybook(input: any): WorkspacePlaybook {
  const pb = input && typeof input === "object" ? input : {};

  const leadRaw = pb.typical_lead_time_weeks;
  const leadNum =
    typeof leadRaw === "number"
      ? leadRaw
      : Number(String(leadRaw ?? "").trim() || NaN);
  const lead =
    Number.isFinite(leadNum) && leadNum > 0 ? Math.round(leadNum) : null;

  const modesRaw = normalizeStringArray(pb.delivery_modes).filter(
    (m) => m === "remote" || m === "hybrid" || m === "onsite"
  ) as DeliveryMode[];

  const capRaw = String(pb.capacity_band ?? "medium").trim();
  const cap: CapacityBand =
    capRaw === "low" || capRaw === "high" || capRaw === "medium"
      ? (capRaw as CapacityBand)
      : "medium";

  const nonNeg = normalizeStringArray(pb.non_negotiables).slice(0, 10);

  return {
    industry_tags: normalizeStringArray(pb.industry_tags),
    offerings_summary: String(pb.offerings_summary ?? "").trim().slice(0, 240),
    delivery_geographies: normalizeStringArray(pb.delivery_geographies),
    languages_supported: normalizeStringArray(pb.languages_supported),
    delivery_modes: modesRaw,
    capacity_band: cap,
    typical_lead_time_weeks: lead,
    certifications: normalizeStringArray(pb.certifications),
    non_negotiables: nonNeg,
  };
}

function fingerprintPlaybook(pb: WorkspacePlaybook): string {
  return JSON.stringify(pb);
}

function ChipsInput({
  label,
  values,
  onChange,
  placeholder,
  disabled,
}: {
  label: string;
  values: string[];
  onChange: (next: string[]) => void;
  placeholder?: string;
  disabled?: boolean;
}) {
  const [draft, setDraft] = useState("");

  function commit(raw: string) {
    const s = String(raw ?? "").replace(/\s+/g, " ").trim();
    if (!s) return;
    if (values.includes(s)) return;
    onChange([...values, s]);
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">{label}</p>

      <div className="flex flex-wrap items-center gap-2">
        {values.map((v) => (
          <span
            key={v}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border bg-card px-2.5 py-1 text-xs",
              disabled ? "opacity-60" : ""
            )}
          >
            <span className="max-w-[220px] truncate">{v}</span>
            <button
              type="button"
              className="rounded-full px-1 text-muted-foreground hover:text-foreground"
              onClick={() => onChange(values.filter((x) => x !== v))}
              disabled={disabled}
              aria-label={`Remove ${v}`}
            >
              ×
            </button>
          </span>
        ))}

        <Input
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (disabled) return;
            if (e.key === "Enter" || e.key === ",") {
              e.preventDefault();
              commit(draft);
              setDraft("");
            }
            if (e.key === "Backspace" && !draft && values.length) {
              onChange(values.slice(0, -1));
            }
          }}
          onBlur={() => {
            if (disabled) return;
            commit(draft);
            setDraft("");
          }}
          placeholder={placeholder ?? "Type and press Enter"}
          className="h-9 w-[240px] rounded-xl"
          disabled={disabled}
        />
      </div>
    </div>
  );
}

function MiniChip({ text }: { text: string }) {
  return (
    <span className="inline-flex items-center rounded-full border bg-card px-2.5 py-1 text-xs text-foreground/80">
      {text}
    </span>
  );
}

function PlaybookModal({
  open,
  onClose,
  playbookEnabled,
  playbookStatus,
  playbook,
  setPlaybook,
  playbookVersion,
  playbookUpdatedAt,
  playbookSaving,
  playbookIsDirty,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  playbookEnabled: boolean;
  playbookStatus: { kind: "ok" | "err"; text: string } | null;
  playbook: WorkspacePlaybook;
  setPlaybook: React.Dispatch<React.SetStateAction<WorkspacePlaybook>>;
  playbookVersion: number;
  playbookUpdatedAt: string | null;
  playbookSaving: boolean;
  playbookIsDirty: boolean;
  onSave: () => Promise<void>;
}) {
  const [more, setMore] = useState(false);
  const firstInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    const t = window.setTimeout(() => firstInputRef.current?.focus(), 50);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.clearTimeout(t);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50">
      <div
        className="absolute inset-0 bg-black/40 backdrop-blur-sm"
        onClick={onClose}
      />

      <div className="absolute left-1/2 top-1/2 w-[min(92vw,860px)] max-h-[86vh] -translate-x-1/2 -translate-y-1/2 overflow-hidden rounded-2xl border bg-background shadow-2xl">
        <div className="flex items-start justify-between gap-3 border-b px-6 py-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">Bid Playbook</p>
            <h2 className="text-lg font-semibold tracking-tight">
              Edit playbook rules
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              These rules shape Go / Hold / No Go. They are not used as evidence.
            </p>
          </div>

          <div className="flex items-center gap-2">
            {playbookStatus ? (
              <Badge
                variant={
                  playbookStatus.kind === "ok" ? "secondary" : "destructive"
                }
                className="rounded-full"
              >
                {playbookStatus.text}
              </Badge>
            ) : null}

            <Button
              type="button"
              variant="outline"
              className="rounded-full h-9 px-3"
              onClick={onClose}
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </div>

        <div className="overflow-y-auto px-6 py-5">
          {!playbookEnabled ? (
            <div className="rounded-2xl border bg-muted/20 p-4">
              <p className="text-sm text-muted-foreground">
                Playbook storage is not enabled yet. Apply the migration and
                refresh.
              </p>
            </div>
          ) : (
            <div className="space-y-6">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">What you do</p>
                <Input
                  ref={firstInputRef}
                  value={playbook.offerings_summary}
                  onChange={(e) =>
                    setPlaybook((p) => ({
                      ...p,
                      offerings_summary: e.target.value,
                    }))
                  }
                  placeholder="One sentence summary"
                  className="rounded-xl"
                />
                <p className="text-[11px] text-muted-foreground">
                  Keep it short. This reduces generic noise.
                </p>
              </div>

              <div className="grid gap-5 md:grid-cols-2">
                <ChipsInput
                  label="Industries"
                  values={playbook.industry_tags}
                  onChange={(next) =>
                    setPlaybook((p) => ({ ...p, industry_tags: next }))
                  }
                  placeholder="Public sector, IT, healthcare"
                />

                <ChipsInput
                  label="Regions"
                  values={playbook.delivery_geographies}
                  onChange={(next) =>
                    setPlaybook((p) => ({ ...p, delivery_geographies: next }))
                  }
                  placeholder="Austria, DACH, EU"
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Work mode</p>
                <div className="flex flex-wrap items-center gap-4">
                  {(["remote", "hybrid", "onsite"] as const).map((m) => {
                    const checked = (playbook.delivery_modes ?? []).includes(m);
                    const label =
                      m === "onsite"
                        ? "Onsite"
                        : m === "hybrid"
                        ? "Hybrid"
                        : "Remote";
                    return (
                      <label
                        key={m}
                        className="inline-flex items-center gap-2 text-sm text-foreground/80"
                      >
                        <input
                          type="checkbox"
                          className="h-4 w-4 rounded border-border"
                          checked={checked}
                          onChange={() => {
                            setPlaybook((p) => {
                              const cur = p.delivery_modes ?? [];
                              const next = checked
                                ? cur.filter((x) => x !== m)
                                : [...cur, m];
                              return { ...p, delivery_modes: next };
                            });
                          }}
                        />
                        {label}
                      </label>
                    );
                  })}
                </div>
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">
                  Hard rules (max 10)
                </p>
                <textarea
                  value={(playbook.non_negotiables ?? []).join("\n")}
                  onChange={(e) => {
                    const lines = String(e.target.value ?? "")
                      .split(/\r?\n/)
                      .map((l) => l.trim())
                      .filter(Boolean)
                      .slice(0, 10);
                    setPlaybook((p) => ({ ...p, non_negotiables: lines }));
                  }}
                  placeholder={
                    "No onsite work\nISO 27001 required\nNo fixed price contracts"
                  }
                  className="min-h-[130px] w-full rounded-xl border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-muted"
                />
                <p className="text-[11px] text-muted-foreground">
                  If a rule influences the decision, it will appear as a playbook
                  trigger in the cockpit.
                </p>
              </div>

              <div className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setMore((v) => !v)}
                  className="text-xs font-medium text-muted-foreground hover:text-foreground"
                >
                  {more ? "Hide options" : "More options"}
                </button>

                <div className="text-[11px] text-muted-foreground">
                  v{playbookVersion}
                  {playbookUpdatedAt ? (
                    <>
                      {" "}
                      • Updated{" "}
                      <span className="text-foreground">
                        {new Date(playbookUpdatedAt).toLocaleString()}
                      </span>
                    </>
                  ) : null}
                </div>
              </div>

              {more ? (
                <div className="space-y-5 rounded-2xl border bg-muted/10 p-4">
                  <div className="grid gap-5 md:grid-cols-2">
                    <ChipsInput
                      label="Languages"
                      values={playbook.languages_supported}
                      onChange={(next) =>
                        setPlaybook((p) => ({
                          ...p,
                          languages_supported: next,
                        }))
                      }
                      placeholder="EN, DE, IT"
                    />
                    <ChipsInput
                      label="Certifications"
                      values={playbook.certifications}
                      onChange={(next) =>
                        setPlaybook((p) => ({ ...p, certifications: next }))
                      }
                      placeholder="ISO 27001, TISAX"
                    />
                  </div>

                  <div className="grid gap-5 md:grid-cols-2">
                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">Capacity</p>
                      <SegmentedChoice
                        value={playbook.capacity_band}
                        onChange={(v) =>
                          setPlaybook((p) => ({
                            ...p,
                            capacity_band: v as any,
                          }))
                        }
                        options={[
                          { value: "low", label: "Low" },
                          { value: "medium", label: "Medium" },
                          { value: "high", label: "High" },
                        ]}
                      />
                    </div>

                    <div className="space-y-2">
                      <p className="text-xs text-muted-foreground">
                        Typical lead time (weeks)
                      </p>
                      <Input
                        type="number"
                        inputMode="numeric"
                        min={1}
                        value={playbook.typical_lead_time_weeks ?? ""}
                        onChange={(e) => {
                          const raw = e.target.value;
                          const n = raw === "" ? null : Number(raw);
                          setPlaybook((p) => ({
                            ...p,
                            typical_lead_time_weeks:
                              Number.isFinite(n as any) && (n as any) > 0
                                ? Math.round(n as any)
                                : null,
                          }));
                        }}
                        placeholder="4"
                        className="rounded-xl"
                      />
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between gap-3 border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            className="rounded-full"
            onClick={onClose}
          >
            Cancel
          </Button>

          <Button
            type="button"
            className="rounded-full"
            onClick={onSave}
            disabled={!playbookEnabled || playbookSaving || !playbookIsDirty}
          >
            {playbookSaving ? "Saving…" : "Save playbook"}
          </Button>
        </div>
      </div>
    </div>
  );
}

export default function AccountPage() {
  const router = useRouter();

  const { setTheme } = useTheme();
  const [themeMounted, setThemeMounted] = useState(false);
  const [pendingTheme, setPendingTheme] = useState<"system" | "light" | "dark">(
    "system"
  );

  useEffect(() => {
    setThemeMounted(true);
  }, []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [userId, setUserId] = useState("");
  const [email, setEmail] = useState("");
  const [authMethod, setAuthMethod] = useState<string>("Email");

  const [usage, setUsage] = useState<UsageSnapshot | null>(null);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");

  const [defaultStartPage, setDefaultStartPage] = useState<"upload" | "jobs">(
    "upload"
  );

  const [playbookEnabled, setPlaybookEnabled] = useState(true);
  const [playbook, setPlaybook] = useState<WorkspacePlaybook>({
    ...EMPTY_PLAYBOOK,
  });
  const [playbookVersion, setPlaybookVersion] = useState<number>(1);
  const [playbookUpdatedAt, setPlaybookUpdatedAt] = useState<string | null>(
    null
  );
  const [playbookInitialFp, setPlaybookInitialFp] = useState<string>(
    fingerprintPlaybook(EMPTY_PLAYBOOK)
  );
  const [playbookSaving, setPlaybookSaving] = useState(false);
  const [playbookStatus, setPlaybookStatus] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);
  const [playbookOpen, setPlaybookOpen] = useState(false);

  const playbookNormalized = useMemo(
    () => normalizePlaybook(playbook),
    [playbook]
  );
  const playbookFp = useMemo(
    () => fingerprintPlaybook(playbookNormalized),
    [playbookNormalized]
  );
  const playbookIsDirty = useMemo(
    () => playbookFp !== playbookInitialFp,
    [playbookFp, playbookInitialFp]
  );

  const [initial, setInitial] = useState<InitialSnapshot | null>(null);

  const [status, setStatus] = useState<{
    kind: "ok" | "err";
    text: string;
  } | null>(null);

  const statusTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const shortUserId = useMemo(() => {
    if (!userId) return "";
    return userId.slice(0, 8) + "…" + userId.slice(-6);
  }, [userId]);

  const normalizedCurrent = useMemo(() => {
    const snap: InitialSnapshot = {
      fullName: fullName.trim(),
      company: company.trim(),
      defaultStartPage,
      theme: pendingTheme,
    };
    return snap;
  }, [fullName, company, defaultStartPage, pendingTheme]);

  const isDirty = useMemo(() => {
    if (!initial) return false;
    return (
      normalizedCurrent.fullName !== initial.fullName ||
      normalizedCurrent.company !== initial.company ||
      normalizedCurrent.defaultStartPage !== initial.defaultStartPage ||
      normalizedCurrent.theme !== initial.theme
    );
  }, [initial, normalizedCurrent]);

  function setStatusAutoClear(next: { kind: "ok" | "err"; text: string } | null) {
    if (statusTimer.current) {
      clearTimeout(statusTimer.current);
      statusTimer.current = null;
    }
    setStatus(next);
    if (next?.kind === "ok") {
      statusTimer.current = setTimeout(() => {
        setStatus(null);
        statusTimer.current = null;
      }, 2200);
    }
  }

  useEffect(() => {
    return () => {
      if (statusTimer.current) clearTimeout(statusTimer.current);
    };
  }, []);

  async function ensureProfileRow(
    supabase: ReturnType<typeof supabaseBrowser>,
    uid: string,
    mail: string
  ) {
    const { data, error } = await supabase
      .from("profiles")
      .select("id,email,full_name,company")
      .eq("id", uid)
      .maybeSingle();

    if (!error && data) return data as ProfileRow;

    const ins = await supabase.from("profiles").insert({ id: uid, email: mail });
    if (ins.error) throw ins.error;

    const again = await supabase
      .from("profiles")
      .select("id,email,full_name,company")
      .eq("id", uid)
      .single();

    if (again.error) throw again.error;
    return again.data as ProfileRow;
  }

  async function ensureSettingsRow(
    supabase: ReturnType<typeof supabaseBrowser>,
    uid: string
  ) {
    const { data, error } = await supabase
      .from("user_settings")
      .select("user_id,default_start_page,theme")
      .eq("user_id", uid)
      .maybeSingle();

    if (!error && data) return data as SettingsRow;

    const ins = await supabase.from("user_settings").insert({ user_id: uid });
    if (ins.error) throw ins.error;

    const again = await supabase
      .from("user_settings")
      .select("user_id,default_start_page,theme")
      .eq("user_id", uid)
      .single();

    if (again.error) throw again.error;
    return again.data as SettingsRow;
  }

  async function loadAccount() {
    setStatusAutoClear(null);
    setLoading(true);

    try {
      const supabase = supabaseBrowser();
      const { data, error } = await supabase.auth.getUser();

      if (error || !data?.user) {
        router.replace("/login");
        return;
      }

      const uid = data.user.id;
      const mail = data.user.email ?? "";

      const providerRaw = String(
        (data.user as any)?.app_metadata?.provider ?? ""
      ).trim();
      const provider = providerRaw || "email";
      const providerLabel =
        provider === "email"
          ? "Email"
          : provider === "google"
          ? "Google"
          : provider === "azure"
          ? "Microsoft"
          : provider === "github"
          ? "GitHub"
          : provider.charAt(0).toUpperCase() + provider.slice(1);

      setUserId(uid);
      setEmail(mail);
      setAuthMethod(providerLabel);

      const profile = await ensureProfileRow(supabase, uid, mail);
      const settings = await ensureSettingsRow(supabase, uid);

      try {
        const { data: pbRow, error: pbErr } = await supabase
          .from("workspace_playbooks")
          .select("workspace_id,playbook,version,updated_at,updated_by")
          .eq("workspace_id", uid)
          .maybeSingle();

        if (pbErr) throw pbErr;

        const norm = normalizePlaybook((pbRow as any)?.playbook ?? {});
        const verRaw = Number((pbRow as any)?.version ?? 1);
        const ver =
          Number.isFinite(verRaw) && verRaw > 0 ? Math.round(verRaw) : 1;

        setPlaybookEnabled(true);
        setPlaybook(norm);
        setPlaybookVersion(ver);
        setPlaybookUpdatedAt(
          (pbRow as any)?.updated_at ? String((pbRow as any).updated_at) : null
        );
        setPlaybookInitialFp(fingerprintPlaybook(norm));
        setPlaybookStatus(null);
      } catch (e) {
        const msg = String((e as any)?.message ?? e);
        const looksMissing =
          msg.toLowerCase().includes("workspace_playbooks") &&
          msg.toLowerCase().includes("does not exist");

        setPlaybook({ ...EMPTY_PLAYBOOK });
        setPlaybookVersion(1);
        setPlaybookUpdatedAt(null);
        setPlaybookInitialFp(fingerprintPlaybook(EMPTY_PLAYBOOK));

        if (looksMissing) {
          setPlaybookEnabled(false);
          setPlaybookStatus({ kind: "err", text: "Setup required" });
        } else {
          setPlaybookEnabled(true);
          setPlaybookStatus({ kind: "err", text: "Couldn’t load" });
        }
      }

      const nextFullName = profile.full_name ?? "";
      const nextCompany = profile.company ?? "";
      const nextStart = (settings.default_start_page ?? "upload") as
        | "upload"
        | "jobs";
      const nextTheme = (settings.theme ?? "system") as
        | "system"
        | "light"
        | "dark";

      setFullName(nextFullName);
      setCompany(nextCompany);
      setDefaultStartPage(nextStart);

      setPendingTheme(nextTheme);
      setTheme(nextTheme);

      setInitial({
        fullName: nextFullName.trim(),
        company: nextCompany.trim(),
        defaultStartPage: nextStart,
        theme: nextTheme,
      });

      try {
        const { data: jobs, error: jobsErr } = await supabase
          .from("jobs")
          .select("status")
          .order("created_at", { ascending: false })
          .limit(500);

        if (!jobsErr) {
          const statuses = (jobs as any[]) ?? [];
          const totalJobs = statuses.length;
          const doneJobs = statuses.filter(
            (j) => String((j as any)?.status ?? "") === "done"
          ).length;
          const inProgressJobs = statuses.filter((j) => {
            const s = String((j as any)?.status ?? "");
            return s === "queued" || s === "processing";
          }).length;
          setUsage({ totalJobs, doneJobs, inProgressJobs });
        }
      } catch {
        setUsage(null);
      }
    } catch (e) {
      console.error("Account load failed", e);
      setStatusAutoClear({
        kind: "err",
        text: "Couldn’t load settings. Refresh and try again.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function save() {
    setStatusAutoClear(null);
    setSaving(true);

    try {
      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getUser();
      const u = data?.user;

      if (!u) {
        router.replace("/login");
        return;
      }

      const profileRes = await supabase.from("profiles").upsert(
        {
          id: u.id,
          email: u.email ?? email,
          full_name: normalizedCurrent.fullName ? normalizedCurrent.fullName : null,
          company: normalizedCurrent.company ? normalizedCurrent.company : null,
        },
        { onConflict: "id" }
      );
      if (profileRes.error) throw profileRes.error;

      const settingsRes = await supabase.from("user_settings").upsert(
        {
          user_id: u.id,
          default_start_page: normalizedCurrent.defaultStartPage,
          theme: normalizedCurrent.theme,
        },
        { onConflict: "user_id" }
      );
      if (settingsRes.error) throw settingsRes.error;

      setTheme(normalizedCurrent.theme);
      setInitial({ ...normalizedCurrent });
      setStatusAutoClear({ kind: "ok", text: "Saved" });
    } catch (e) {
      console.error("Account save failed", e);
      setStatusAutoClear({ kind: "err", text: "Couldn’t save. Try again." });
    } finally {
      setSaving(false);
    }
  }

  async function savePlaybook() {
    setPlaybookStatus(null);
    setPlaybookSaving(true);

    try {
      const supabase = supabaseBrowser();
      const { data } = await supabase.auth.getUser();
      const u = data?.user;

      if (!u) {
        router.replace("/login");
        return;
      }

      if (!playbookEnabled) {
        setPlaybookStatus({ kind: "err", text: "Setup required" });
        return;
      }

      const norm = playbookNormalized;
      const nextVersion = Math.max(1, Math.round((playbookVersion ?? 0) + 1));
      const nowIso = new Date().toISOString();

      const { error } = await supabase.from("workspace_playbooks").upsert(
        {
          workspace_id: u.id,
          playbook: norm,
          version: nextVersion,
          updated_at: nowIso,
          updated_by: u.id,
        },
        { onConflict: "workspace_id" }
      );

      if (error) throw error;

      setPlaybookVersion(nextVersion);
      setPlaybookUpdatedAt(nowIso);
      setPlaybookInitialFp(fingerprintPlaybook(norm));
      setPlaybookStatus({ kind: "ok", text: "Saved" });
      window.setTimeout(() => setPlaybookStatus(null), 2200);
      setPlaybookOpen(false);
    } catch (e) {
      console.error("Playbook save failed", e);
      setPlaybookStatus({ kind: "err", text: "Couldn’t save" });
    } finally {
      setPlaybookSaving(false);
    }
  }

  async function signOut() {
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    router.replace("/login");
    router.refresh();
  }

  async function copyUserId() {
    try {
      await navigator.clipboard.writeText(userId);
      setStatusAutoClear({ kind: "ok", text: "Copied" });
    } catch {
      setStatusAutoClear({ kind: "err", text: "Copy failed" });
    }
  }

  const playbookSummary = useMemo(() => {
    const pb = playbookNormalized;
    const modes = pb.delivery_modes.length
      ? pb.delivery_modes.map((m) => (m === "onsite" ? "Onsite" : m === "hybrid" ? "Hybrid" : "Remote"))
      : [];
    const rulesCount = pb.non_negotiables.length;

    return {
      what: pb.offerings_summary || "Add one sentence about what you deliver",
      industries: pb.industry_tags.slice(0, 3),
      regions: pb.delivery_geographies.slice(0, 3),
      modes,
      rulesCount,
    };
  }, [playbookNormalized]);

  if (loading) {
    return <div className="py-16 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Settings</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Profile, workspace, and preferences.
          </p>
        </div>

        <div className="flex items-center gap-2">
          {status ? (
            <Badge
              variant={status.kind === "ok" ? "secondary" : "destructive"}
              className="rounded-full"
            >
              {status.text}
            </Badge>
          ) : null}

          <Button
            onClick={save}
            disabled={saving || !isDirty}
            className="rounded-full"
          >
            {saving ? "Saving…" : "Save changes"}
          </Button>
        </div>
      </div>

      {/* Premium: balanced 3-column grid */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        {/* Column A */}
        <div className="space-y-6 lg:col-span-4">
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle>Profile</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Name</p>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  className="rounded-xl"
                />
                <p className="text-[11px] text-muted-foreground">
                  Used on exports and reports.
                </p>
              </div>

              <Separator />

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Email</p>
                  <p className="text-sm font-medium">{email || "Unknown"}</p>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground">Sign in</p>
                  <p className="text-sm font-medium">{authMethod}</p>
                </div>
              </div>

              <div className="flex items-center justify-between gap-3">
                <Button
                  type="button"
                  variant="outline"
                  className="rounded-full"
                  onClick={() => setShowAdvanced((v) => !v)}
                >
                  {showAdvanced ? "Hide details" : "More"}
                </Button>

                <Button
                  variant="secondary"
                  onClick={signOut}
                  className="rounded-full"
                >
                  Sign out
                </Button>
              </div>

              {showAdvanced ? (
                <div className="rounded-2xl border bg-muted/20 p-4">
                  <div className="space-y-2">
                    <p className="text-xs text-muted-foreground">User ID</p>
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-mono">{shortUserId}</p>
                      <Button
                        type="button"
                        variant="secondary"
                        className="rounded-full h-8 px-3"
                        onClick={copyUserId}
                      >
                        Copy
                      </Button>
                    </div>
                  </div>
                </div>
              ) : null}
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle>Appearance</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {themeMounted ? (
                <SegmentedChoice
                  value={pendingTheme}
                  onChange={setPendingTheme}
                  options={[
                    { value: "system", label: "System" },
                    { value: "light", label: "Light" },
                    { value: "dark", label: "Dark" },
                  ]}
                />
              ) : (
                <div className="h-9 w-[260px] rounded-xl border bg-muted/30" />
              )}

              <p className="text-xs text-muted-foreground">
                Current:{" "}
                <span className="text-foreground capitalize">
                  {pendingTheme}
                </span>
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Column B */}
        <div className="space-y-6 lg:col-span-5">
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle>Workspace</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Workspace name</p>
                <Input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Workspace"
                  className="rounded-xl"
                />
                <p className="text-[11px] text-muted-foreground">
                  Shown on exports and (later) for teams.
                </p>
              </div>

              <Separator />

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Start page</p>
                <SegmentedChoice
                  value={defaultStartPage}
                  onChange={setDefaultStartPage}
                  options={[
                    { value: "upload", label: "New bid" },
                    { value: "jobs", label: "Jobs" },
                  ]}
                />
              </div>

              <Separator />

              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-sm font-medium">Bid Room</p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Track owners, status, and due dates.
                  </p>
                </div>
                <Button asChild variant="outline" className="rounded-full">
                  <Link href="/app/bid-room">Open</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Premium: playbook is a summary card + modal */}
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <CardTitle>Bid Playbook</CardTitle>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Rules that shape Go / Hold / No Go. Not evidence.
                  </p>
                </div>

                <div className="flex items-center gap-2">
                  {!playbookEnabled ? (
                    <Badge variant="destructive" className="rounded-full">
                      Setup required
                    </Badge>
                  ) : (
                    <Badge variant="secondary" className="rounded-full">
                      Policy
                    </Badge>
                  )}

                  <Button
                    type="button"
                    variant="outline"
                    className="rounded-full"
                    onClick={() => setPlaybookOpen(true)}
                  >
                    <Pencil className="h-4 w-4 mr-2" />
                    Edit
                  </Button>
                </div>
              </div>
            </CardHeader>

            <CardContent className="space-y-4">
              {playbookStatus ? (
                <div className="flex items-center justify-end">
                  <Badge
                    variant={
                      playbookStatus.kind === "ok" ? "secondary" : "destructive"
                    }
                    className="rounded-full"
                  >
                    {playbookStatus.text}
                  </Badge>
                </div>
              ) : null}

              <div className="rounded-2xl border bg-muted/10 p-4">
                <p className="text-sm font-medium">What you do</p>
                <p className="mt-1 text-sm text-muted-foreground">
                  {playbookSummary.what}
                </p>

                <div className="mt-4 flex flex-wrap gap-2">
                  {playbookSummary.industries.map((x) => (
                    <MiniChip key={`i:${x}`} text={x} />
                  ))}
                  {playbookSummary.regions.map((x) => (
                    <MiniChip key={`r:${x}`} text={x} />
                  ))}
                  {playbookSummary.modes.map((x) => (
                    <MiniChip key={`m:${x}`} text={x} />
                  ))}
                  <MiniChip
                    text={`${playbookSummary.rulesCount} rule${
                      playbookSummary.rulesCount === 1 ? "" : "s"
                    }`}
                  />
                </div>
              </div>

              <p className="text-[11px] text-muted-foreground">
                If a playbook rule influences a decision, TenderRay will show it
                as a trigger in the cockpit.
              </p>
            </CardContent>
          </Card>
        </div>

        {/* Column C */}
        <div className="space-y-6 lg:col-span-3">
          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle>Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center justify-between gap-3">
                <p className="text-sm">
                  <span className="text-muted-foreground">Current</span>{" "}
                  <span className="font-medium">Free</span>
                </p>
                <Badge variant="secondary" className="rounded-full">
                  Active
                </Badge>
              </div>

              <div className="rounded-2xl border bg-muted/20 p-4">
                <p className="text-xs text-muted-foreground">Usage</p>
                <div className="mt-2 grid grid-cols-3 gap-3">
                  <div>
                    <p className="text-sm font-semibold">
                      {usage ? usage.totalJobs : "–"}
                    </p>
                    <p className="text-xs text-muted-foreground">Tenders</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {usage ? usage.doneJobs : "–"}
                    </p>
                    <p className="text-xs text-muted-foreground">Processed</p>
                  </div>
                  <div>
                    <p className="text-sm font-semibold">
                      {usage ? usage.inProgressJobs : "–"}
                    </p>
                    <p className="text-xs text-muted-foreground">In progress</p>
                  </div>
                </div>
              </div>

              <Button disabled className="rounded-full">
                Manage plan (soon)
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle>Exports</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Export from inside a job to keep everything consistent with
                evidence.
              </p>

              <div className="flex flex-wrap items-center gap-2">
                <Button asChild className="rounded-full">
                  <Link href="/app/jobs">Open jobs</Link>
                </Button>
                <Button asChild variant="outline" className="rounded-full">
                  <Link href="/app/upload">New bid</Link>
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader className="pb-3">
              <CardTitle>Help</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm">
                <Link
                  href="/how-it-works"
                  className="text-foreground underline underline-offset-4"
                >
                  How it works
                </Link>
                <p className="text-xs text-muted-foreground">
                  Quick overview of the workflow.
                </p>
              </div>

              <div className="text-sm">
                <Link
                  href="/privacy"
                  className="text-foreground underline underline-offset-4"
                >
                  Privacy
                </Link>
              </div>

              <div className="text-sm">
                <Link
                  href="/terms"
                  className="text-foreground underline underline-offset-4"
                >
                  Terms
                </Link>
                <p className="text-xs text-muted-foreground">
                  Drafting support only. Always verify against the source.
                </p>
              </div>

              <div className="pt-1">
                <Button disabled variant="secondary" className="rounded-full">
                  Contact support (soon)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {/* Modal */}
      <PlaybookModal
        open={playbookOpen}
        onClose={() => setPlaybookOpen(false)}
        playbookEnabled={playbookEnabled}
        playbookStatus={playbookStatus}
        playbook={playbook}
        setPlaybook={setPlaybook}
        playbookVersion={playbookVersion}
        playbookUpdatedAt={playbookUpdatedAt}
        playbookSaving={playbookSaving}
        playbookIsDirty={playbookIsDirty}
        onSave={savePlaybook}
      />
    </div>
  );
}