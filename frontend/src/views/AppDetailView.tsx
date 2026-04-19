import { useState, useEffect } from "react";
import {
  AreaChart, Area, BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell,
} from "recharts";
import { C, SANS, SERIF, CHART_STYLE, AXIS_TICK, GRID_PROPS } from "../theme";
import type { AppEntry } from "../types";
import { fmt } from "../mockConfig";
import { Card, CardLabel, StatPill, Divider, ChartTooltip, EmptyChart } from "../components/Primitives";
import { I } from "../components/Icons";
import { useWindowWidth } from "../hooks/useWindowWidth";

import { GetDailyFocus, GetContextSwitchesByHour, GetWeeklyTotals } from "../../bindings/tavlio/dbase/store";

interface DailyPoint    { Day: string;  Minutes: number; }
interface HourlyPoint   { Hour: string; Minutes: number; }
interface SessionPoint  { Day: string;  Count: number;   }
interface WeeklyPoint   { Week: string; Hours: number;   }

function AppHourlyChart({ data, tint }: { data: HourlyPoint[]; tint: string }) {
  const [hovIdx, setHovIdx] = useState<number | null>(null);
  const peak = Math.max(...data.map(d => d.Minutes), 1);

  if (data.every(d => d.Minutes === 0)) return <EmptyChart height={150} message="No hourly data yet" />;

  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart
        data={data}
        style={CHART_STYLE}
        margin={{ top: 4, right: 4, left: 2, bottom: 0 }}
        onMouseMove={s => setHovIdx(s?.activeTooltipIndex != null ? Number(s.activeTooltipIndex) : null)}
        onMouseLeave={() => setHovIdx(null)}
      >
        <CartesianGrid {...GRID_PROPS} vertical={false} />
        <XAxis dataKey="Hour" tick={AXIS_TICK} tickLine={false} axisLine={false} interval={3} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} unit="min" width={42} />
        <Tooltip content={<ChartTooltip unit=" min" />} cursor={false} />
        <Bar dataKey="Minutes" name="Active" radius={[3, 3, 0, 0]}>
          {data.map((d, i) => {
            const base = 0.15 + (d.Minutes / peak) * 0.85;
            return (
              <Cell
                key={i}
                fill={tint}
                fillOpacity={hovIdx === null ? base : hovIdx === i ? 1 : base * 0.15}
                style={{ transition: "fill-opacity 0.18s" }}
              />
            );
          })}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

