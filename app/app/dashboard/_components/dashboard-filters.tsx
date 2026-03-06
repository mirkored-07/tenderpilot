type TranslateFn = (key: string, vars?: Record<string, string | number>) => string;

export function DashboardFilters(props: {
  t: TranslateFn;
  owners: string[];
  ownerFilter: string;
  onOwnerFilterChange: (value: string) => void;
  decisionFilter: string;
  onDecisionFilterChange: (value: string) => void;
  windowDays: number;
  onWindowDaysChange: (value: number) => void;
  filterAllValue: string;
  filterUnassignedValue: string;
}) {
  const {
    t,
    owners,
    ownerFilter,
    onOwnerFilterChange,
    decisionFilter,
    onDecisionFilterChange,
    windowDays,
    onWindowDaysChange,
    filterAllValue,
    filterUnassignedValue,
  } = props;

  return (
    <div className="grid gap-3 md:grid-cols-3">
      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">{t("app.dashboard.filters.owner")}</label>
        <select
          className="h-9 w-full rounded-full border bg-background px-3 text-sm"
          value={ownerFilter}
          onChange={(e) => onOwnerFilterChange(e.target.value)}
        >
          {owners.map((o) => (
            <option key={o} value={o}>
              {o === filterAllValue ? t("app.common.all") : o === filterUnassignedValue ? t("app.dashboard.labels.unassigned") : o}
            </option>
          ))}
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">{t("app.dashboard.filters.decision")}</label>
        <select
          className="h-9 w-full rounded-full border bg-background px-3 text-sm"
          value={decisionFilter}
          onChange={(e) => onDecisionFilterChange(e.target.value)}
        >
          <option value={filterAllValue}>{t("app.common.all")}</option>
          <option value="go">{t("app.decision.go")}</option>
          <option value="hold">{t("app.decision.hold")}</option>
          <option value="no-go">{t("app.decision.noGo")}</option>
          <option value="unknown">{t("app.common.unknown")}</option>
        </select>
      </div>

      <div className="space-y-1.5">
        <label className="text-xs text-muted-foreground">{t("app.dashboard.filters.window")}</label>
        <select
          className="h-9 w-full rounded-full border bg-background px-3 text-sm"
          value={windowDays}
          onChange={(e) => onWindowDaysChange(parseInt(e.target.value, 10))}
        >
          <option value={14}>{t("app.dashboard.filters.next14Days")}</option>
          <option value={30}>{t("app.dashboard.filters.next30Days")}</option>
          <option value={90}>{t("app.dashboard.filters.next90Days")}</option>
        </select>
      </div>
    </div>
  );
}
