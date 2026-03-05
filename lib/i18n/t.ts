function getByPath(obj: any, path: string): any {
  const parts = String(path ?? "").split(".").filter(Boolean);
  let cur: any = obj;
  for (const p of parts) {
    if (!cur || typeof cur !== "object") return undefined;
    cur = cur[p];
  }
  return cur;
}

function interpolate(str: string, vars?: Record<string, string | number>): string {
  if (!vars) return str;
  return str.replace(/\{(\w+)\}/g, (_m, k) => {
    const v = (vars as any)[k];
    return v === undefined || v === null ? "" : String(v);
  });
}

export function tFromDict(args: {
  dict: any;
  fallbackDict?: any;
  key: string;
  vars?: Record<string, string | number>;
}): string {
  const { dict, fallbackDict, key, vars } = args;
  const raw = getByPath(dict, key);
  const fb = fallbackDict ? getByPath(fallbackDict, key) : undefined;
  const val = typeof raw === "string" ? raw : typeof fb === "string" ? fb : "";
  return interpolate(val || key, vars);
}
