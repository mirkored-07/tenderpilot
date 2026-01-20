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

type ProfileRow = {
  id: string;
  email: string | null;
  full_name: string | null;
  company: string | null;
};

type SettingsRow = {
  user_id: string;
  default_start_page: "upload" | "jobs" | null;
  ui_density: "comfortable" | "compact" | null;
  theme: "system" | "light" | "dark" | null;
};

type InitialSnapshot = {
  fullName: string;
  company: string;
  defaultStartPage: "upload" | "jobs";
  uiDensity: "comfortable" | "compact";
  theme: "system" | "light" | "dark";
};

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div>
      <p className="text-sm font-medium leading-none">{title}</p>
      {subtitle ? (
        <p className="mt-1 text-xs text-muted-foreground">{subtitle}</p>
      ) : null}
    </div>
  );
}

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

export default function AccountPage() {
  const router = useRouter();

  // next-themes: stage changes, apply only on Save
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

  const [fullName, setFullName] = useState("");
  const [company, setCompany] = useState("");

  const [defaultStartPage, setDefaultStartPage] = useState<"upload" | "jobs">(
    "upload"
  );
  const [uiDensity, setUiDensity] = useState<"comfortable" | "compact">(
    "comfortable"
  );

  const [initial, setInitial] = useState<InitialSnapshot | null>(null);

  const [status, setStatus] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null
  );
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
      uiDensity,
      theme: pendingTheme,
    };
    return snap;
  }, [fullName, company, defaultStartPage, uiDensity, pendingTheme]);

  const isDirty = useMemo(() => {
    if (!initial) return false;
    return (
      normalizedCurrent.fullName !== initial.fullName ||
      normalizedCurrent.company !== initial.company ||
      normalizedCurrent.defaultStartPage !== initial.defaultStartPage ||
      normalizedCurrent.uiDensity !== initial.uiDensity ||
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
      }, 2500);
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
      .select("user_id,default_start_page,ui_density,theme")
      .eq("user_id", uid)
      .maybeSingle();

    if (!error && data) return data as SettingsRow;

    const ins = await supabase.from("user_settings").insert({ user_id: uid });
    if (ins.error) throw ins.error;

    const again = await supabase
      .from("user_settings")
      .select("user_id,default_start_page,ui_density,theme")
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

      setUserId(uid);
      setEmail(mail);

      const profile = await ensureProfileRow(supabase, uid, mail);
      const settings = await ensureSettingsRow(supabase, uid);

      const nextFullName = profile.full_name ?? "";
      const nextCompany = profile.company ?? "";
      const nextStart = (settings.default_start_page ?? "upload") as "upload" | "jobs";
      const nextDensity = (settings.ui_density ?? "comfortable") as
        | "comfortable"
        | "compact";
      const nextTheme = (settings.theme ?? "system") as "system" | "light" | "dark";

      setFullName(nextFullName);
      setCompany(nextCompany);
      setDefaultStartPage(nextStart);
      setUiDensity(nextDensity);

      // stage theme + apply stored theme on load
      setPendingTheme(nextTheme);
      setTheme(nextTheme);

      setInitial({
        fullName: nextFullName.trim(),
        company: nextCompany.trim(),
        defaultStartPage: nextStart,
        uiDensity: nextDensity,
        theme: nextTheme,
      });
    } catch (e) {
      console.error("Account load failed", e);
      setStatusAutoClear({
        kind: "err",
        text: "Account data could not be loaded. Please refresh the page.",
      });
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadAccount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // instant UI feedback for density (still saved on Save)
  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.classList.toggle(
      "tp-density-compact",
      uiDensity === "compact"
    );
  }, [uiDensity]);

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
          ui_density: normalizedCurrent.uiDensity,
          theme: normalizedCurrent.theme,
        },
        { onConflict: "user_id" }
      );
      if (settingsRes.error) throw settingsRes.error;

      // Apply theme ONLY after successful save
      setTheme(normalizedCurrent.theme);

      setInitial({ ...normalizedCurrent });
      setStatusAutoClear({ kind: "ok", text: "Saved" });
    } catch (e) {
      console.error("Account save failed", e);
      setStatusAutoClear({ kind: "err", text: "Save failed. Please try again." });
    } finally {
      setSaving(false);
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

  if (loading) {
    return <div className="py-16 text-sm text-muted-foreground">Loading…</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Account</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Manage your profile, preferences, and security.
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
            {saving ? "Saving…" : "Save"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <Card className="rounded-2xl">
          <CardHeader>
            <CardTitle>Your account</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-1">
              <p className="text-xs text-muted-foreground">Email</p>
              <p className="text-sm font-medium">{email || "Unknown"}</p>
            </div>

            <Separator />

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

            <Separator />

            <div className="space-y-3">
              <SectionTitle
                title="Profile"
                subtitle="Used for internal labeling and future exports."
              />

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Full name</p>
                <Input
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Your name"
                  className="rounded-xl"
                />
              </div>

              <div className="space-y-2">
                <p className="text-xs text-muted-foreground">Company</p>
                <Input
                  value={company}
                  onChange={(e) => setCompany(e.target.value)}
                  placeholder="Company"
                  className="rounded-xl"
                />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-6">
          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Preferences</CardTitle>
            </CardHeader>
            <CardContent className="space-y-5">
              <div className="space-y-2">
                <SectionTitle
                  title="Appearance"
                  subtitle="Choose light, dark, or follow your system setting."
                />

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
                  Selected: <span className="text-foreground">{pendingTheme}</span>
                </p>
              </div>

              <div className="space-y-2">
                <SectionTitle
                  title="Default start page"
                  subtitle="Choose where you land after login."
                />
                <SegmentedChoice
                  value={defaultStartPage}
                  onChange={setDefaultStartPage}
                  options={[
                    { value: "upload", label: "Upload" },
                    { value: "jobs", label: "Jobs" },
                  ]}
                />
              </div>

              <div className="space-y-2">
                <SectionTitle
                  title="UI density"
                  subtitle="Compact shows more content per screen."
                />
                <SegmentedChoice
                  value={uiDensity}
                  onChange={setUiDensity}
                  options={[
                    { value: "comfortable", label: "Comfortable" },
                    { value: "compact", label: "Compact" },
                  ]}
                />
              </div>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Plan</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-sm">
                Plan: <span className="font-medium">Free</span>
              </p>
              <p className="text-xs text-muted-foreground">
                Billing and subscription management are coming soon.
              </p>
              <Button disabled className="rounded-full">
                Manage subscription
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Security</CardTitle>
            </CardHeader>
            <CardContent className="flex items-center justify-between gap-4">
              <p className="text-sm text-muted-foreground">Sign out on this device.</p>
              <Button
                variant="secondary"
                onClick={signOut}
                className="rounded-full"
              >
                Sign out
              </Button>
            </CardContent>
          </Card>

          <Card className="rounded-2xl">
            <CardHeader>
              <CardTitle>Support and legal</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="text-sm">
                <Link
                  href="/privacy"
                  className="text-foreground underline underline-offset-4"
                >
                  Privacy policy
                </Link>
                <p className="text-xs text-muted-foreground">Read how data is handled.</p>
              </div>

              <div className="text-sm">
                <Link
                  href="/terms"
                  className="text-foreground underline underline-offset-4"
                >
                  Terms of service
                </Link>
                <p className="text-xs text-muted-foreground">
                  Drafting support, not advice.
                </p>
              </div>

              <div className="pt-1">
                <Button disabled variant="secondary" className="rounded-full">
                  Contact support (coming soon)
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
