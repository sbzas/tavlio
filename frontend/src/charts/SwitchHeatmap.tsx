import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { C, CHART_STYLE, AXIS_TICK, GRID_PROPS } from "../theme";
import { Card, CardLabel, ChartTooltip, EmptyChart } from "../components/Primitives";

interface HourlyActivity { Hour: string; ContextSwitches: number; }

export function SwitchHeatmap() {
  const [data, setData]       = useState<HourlyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovIdx, setHovIdx]   = useState<number | null>(null);

  useEffect(() => {
    const dateISO = new Date().toISOString().slice(0, 10);
    import("../../bindings/tavlio/dbase/store")
      .then(m => m.GetContextSwitchesByHour(dateISO))
      .then(rows => setData(rows ?? []))
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  const totalSwitches = data.reduce((s, d) => s + d.ContextSwitches, 0);
  const activeHours   = data.filter(d => d.ContextSwitches > 0).length;
  const avgPerHour    = activeHours > 0 ? Math.round(totalSwitches / activeHours) : null;
  const maxCount      = Math.max(...data.map(d => d.ContextSwitches), 1);

  const isEmpty = !loading && totalSwitches === 0;

  return (
    <Card>
      <CardLabel>Context switches by hour · today</CardLabel>

      {!isEmpty && avgPerHour !== null && (
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontFamily: "'Playfair Display', Georgia, serif", fontSize: 19, color: C.sand }}>{avgPerHour}×</span>
          <span style={{ fontFamily: "'DM Sans', system-ui, sans-serif", fontSize: 11, color: C.umber, marginLeft: 8 }}>avg / active hour</span>
        </div>
      )}

      {loading ? (
        <EmptyChart height={160} message="Loading…" />
      ) : isEmpty ? (
        <EmptyChart height={160} message="No context switches recorded today" />
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart
            data={data}
            style={CHART_STYLE}
            margin={{ top: 4, right: 4, left: -24, bottom: 0 }}
            onMouseMove={s => setHovIdx(s?.activeTooltipIndex != null ? Number(s.activeTooltipIndex) : null)}
            onMouseLeave={() => setHovIdx(null)}
          >
            <CartesianGrid {...GRID_PROPS} vertical={false} />
            <XAxis dataKey="Hour" tick={AXIS_TICK} tickLine={false} axisLine={false} interval={2} />
            <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <Tooltip content={<ChartTooltip />} cursor={false} />
            <Bar dataKey="ContextSwitches" name="Switches" radius={[3, 3, 0, 0]}>
              {data.map((d, i) => {
                const base = 0.22 + (d.ContextSwitches / maxCount) * 0.78;
                return (
                  <Cell
                    key={i}
                    fill={C.sand}
                    fillOpacity={hovIdx === null ? base : hovIdx === i ? 1 : base * 0.15}
                    style={{ transition: "fill-opacity 0.18s" }}
                  />
                );
              })}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
