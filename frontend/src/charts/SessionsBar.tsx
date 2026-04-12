import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Cell } from "recharts";
import { C, SERIF, SANS, CHART_STYLE, AXIS_TICK, GRID_PROPS } from "../theme";
import { Card, CardLabel, ChartTooltip, EmptyChart } from "../components/Primitives";

import { GetDailyFocus } from "../../bindings/tavlio/dbase/store";

interface DailyFocus { Day: string; Hours: number; Sessions: number; }

export function SessionsChart() {
  const [data, setData]       = useState<DailyFocus[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovIdx, setHovIdx]   = useState<number | null>(null);

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

    // Cleanup function runs if the component unmounts before the promise resolves
    return () => { isMounted = false; };
  }, []);

  const peak       = Math.max(...data.map(d => d.Sessions), 1);
  const weekTotal  = data.slice(-7).reduce((s, d) => s + d.Sessions, 0);
  const bestDay    = data.slice(-7).reduce((b, d) => d.Sessions > b.Sessions ? d : b, { Day: "", Sessions: 0 });
  const isEmpty    = !loading && data.every(d => d.Sessions === 0);

  return (
    <Card>
      <CardLabel>Daily sessions · last 14 days</CardLabel>

      {!isEmpty && weekTotal > 0 && (
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontFamily: SERIF, fontSize: 19, color: C.sand }}>{weekTotal}</span>
          <span style={{ fontFamily: SANS, fontSize: 11, color: C.umber, marginLeft: 8 }}>
            sessions this week{bestDay.Sessions > 0 ? ` · peak ${bestDay.Sessions} sessions on ${bestDay.Day}` : ""}
          </span>
        </div>
      )}

      {loading ? (
        <EmptyChart height={160} message="Loading…" />
      ) : isEmpty ? (
        <EmptyChart height={160} message="No sessions recorded yet" />
      ) : (
        <ResponsiveContainer width="100%" height={160}>
          <BarChart
            data={data}
            style={CHART_STYLE}
            margin={{ top: 4, right: 4, left: -20, bottom: 0 }}
            onMouseMove={s => setHovIdx(s?.activeTooltipIndex != null ? Number(s.activeTooltipIndex) : null)}
            onMouseLeave={() => setHovIdx(null)}
          >
            <CartesianGrid {...GRID_PROPS} vertical={false} />
            <XAxis dataKey="Day"      tick={AXIS_TICK} tickLine={false} axisLine={false} interval={2} />
            <YAxis                    tick={AXIS_TICK} tickLine={false} axisLine={false} allowDecimals={false} />
            <Tooltip content={<ChartTooltip />} cursor={false} />
            <Bar dataKey="Sessions" name="Sessions" radius={[3, 3, 0, 0]}>
              {data.map((d, i) => {
                const base = 0.18 + (d.Sessions / peak) * 0.82;
                return (
                  <Cell
                    key={i}
                    fill={C.rose}
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