import { useState, useEffect } from "react";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer } from "recharts";
import { C, SANS, SERIF, TOOLTIP_STYLE } from "../theme";
import { Card, CardLabel, EmptyChart } from "../components/Primitives";

import { GetAppUsage } from "../../bindings/tavlio/dbase/store";

interface AppUsage { AppID: number; Name: string; Minutes: number; Sessions: number; }

const SLICE_COLORS = [C.sienna, C.rose, C.sand, "#4A8FC9", "#4CAF7A", "#9B59B6"];

function PieTooltip({ active, payload }: { active?: boolean; payload?: any[] }) {
  if (!active || !payload?.length) return null;
  
  const p = payload[0];
  const dataNode = p.payload;
  
  // cap the breakdown so the tooltip doesn't get massively tall
  const subApps = dataNode.subApps || [];
  const displaySubs = subApps.slice(0, 5);
  const hiddenCount = subApps.length - 5;

  return (
    <div style={{ ...TOOLTIP_STYLE, minWidth: 120 }}>
      <div style={{ color: C.umber, fontSize: 10, marginBottom: 2 }}>{p.name}</div>
      <div style={{ color: C.ink }}>
        <strong>{Math.floor(p.value / 60)}h {Math.round(p.value % 60)}m</strong>
        <span style={{ color: C.umber, marginLeft: 6 }}>{dataNode.pct}%</span>
      </div>

      {/* Render the sub-apps if this is the "Other" category */}
      {subApps.length > 0 && (
        <div style={{ marginTop: 8, paddingTop: 8, borderTop: `1px solid ${C.border || 'rgba(107,94,82,0.2)'}` }}>
          <div style={{ fontSize: 9, color: C.umber, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.05em" }}>
            Includes:
          </div>
          
          <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
            {displaySubs.map((sub: AppUsage, idx: number) => (
              <div key={idx} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 10 }}>
                <span style={{ color: C.ink, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: 90 }}>
                  {sub.Name}
                </span>
                <span style={{ color: C.umber, marginLeft: 12, flexShrink: 0 }}>
                  {Math.floor(sub.Minutes / 60) > 0 ? `${Math.floor(sub.Minutes / 60)}h ` : ''}{Math.round(sub.Minutes % 60)}m
                </span>
              </div>
            ))}
            
            {hiddenCount > 0 && (
              <div style={{ fontSize: 9.5, color: C.sienna, fontStyle: "italic", marginTop: 2 }}>
                + {hiddenCount} more
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export function AppSharePie() {
  const [data, setData]       = useState<AppUsage[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    
    GetAppUsage(7)
      .then(rows => { if (isMounted) setData(rows ?? []); })
      .catch(() => { if (isMounted) setData([]); })
      .finally(() => { if (isMounted) setLoading(false); });
      
    return () => { isMounted = false; };
  }, []);

  const total = data.reduce((s, d) => s + d.Minutes, 0);
  const isEmpty = !loading && total === 0;

  // aggregate data
  let pieData: any[] = [];
  
  if (total > 0) {
    const sorted = [...data].sort((a, b) => b.Minutes - a.Minutes);
    
    if (sorted.length <= 6) {
      pieData = sorted.map(d => ({
        name: d.Name,
        value: d.Minutes,
        pct: Math.round((d.Minutes / total) * 100),
      }));
    } else {
      const top5 = sorted.slice(0, 5);
      const otherApps = sorted.slice(5); // Keep the raw data for the tooltip
      const otherTotalMins = otherApps.reduce((sum, d) => sum + d.Minutes, 0);
      
      pieData = [
        ...top5.map(d => ({
          name: d.Name,
          value: d.Minutes,
          pct: Math.round((d.Minutes / total) * 100),
        })),
        {
          name: "Other",
          value: otherTotalMins,
          pct: Math.round((otherTotalMins / total) * 100),
          subApps: otherApps // pass remaining apps!!
        }
      ];
    }
  }

  return (
    <Card>
      <CardLabel>Screen time share · this week</CardLabel>

      {!isEmpty && pieData[0] && (
        <div style={{ marginBottom: 4 }}>
          <span style={{ fontFamily: SERIF, fontSize: 19, color: C.sand }}>{pieData[0].name}</span>
          <span style={{ fontFamily: SANS, fontSize: 11, color: C.umber, marginLeft: 8 }}>leading at {pieData[0].pct}%</span>
        </div>
      )}

      {loading ? (
        <EmptyChart height={180} message="Loading…" />
      ) : isEmpty ? (
        <EmptyChart height={180} message="No app usage recorded yet" />
      ) : (
        <ResponsiveContainer width="100%" height={180}>
          <PieChart>
            <Pie
              data={pieData}
              cx="50%"
              cy="50%"
              innerRadius={55}
              outerRadius={80}
              dataKey="value"
              strokeWidth={0}
              paddingAngle={2}
            >
              {pieData.map((_, i) => (
                <Cell key={`cell-${i}`} fill={SLICE_COLORS[i % SLICE_COLORS.length]} fillOpacity={0.85 - i * 0.05} />
              ))}
            </Pie>
            {/* custom tooltip  automatically receives subApps data */}
            <Tooltip content={<PieTooltip />} />
          </PieChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}