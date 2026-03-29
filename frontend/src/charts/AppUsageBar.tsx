import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { C, SANS, SERIF, CHART_STYLE, AXIS_TICK } from "../theme";
import { Card, CardLabel, ChartTooltip, EmptyChart } from "../components/Primitives";

interface AppUsage { AppID: number; Name: string; Minutes: number; Sessions: number; }

export function AppUsageBar() {
  const [data, setData]       = useState<AppUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovIdx, setHovIdx]   = useState<number | null>(null);

  useEffect(() => {
    import("../../bindings/tavlio/dbase/store")
      .then(m => m.GetAppUsage(7))
      .then(rows => setData((rows ?? []).slice(0, 6)))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  const topApp = data[0];
  const total  = data.reduce((s, d) => s + d.Minutes, 0);
  const topPct = topApp && total ? Math.round((topApp.Minutes / total) * 100) : null;

  const isEmpty = !loading && data.length === 0;

  return (
    <Card>
      <CardLabel>Top apps this week</CardLabel>

      {!isEmpty && topApp && (
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontFamily: SERIF, fontSize: 19, color: C.sand }}>{topApp.Name}</span>
          {topPct !== null && (
            <span style={{ fontFamily: SANS, fontSize: 11, color: C.umber, marginLeft: 8 }}>{topPct}% of screen time</span>
          )}
        </div>
      )}

      {loading ? (
        <EmptyChart height={160} message="Loading…" />
      ) : isEmpty ? (
        <EmptyChart height={160} message="No app usage recorded yet" />
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart
            data={data}
            layout="vertical"
            style={CHART_STYLE}
            margin={{ top: 0, right: 8, left: 0, bottom: 0 }}
            onMouseMove={s => setHovIdx(s?.activeTooltipIndex != null ? Number(s.activeTooltipIndex) : null)}
            onMouseLeave={() => setHovIdx(null)}
          >
            <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} unit="m" />
            <YAxis type="category" dataKey="Name" tick={AXIS_TICK} tickLine={false} axisLine={false} width={58} />
            <Tooltip content={<ChartTooltip unit=" min" />} cursor={false} />
            <Bar dataKey="Minutes" name="Time" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => (
                <Cell
                  key={i}
                  fill={i % 2 === 0 ? C.sienna : C.rose}
                  fillOpacity={hovIdx === null ? 0.7 - i * 0.08 : hovIdx === i ? 1 : 0.14}
                  style={{ transition: "fill-opacity 0.18s" }}
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
