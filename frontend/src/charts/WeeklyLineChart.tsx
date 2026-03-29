import { useState, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { C, SANS, CHART_STYLE, AXIS_TICK, GRID_PROPS } from "../theme";
import { Card, CardLabel, ChartTooltip, EmptyChart } from "../components/Primitives";

interface WeekPoint { Week: string; thisYear: number; lastYear: number; }

export function WeeklyLineChart() {
  const [data, setData]       = useState<WeekPoint[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now      = new Date();
    const thisYear = now.getFullYear();
    const lastYear = thisYear - 1;

    import("../../bindings/tavlio/dbase/store")
      .then(m => Promise.all([m.GetWeeklyTotals(thisYear), m.GetWeeklyTotals(lastYear)]))
      .then(([thisRows, lastRows]) => {
        // Merge by week label (both arrays are W1…Wn with the same indexing)
        const merged: WeekPoint[] = (thisRows ?? []).map((t, i) => ({
          Week:     t.Week,
          thisYear: t.Hours,
          lastYear: lastRows?.[i]?.Hours ?? 0,
        }));
        setData(merged);
      })
      .catch(() => setData([]))
      .finally(() => setLoading(false));
  }, []);

  const hasThisYear = data.some(d => d.thisYear > 0);
  const hasLastYear = data.some(d => d.lastYear > 0);
  const isEmpty     = !loading && !hasThisYear && !hasLastYear;

  return (
    <Card wide>
      <CardLabel>Weekly screen time · year over year</CardLabel>

      {loading ? (
        <EmptyChart height={140} message="Loading…" />
      ) : isEmpty ? (
        <EmptyChart height={140} message="Weekly totals will appear after your first full week" />
      ) : (
        <>
          <ResponsiveContainer width="100%" height={140}>
            <LineChart data={data} style={CHART_STYLE} margin={{ top: 4, right: 4, left: -20, bottom: 0 }}>
              <CartesianGrid {...GRID_PROPS} />
              <XAxis dataKey="Week" tick={AXIS_TICK} tickLine={false} axisLine={false} />
              <YAxis tick={AXIS_TICK} tickLine={false} axisLine={false} unit="h" />
              <Tooltip content={<ChartTooltip unit="h" />} cursor={{ stroke: "rgba(107,94,82,0.25)", strokeWidth: 1 }} />
              {hasThisYear && <Line type="monotone" dataKey="thisYear" name="This year" stroke={C.sand}  strokeWidth={1.8} dot={false} activeDot={{ r: 3, fill: C.shadow }} />}
              {hasLastYear && <Line type="monotone" dataKey="lastYear" name="Last year" stroke={C.umber} strokeWidth={1.2} dot={false} strokeDasharray="4 3" activeDot={{ r: 3 }} />}
            </LineChart>
          </ResponsiveContainer>

          <div style={{ display: "flex", gap: 18, marginTop: 10 }}>
            {hasThisYear && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: SANS, fontSize: 10, color: C.umber }}>
                <div style={{ width: 18, height: 1.5, background: C.sand }} /> This year
              </div>
            )}
            {hasLastYear && (
              <div style={{ display: "flex", alignItems: "center", gap: 6, fontFamily: SANS, fontSize: 10, color: C.umber }}>
                <div style={{ width: 18, height: 1.5, background: C.umber }} /> Last year
              </div>
            )}
          </div>
        </>
      )}
    </Card>
  );
}
