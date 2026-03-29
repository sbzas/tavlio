// wails go-ts bindings
declare global {
  interface Window {
    go: {
      dbase: {
        Store: {
          GetSessionsForDay(dateISO: string): Promise<GoSession[]>;
          GetSessionSummary(sessionID: number): Promise<string[]>;
          GetRecordingForSession(sessionID: number): Promise<GoRecording | null>;
          GetAllAppsWeeklySummary(): Promise<GoAppWeeklySummary[]>;
          GetDailyFocus(days: number): Promise<GoDailyFocus[]>;
          GetAppUsage(days: number): Promise<GoAppUsage[]>;
          GetContextSwitchesByHour(dateISO: string): Promise<GoHourlyActivity[]>;
          GetWeeklyTotals(year: number): Promise<GoWeeklyTotal[]>;
          GetRecentLogs(limit: number): Promise<GoRecentLog[]>;
        };
      };
    };
  }
}

// Go struct mirrors (field names follow Go's json tag / default PascalCase)
export interface GoSession           { ID: number; AppName: string; StartMins: number; EndMins: number; Match: string; }
export interface GoRecording         { FilePath: string; DurationSeconds: number; CreatedAt: string; KeepForever: boolean; }
export interface GoAppWeeklySummary  { AppID: number; Name: string; WeekMins: number; }
export interface GoDailyFocus        { Day: string; Hours: number; Sessions: number; }
export interface GoAppUsage          { AppID: number; Name: string; Minutes: number; Sessions: number; }
export interface GoHourlyActivity    { Hour: string; Count: number; }
export interface GoWeeklyTotal       { Week: string; Hours: number; }
export interface GoRecentLog         { App: string; Desc: string; Time: string; Status: string; }

// app-level types
export interface AppEntry { name: string; tint: string; weekMins: number; }

export interface CalEvent {
  id: string;
  dbID?: number;
  label: string;
  start: number;  // minutes from midnight
  end: number;
  color: string;
  type: "intended" | "actual";
  app?: string;
  match?: "aligned" | "overran" | "missed" | "unplanned";
}
