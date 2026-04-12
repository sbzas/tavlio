import { useState, useEffect } from "react";
import { C, SANS, SERIF } from "../theme";
import type { AppEntry } from "../types";
import { Card, CardLabel } from "../components/Primitives";

import { GetAppUsage } from "../../bindings/tavlio/dbase/store";

interface AppUsage { AppID: number; Name: string; Minutes: number; Sessions: number; }

function fmt(mins: number) {
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

interface Props { app: AppEntry; }

export function AppPinnedCard({ app }: Props) {
  const [week, setWeek]   = useState<AppUsage | null>(null);
  const [avg,  setAvg]    = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    Promise.all([GetAppUsage(7), GetAppUsage(28)])
      .then(([week7, week28]) => {
        if (!isMounted) return;
        setWeek(week7?.find(a => a.Name === app.name) ?? null);
        const app28 = week28?.find(a => a.Name === app.name);
        setAvg(app28 ? Math.round(app28.Minutes / 4) : null);
      })
      .catch(() => {})
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, [app.name]);

  // +/- vs 4-week per-week avg
  const trendPct = week && avg && avg > 0
    ? Math.round(((week.Minutes - avg) / avg) * 100)
    : null;
  const trendUp  = trendPct !== null && trendPct > 0;
  const trendEq  = trendPct !== null && Math.abs(trendPct) <= 5;

  // Mini comparison bar: this week vs avg, both capped at max
  const maxBar   = Math.max(week?.Minutes ?? 0, avg ?? 0, 1);
  const weekFill = ((week?.Minutes ?? 0) / maxBar);
  const avgFill  = ((avg ?? 0) / maxBar);

  return (
    <Card style={{ 
      borderLeft: `3px solid ${app.tint}`,
      display: "flex", 
      flexDirection: "column", 
    }}>
      <CardLabel>{app.name}</CardLabel>

      {loading ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
          <span style={{ fontFamily: SANS, fontSize: 11, color: C.umber, fontStyle: "italic" }}>Loading…</span>
        </div>
      ) : !week ? (
        <div style={{ flex: 1, display: "flex", alignItems: "center" }}>
          <span style={{ fontFamily: SANS, fontSize: 11, color: C.umber, fontStyle: "italic" }}>No data this week</span>
        </div>
      ) : (
        <>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 10, marginBottom: 10 }}>
              <span style={{ fontFamily: SERIF, fontSize: 22, color: C.shadow, lineHeight: 1 }}>
                {fmt(week.Minutes)}
              </span>
              {trendPct !== null && !trendEq && (
                <span style={{ fontFamily: SANS, fontSize: 10, color: trendUp ? "#7BA05B" : C.rose }}>
                  {trendUp ? "↑" : "↓"} {Math.abs(trendPct)}% vs avg
                </span>
              )}
              {trendEq && (
                <span style={{ fontFamily: SANS, fontSize: 10, color: C.umber }}>≈ avg</span>
              )}
            </div>

            <div style={{ display: "flex", gap: 16, marginBottom: 14 }}>
              <div>
                <div style={{ fontFamily: SANS, fontSize: 9, color: C.umber, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>Sessions</div>
                <div style={{ fontFamily: SERIF, fontSize: 15, color: C.sand }}>{week.Sessions}</div>
              </div>
              {avg !== null && (
                <div>
                  <div style={{ fontFamily: SANS, fontSize: 9, color: C.umber, letterSpacing: "0.08em", textTransform: "uppercase", marginBottom: 2 }}>4-weeks avg</div>
                  <div style={{ fontFamily: SERIF, fontSize: 15, color: C.sand }}>{fmt(avg)}</div>
                </div>
              )}
            </div>
          </div>

          {avg !== null && (
            <div style={{ display: "flex", flexDirection: "column", gap: 5, marginTop: 8 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: SANS, fontSize: 9, color: C.umber, width: 36, flexShrink: 0 }}>This wk</span>
                <div style={{ flex: 1, height: 5, background: "rgba(107,94,82,0.10)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${weekFill * 100}%`, height: "100%", background: app.tint, borderRadius: 3, opacity: 0.8, transition: "width 0.4s" }} />
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ fontFamily: SANS, fontSize: 9, color: C.umber, width: 36, flexShrink: 0 }}>Average</span>
                <div style={{ flex: 1, height: 5, background: "rgba(107,94,82,0.10)", borderRadius: 3, overflow: "hidden" }}>
                  <div style={{ width: `${avgFill * 100}%`, height: "100%", background: C.umber, borderRadius: 3, opacity: 0.45, transition: "width 0.4s" }} />
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </Card>
  );
}