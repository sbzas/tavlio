import type { AppEntry } from "../../types";

export type BuiltinId = "focus" | "apps" | "switches" | "weekly" | "logs" | "sessions" | "share";

export interface DashState { 
  builtins: BuiltinId[]; 
  pinnedApps: AppEntry[]; 
}

export const BUILTIN_DEFS: { id: BuiltinId; label: string; desc: string }[] = [
  { id: "focus",    label: "Daily focus time",   desc: "Focus hours over the last 14 days" },
  { id: "apps",     label: "Top apps",           desc: "Most-used applications this week" },
  { id: "switches", label: "Context switches",   desc: "App-switching frequency by hour today" },
  { id: "weekly",   label: "Year over year",     desc: "Weekly screen time vs last year" },
  { id: "logs",     label: "Recent snapshots",   desc: "Latest context log entries" },
  { id: "sessions", label: "Daily sessions",     desc: "Number of tracked sessions per day" },
  { id: "share",    label: "Screen time share",  desc: "Distribution of time across top apps" },
];

export const DEFAULT_BUILTINS: BuiltinId[] = ["focus", "apps", "switches", "weekly", "logs"];