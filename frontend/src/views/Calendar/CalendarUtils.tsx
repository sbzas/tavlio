import { C, SANS } from "../../theme";
import { I } from "../../components/Icons";
import type { CalEvent } from "../../types";

export const ALL_HOURS = Array.from({ length: 24 }, (_, i) => i); // 00:00–23:00
export const HOUR_H    = 52;
export const GRID_H    = 514; // px — visible window (~9.9 h); inner content scrolls
export const TOTAL_H   = 24 * HOUR_H; // 1248 px — full day canvas

export const S = {
  row:       { display: "flex", alignItems: "center" } as React.CSSProperties,
  col:       { display: "flex", flexDirection: "column" } as React.CSSProperties,
  centered:  { display: "flex", alignItems: "center", justifyContent: "center" } as React.CSSProperties,
  label:     { fontFamily: SANS, fontSize: 10, fontWeight: 500, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" } as React.CSSProperties,
  subLabel:  { fontFamily: SANS, fontSize: 9, color: C.umber, marginTop: 1 } as React.CSSProperties,
  capsLabel: { fontFamily: SANS, fontSize: 9, color: C.sienna, letterSpacing: "0.1em", textTransform: "uppercase" } as React.CSSProperties,
  bodyText:  { fontFamily: SANS, fontSize: 11, color: C.umber, fontStyle: "italic" } as React.CSSProperties,
  hrLine:    { position: "absolute", left: 0, right: 0, height: 1, background: "rgba(107,94,82,0.08)" } as React.CSSProperties,
  navBtn:    { background: "rgba(107,94,82,0.10)", border: "1px solid " + C.border, borderRadius: 7, width: 30, height: 30, display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", color: C.umber } as React.CSSProperties,
  banner:    { background: "rgba(140,110,94,0.09)", border: "1px solid rgba(140,110,94,0.25)", borderRadius: 10, padding: "10px 16px", marginBottom: 16, display: "flex", alignItems: "center", gap: 12 } as React.CSSProperties,
  connectBtn:{ fontFamily: SANS, fontSize: 11, background: C.sienna, border: "none", borderRadius: 7, padding: "5px 12px", color: C.highlight, cursor: "pointer", whiteSpace: "nowrap" } as React.CSSProperties,
  card:      { border: "1px solid " + C.border, borderRadius: 12, overflow: "hidden", background: C.surface } as React.CSSProperties,
};

export const MATCH_STYLE: Record<string, { bg: string; border: string; label: string; icon: () => React.ReactElement }> = {
  aligned:   { bg: "rgba(123,160,91,0.12)",  border: "rgba(123,160,91,0.5)",   label: "aligned",   icon: () => <span style={{ color: "#7BA05B", display: "flex" }}>{I.check(10)}</span>   },
  overran:   { bg: "rgba(196,150,122,0.15)", border: "rgba(196,150,122,0.55)", label: "overran",   icon: () => <span style={{ color: C.rose,    display: "flex" }}>{I.warning(10)}</span> },
  unplanned: { bg: "rgba(155,89,182,0.12)",  border: "rgba(155,89,182,0.45)", label: "unplanned", icon: () => <span style={{ color: "#9B59B6", display: "flex" }}>{I.x(10)}</span>       },
  missed:    { bg: "rgba(107,94,82,0.06)",   border: "rgba(107,94,82,0.25)",  label: "missed",    icon: () => <span style={{ color: C.umber,   display: "flex" }}>{I.x(10)}</span>       },
};

export function minsToY(mins: number) { return (mins / 60) * HOUR_H; }
export function minsToH(start: number, end: number) { return Math.max(((end - start) / 60) * HOUR_H, 18); }
export function minsToLabel(mins: number) {
  const h = Math.floor(mins / 60), m = mins % 60;
  return `${h % 12 === 0 ? 12 : h % 12}:${m.toString().padStart(2, "0")} ${h < 12 ? "am" : "pm"}`;
}

export function groupOverlappingSessions(sessions: CalEvent[]): CalEvent[][] {
  if (sessions.length === 0) return [];

  // Sort primarily by start time, longer sessions first so that cal blocks have the proper size
  const sorted = [...sessions].sort((a, b) => {
    if (a.start === b.start) {
      return (b.end - b.start) - (a.end - a.start);
    }
    return a.start - b.start;
  });

  const groups: CalEvent[][] = [];
  let currentGroup: CalEvent[] = [sorted[0]];
  let groupEnd = sorted[0].end;

  for (let i = 1; i < sorted.length; i++) {
    const ev = sorted[i];
    if (ev.start < groupEnd) {
      currentGroup.push(ev);
      // Extend the group's bounding box if this overlapping event stretches further
      groupEnd = Math.max(groupEnd, ev.end); 
    } else {
      // no overlap
      groups.push(currentGroup);
      currentGroup = [ev];
      groupEnd = ev.end;
    }
  }
  groups.push(currentGroup);

  return groups;
}