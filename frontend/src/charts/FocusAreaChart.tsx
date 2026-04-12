import { useState, useEffect } from "react";
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { C, CHART_STYLE, AXIS_TICK, GRID_PROPS } from "../theme";
import { Card, CardLabel, StatPill, ChartTooltip, EmptyChart } from "../components/Primitives";

import { GetDailyFocus } from "../../bindings/tavlio/dbase/store";

interface DailyFocus { Day: string; Hours: number; Sessions: number; }

function fmt(mins: number) {
  const h = Math.floor(mins / 60), m = Math.round(mins % 60);
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export function FocusAreaChart() {
  const [data, setData]       = useState<DailyFocus[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    GetDailyFocus(14)
      .then(rows => {
        if (isMounted) setData(rows ?? []);
      })
      .catch(() => {
        if (isMounted) setData([]);
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });

    return () => { isMounted = false; };
  }, []);

  const totalMinsToday = data.length
    ? Math.round((data[data.length - 1]?.Hours ?? 0) * 60)
    : null;
  const weekHours = data.slice(-7).reduce((s, d) => s + d.Hours, 0);
  const weekAvg   = data.slice(-7).length ? (weekHours / 7).toFixed(1) + "h" : null;

  const isEmpty = !loading && data.every(d => d.Hours === 0);

  return (
    <Card wide>
      <CardLabel>Daily focus time · last 14 days</CardLabel>

      {/* Stat pills (only rendered when there's something real to show) */}
      {!isEmpty && (totalMinsToday !== null || weekAvg !== null) && (
        <div style={{ display: "flex", gap: 12, marginBottom: 16, flexWrap: "wrap" }}>
          {totalMinsToday !== null && <StatPill label="Today"    value={fmt(totalMinsToday)} />}
          {weekAvg        !== null && <StatPill label="Week avg" value={weekAvg} />}
        </div>
      )}

      {loading ? (
        <EmptyChart height={160} message="Loading…" />
      ) : isEmpty ? (
        <EmptyChart height={160} message="Start using your computer — data will appear here" />
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <AreaChart data={data} style={CHART_STYLE} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
            <defs>
              <linearGradient id="focusGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor={C.rose}   stopOpacity={0.4}  />
                <stop offset="55%"  stopColor={C.sienna} stopOpacity={0.15} />
                <stop offset="100%" stopColor={C.shadow} stopOpacity={0}    />
              </linearGradient>
            </defs>
            <CartesianGrid {...GRID_PROPS} />
            <XAxis dataKey="Day"   tick={AXIS_TICK} tickLine={false} axisLine={false} interval={2} />
            <YAxis                 tick={AXIS_TICK} tickLine={false} axisLine={false} unit="h" />
            <Tooltip content={<ChartTooltip unit="h" />} cursor={{ stroke: "rgba(107,94,82,0.25)", strokeWidth: 1 }} />
            <Area type="monotone" dataKey="Hours" name="Focus" stroke={C.rose} strokeWidth={1.8} fill="url(#focusGrad)" dot={false} activeDot={{ r: 3, fill: C.shadow }} />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}