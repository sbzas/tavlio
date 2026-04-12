import { useState, useEffect } from "react";
import { C, SANS, SERIF, TOOLTIP_STYLE } from "../theme";
import { Card, CardLabel, EmptyChart } from "../components/Primitives";

import { GetContextSwitchesByHour } from "../../bindings/tavlio/dbase/store";

interface HourlyActivity { Hour: string; ContextSwitches: number; }

export function SwitchHeatmap() {
  const [data, setData]       = useState<HourlyActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [hovIdx, setHovIdx]   = useState<number | null>(null);

  useEffect(() => {
    let isMounted = true;
    const dateISO = new Date().toISOString().slice(0, 10);
    
    GetContextSwitchesByHour(dateISO)
      .then(rows => { if (isMounted) setData(rows ?? []); })
      .catch(() => { if (isMounted) setData([]); })
      .finally(() => { if (isMounted) setLoading(false); });
      
    return () => { isMounted = false; };
  }, []);

  const fullDay = Array.from({ length: 24 }, (_, i) => {
    const hourStr = i.toString().padStart(2, '0') + ":00";
    const found = data.find(d => d.Hour.startsWith(i.toString().padStart(2, '0')));
    return {
      Hour: hourStr,
      ContextSwitches: found ? found.ContextSwitches : 0
    };
  });

  const totalSwitches = fullDay.reduce((s, d) => s + d.ContextSwitches, 0);
  const activeHours   = fullDay.filter(d => d.ContextSwitches > 0).length;
  const avgPerHour    = activeHours > 0 ? Math.round(totalSwitches / activeHours) : null;
  const maxCount      = Math.max(...fullDay.map(d => d.ContextSwitches), 1);

  const isEmpty = !loading && totalSwitches === 0;

  // render an individual block so we don't duplicate code for AM and PM rows
  const renderBlock = (d: { Hour: string; ContextSwitches: number }, absIdx: number) => {
    const intensity = d.ContextSwitches / maxCount;
    const blockColor = d.ContextSwitches === 0 ? "rgba(107,94,82,0.06)" : C.sienna; 
    const blockOpacity = d.ContextSwitches === 0 ? 1 : 0.2 + (intensity * 0.8);
    const isHovered = hovIdx === absIdx;

    return (
      <div 
        key={absIdx}
        style={{ position: "relative" }} // Allows tooltip to anchor directly to this block
        onMouseEnter={() => setHovIdx(absIdx)}
        onMouseLeave={() => setHovIdx(null)}
      >
        <div style={{
          aspectRatio: "1/1",
          borderRadius: 4,
          background: blockColor,
          opacity: blockOpacity,
          cursor: "crosshair",
          transition: "transform 0.1s, opacity 0.2s",
          transform: isHovered ? "scale(1.15)" : "scale(1)",
          border: isHovered ? `1px solid ${C.shadow}` : "1px solid transparent",
          zIndex: isHovered ? 10 : 1,
          position: "relative"
        }} />

        {/* Localized Tooltip positioned directly above the hovered square */}
        {isHovered && (
          <div style={{
            ...TOOLTIP_STYLE,
            position: "absolute",
            bottom: "calc(100% + 8px)", // Push it just above the block
            left: "50%",
            transform: "translateX(-50%)",
            pointerEvents: "none",
            whiteSpace: "nowrap",
            zIndex: 20
          }}>
            <div style={{ color: C.umber, fontSize: 10, marginBottom: 2 }}>
              {d.Hour} - {(absIdx + 1).toString().padStart(2, '0')}:00
            </div>
            <div style={{ color: C.ink, fontWeight: 600 }}>
              {d.ContextSwitches} switches
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Card>
      <CardLabel>Context switches by hour · today</CardLabel>

      {!isEmpty && avgPerHour !== null && (
        <div style={{ marginBottom: 16 }}>
          <span style={{ fontFamily: SERIF, fontSize: 19, color: C.sand }}>{avgPerHour}×</span>
          <span style={{ fontFamily: SANS, fontSize: 11, color: C.umber, marginLeft: 8 }}>avg / active hour</span>
        </div>
      )}

      {loading ? (
        <EmptyChart height={160} message="Loading…" />
      ) : isEmpty ? (
        <EmptyChart height={160} message="No context switches recorded today" />
      ) : (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 8 }}>
          
          {/* AM Row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 18, fontFamily: SANS, fontSize: 9, color: C.umber, textAlign: "right", letterSpacing: "0.05em" }}>
              AM
            </span>
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 6 }}>
              {fullDay.slice(0, 12).map((d, i) => renderBlock(d, i))}
            </div>
          </div>

          {/* PM Row */}
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <span style={{ width: 18, fontFamily: SANS, fontSize: 9, color: C.umber, textAlign: "right", letterSpacing: "0.05em" }}>
              PM
            </span>
            <div style={{ flex: 1, display: "grid", gridTemplateColumns: "repeat(12, 1fr)", gap: 6 }}>
              {fullDay.slice(12, 24).map((d, i) => renderBlock(d, i + 12))}
            </div>
          </div>

        </div>
      )}
    </Card>
  );
}