function AppSessionsChart({ data }: { data: SessionPoint[] }) {
  const [hovIdx, setHovIdx] = useState<number | null>(null);

  if (data.every(d => d.Count === 0)) return <EmptyChart height={150} message="No session data yet" />;

  return (
    <ResponsiveContainer width="100%" height={150}>
      <BarChart
        data={data}
        style={CHART_STYLE}
        margin={{ top: 4, right: 8, left: -20, bottom: 0 }}
        onMouseMove={s => setHovIdx(s?.activeTooltipIndex != null ? Number(s.activeTooltipIndex) : null)}
        onMouseLeave={() => setHovIdx(null)}
      >
        <CartesianGrid {...GRID_PROPS} vertical={false} />
        <XAxis dataKey="Day" tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} cursor={false} />
        <Bar dataKey="Count" name="Sessions" radius={[4, 4, 0, 0]}>
          {data.map((_, i) => (
            <Cell
              key={i}
              fill={C.rose}
              fillOpacity={hovIdx === null ? 0.72 : hovIdx === i ? 1 : 0.18}
              style={{ transition: "fill-opacity 0.18s" }}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}

export function AppDetailView({ app, onBack }: { app: AppEntry; onBack: () => void }) {
  const w = useWindowWidth();
  const cols = w < 600 ? 1 : 2;

  const [daily,   setDaily]   = useState<DailyPoint[]>([]);
  const [hourly,  setHourly]  = useState<HourlyPoint[]>([]);
  const [sessions,setSessions]= useState<SessionPoint[]>([]);
  const [weekly,  setWeekly]  = useState<{ thisYear: WeeklyPoint[]; lastYear: WeeklyPoint[] }>({ thisYear: [], lastYear: [] });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const dateISO = new Date().toISOString().slice(0, 10);
    const thisYear = new Date().getFullYear();

      Promise.allSettled([
        GetDailyFocus(14),
        GetContextSwitchesByHour(dateISO),
        // Sessions per weekday and weekly totals aren't scoped to a single app, thus the need for GetDailyFocus
        GetWeeklyTotals(thisYear),
        GetWeeklyTotals(thisYear - 1),
      ])
      .then(([dailyR, hourlyR, weeklyThisR, weeklyLastR]) => {
      if (dailyR.status   === "fulfilled") setDaily(
        (dailyR.value ?? []).map(d => ({ Day: d.Day, Minutes: Math.round(d.Hours * 60) }))
      );
      if (hourlyR.status  === "fulfilled") setHourly(
        (hourlyR.value ?? []).map(h => ({ Hour: h.Hour, Minutes: h.ContextSwitches }))
      );
      if (weeklyThisR.status === "fulfilled" && weeklyLastR.status === "fulfilled") {
        setWeekly({
          thisYear: weeklyThisR.value ?? [],
          lastYear: weeklyLastR.value ?? [],
        });
      }
      // Sessions-per-weekday placeholder until app-scoped endpoint exists
      setSessions(["Mon","Tue","Wed","Thu","Fri","Sat","Sun"].map(day => ({ Day: day, Count: 0 })));
    }).catch(() => {
      // Keep all states at their empty defaults.
    }).finally(() => setLoading(false));
  }, [app.name]);

  const weeklyMerged = weekly.thisYear.map((t, i) => ({
    Week:     t.Week,
    thisYear: t.Hours,
    lastYear: weekly.lastYear[i]?.Hours ?? 0,
  }));

  const hasDaily   = daily.some(d => d.Minutes > 0);
  const hasWeekly  = weeklyMerged.some(d => d.thisYear > 0 || d.lastYear > 0);

  return (
    <div style={{ paddingBottom: 90 }}>
      {/* Back button + app header */}
      <div style={{ display: "flex", alignItems: "center", gap: 14, marginBottom: 26 }}>
        <button
          onClick={onBack}
          style={{ background: "rgba(107,94,82,0.10)", border: "1px solid " + C.border, borderRadius: 8, padding: "7px 12px", color: C.umber, fontSize: 12, cursor: "pointer", fontFamily: SANS, display: "flex", alignItems: "center", gap: 6 }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = C.shadow; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = C.umber; }}
        >
          {I.arrowL(13)} Archives
        </button>

        <div style={{ width: 1, height: 20, background: C.border }} />

        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
          <div style={{ width: 32, height: 32, borderRadius: 9, background: app.tint + "22", border: "1px solid " + app.tint + "44", display: "flex", alignItems: "center", justifyContent: "center" }}>
            <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 14, color: app.tint }}>{app.name[0]}</span>
          </div>
          <div>
            <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 20, color: C.shadow, lineHeight: 1 }}>{app.name}</div>
            <div style={{ fontFamily: SANS, fontSize: 9, color: C.umber, letterSpacing: "0.1em", textTransform: "uppercase", marginTop: 3 }}>{fmt(app.weekMins)} this week</div>
          </div>
        </div>
      </div>

      <Divider />

      {/* Only show stat pills when there's real data */}
      {!loading && app.weekMins > 0 && (
        <div style={{ display: "flex", gap: 10, marginBottom: 20, flexWrap: "wrap" }}>
          <StatPill label="Week total" value={fmt(app.weekMins)} />
        </div>
      )}

      {/* Charts */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(" + cols + ", 1fr)", gap: 14 }}>
        {/* Daily usage */}
        <Card wide>
          <CardLabel>Daily usage · last 14 days</CardLabel>
          {loading ? (
            <EmptyChart height={150} message="Loading…" />
          ) : !hasDaily ? (
            <EmptyChart height={150} message="No usage data yet" />
          ) : (
            <ResponsiveContainer width="100%" height={150}>
              <AreaChart data={daily} style={CHART_STYLE} margin={{ top: 4, right: 4, left: 2, bottom: 0 }}>
                <defs>
                  <linearGradient id="appDailyGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%"   stopColor={app.tint} stopOpacity={0.35} />
                    <stop offset="100%" stopColor={app.tint} stopOpacity={0}    />
                  </linearGradient>
                </defs>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="Day"     tick={AXIS_TICK} tickLine={false} axisLine={false} interval={2} />
                <YAxis                   tick={AXIS_TICK} tickLine={false} axisLine={false} unit="min" width={42} />
                <Tooltip content={<ChartTooltip unit=" min" />} cursor={{ stroke: "rgba(107,94,82,0.25)", strokeWidth: 1 }} />
                <Area type="monotone" dataKey="Minutes" name="Time" stroke={app.tint} strokeWidth={1.8} fill="url(#appDailyGrad)" dot={false} activeDot={{ r: 3, fill: C.shadow }} />
              </AreaChart>
            </ResponsiveContainer>
          )}
        </Card>

        {/* Hourly */}
        <Card>
          <CardLabel>Usage by hour of day</CardLabel>
          {loading ? <EmptyChart height={150} message="Loading…" /> : <AppHourlyChart data={hourly} tint={app.tint} />}
        </Card>

        {/* Sessions per day */}
        <Card>
          <CardLabel>Sessions per day of week</CardLabel>
          {loading ? <EmptyChart height={150} message="Loading…" /> : <AppSessionsChart data={sessions} />}
        </Card>

        {/* Year-over-year */}
        <Card>
          <CardLabel>Weekly total · year over year</CardLabel>
          {loading ? (
            <EmptyChart height={150} message="Loading…" />
          ) : !hasWeekly ? (
            <EmptyChart height={150} message="Not enough history yet" />
          ) : (
            <ResponsiveContainer width="100%" height={150}>
              <LineChart data={weeklyMerged} style={CHART_STYLE} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
                <CartesianGrid {...GRID_PROPS} />
                <XAxis dataKey="Week" tick={AXIS_TICK} tickLine={false} axisLine={false} />
                <YAxis                tick={AXIS_TICK} tickLine={false} axisLine={false} unit="h" />
                <Tooltip content={<ChartTooltip unit="h" />} cursor={{ stroke: "rgba(107,94,82,0.25)", strokeWidth: 1 }} />
                <Line type="monotone" dataKey="thisYear" name="This year" stroke={app.tint} strokeWidth={1.8} dot={false} activeDot={{ r: 3 }} />
                <Line type="monotone" dataKey="lastYear" name="Last year" stroke={C.umber} strokeWidth={1.2} dot={false} strokeDasharray="4 3" />
              </LineChart>
            </ResponsiveContainer>
          )}
        </Card>
      </div>

      <div style={{ marginTop: 16, fontFamily: SANS, fontSize: 10, color: C.umber, textAlign: "center", letterSpacing: "0.06em" }}>
        These charts are read-only · go to Dashboard to customise your view
      </div>
    </div>
  );
}
