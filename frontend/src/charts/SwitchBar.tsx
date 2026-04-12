import { useState, useEffect } from "react";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { C, SANS, SERIF, CHART_STYLE, AXIS_TICK } from "../theme";
import { Card, CardLabel, ChartTooltip, EmptyChart } from "../components/Primitives";

import { GetAppUsage } from "../../bindings/tavlio/dbase/store";

interface AppUsage { AppID: number; Name: string; Minutes: number; Sessions: number; }

export function SwitchesBarChart() {
  const [data, setData]       = useState<AppUsage[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovIdx, setHovIdx]   = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    
    GetAppUsage(7)
      .then(rows => {
        if (!isMounted) return;
        const validRows = rows ?? [];
        const sortedBySessions = validRows.sort((a, b) => b.Sessions - a.Sessions).slice(0, 6);
        setData(sortedBySessions);
      })
      .catch(() => { if (isMounted) setData([]); })
      .finally(() => { if (isMounted) setLoading(false); });
      
    return () => { isMounted = false; };
  }, []);

  const topApp = data[0];
  const isEmpty = !loading && data.length === 0;

  return (
    <Card>
      <CardLabel>Most frequent interruptions · this week</CardLabel>

      {!isEmpty && topApp && (
        <div style={{ marginBottom: 12 }}>
          <span style={{ fontFamily: SERIF, fontSize: 19, color: C.sand }}>{topApp.Name}</span>
          <span style={{ fontFamily: SANS, fontSize: 11, color: C.umber, marginLeft: 8 }}>
            {topApp.Sessions} opens
          </span>
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
            <XAxis type="number" tick={AXIS_TICK} tickLine={false} axisLine={false} />
            <YAxis type="category" dataKey="Name" tick={AXIS_TICK} tickLine={false} axisLine={false} width={58} />
            
            {/* Pass a custom unit to the tooltip */}
            <Tooltip content={<ChartTooltip unit=" opens" />} cursor={false} />

            <Bar dataKey="Sessions" name="Opens" radius={[0, 4, 4, 0]}>
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