import { useState } from "react";
import { C, SANS } from "../../theme";
import type { CalEvent } from "../../types";
import { MATCH_STYLE, S, minsToY, minsToH, minsToLabel } from "./CalendarUtils";

export function CalBlock({ ev, col, selected, onClick, hiddenCount = 0 }: {
  ev: CalEvent; col: "intended" | "actual"; selected: boolean; onClick?: () => void; hiddenCount?: number;
}) {
  const [hov, setHov] = useState(false);
  const ms  = ev.match ? MATCH_STYLE[ev.match] : null;
  const top = minsToY(ev.start);
  const h   = minsToH(ev.start, ev.end);
  const isClickable = col === "actual";
  const bg   = selected ? ev.color + "28" : col === "actual" && ms ? ms.bg   : "rgba(160,120,88,0.10)";
  const bord = selected ? ev.color || C.sienna : col === "actual" && ms ? ms.border : C.border;

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      onClick={isClickable ? onClick : undefined}
      style={{
        position: "absolute", left: 2, right: 2, top, height: h,
        background: hov && isClickable ? ev.color + "22" : bg,
        border: "1px solid " + bord,
        borderLeft: "3px solid " + (col === "actual" ? ev.color || C.sienna : ev.color || C.sand),
        borderRadius: 6, padding: "3px 6px", overflow: "hidden",
        cursor: isClickable ? "pointer" : "default",
        transition: "background 0.15s, border-color 0.15s",
        zIndex: selected ? 20 : hov ? 10 : 1,
        boxShadow: selected
          ? "0 0 0 2px " + (ev.color || C.sienna) + "55, 0 4px 16px rgba(60,50,40,0.14)"
          : hov ? "0 2px 10px rgba(107,94,82,0.14)" : "none",
      }}
    >
    <div style={{ ...S.row, gap: 4, flexWrap: "wrap" }}>
        {col === "actual" && ms && ms.icon()}
        <span style={S.label}>{ev.label}</span>
        
        {/* render the +X pill if there are overlapping shorter sessions */}
        {hiddenCount > 0 && (
          <span style={{
            fontFamily: SANS, fontSize: 9, fontWeight: 600,
            background: "rgba(107,94,82,0.15)", color: C.umber,
            padding: "1px 4px", borderRadius: 4, marginLeft: 2
          }}>
            +{hiddenCount} apps
          </span>
        )}
      </div>
      
      {h > 28 && <div style={S.subLabel}>{minsToLabel(ev.start)} – {minsToLabel(ev.end)}</div>}
    </div>
  );
}

export function IntendedGhost({ ev }: { ev: CalEvent }) {
  const col = ev.color || C.sand;
  return (
    <div style={{
      position: "absolute", left: 2, right: 2,
      top: minsToY(ev.start), height: minsToH(ev.start, ev.end),
      background: col + "0a",
      border: "1px solid " + col + "14",
      borderLeft: "3px solid " + col + "22",
      borderRadius: 6,
      zIndex: 0, pointerEvents: "none",
    }} />
  );
}