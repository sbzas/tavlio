import { useState } from "react";
import { C, SANS, TOOLTIP_STYLE } from "../theme";

export function Card({ children, wide = false, style = {} }: { children: React.ReactNode; wide?: boolean; style?: React.CSSProperties }) {
  const [hov, setHov] = useState(false);
  return (
    <div
      style={{
        gridColumn: wide ? "1 / -1" : undefined,
        background: hov ? C.cream : C.surface,
        border: "1px solid " + (hov ? C.borderHov : C.border),
        borderRadius: 14, padding: "20px 22px",
        transition: "border-color 0.2s, background 0.2s",
        position: "relative", overflow: "hidden", ...style,
      }}
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
    >
      {children}
    </div>
  );
}

export function CardLabel({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ fontFamily: SANS, fontSize: 9, color: C.umber, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 14 }}>
      {children}
    </div>
  );
}

export function StatPill({ label, value }: { label: string; value: string }) {
  return (
    <div style={{ background: "rgba(107,94,82,0.10)", border: "1px solid rgba(107,94,82,0.20)", borderRadius: 999, padding: "6px 14px", display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 1 }}>
      <span style={{ fontFamily: SANS, fontSize: 14, color: C.shadow, lineHeight: 1 }}>{value}</span>
      <span style={{ fontFamily: SANS, fontSize: 9, color: C.umber, letterSpacing: "0.08em", textTransform: "uppercase" }}>{label}</span>
    </div>
  );
}

export function ChartTooltip({ active, payload, label, unit = "" }: { active?: boolean; payload?: { name: string; value: number }[]; label?: string; unit?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={TOOLTIP_STYLE}>
      {label && <div style={{ color: C.umber, fontSize: 10, marginBottom: 4 }}>{label}</div>}
      {payload.map(p => <div key={p.name} style={{ color: C.ink }}>{p.name}: <strong>{p.value}{unit}</strong></div>)}
    </div>
  );
}

export function Divider() {
  return (
    <div style={{ height: 1, background: "linear-gradient(90deg, transparent, rgba(107,94,82,0.25) 20%, rgba(160,120,88,0.20) 50%, rgba(107,94,82,0.25) 80%, transparent)", margin: "24px 0" }} />
  );
}

/**
 * Shown inside a chart card when the backing dataset is empty.
 * `height` should match the ResponsiveContainer height it replaces so the
 * card doesn't collapse or jump when data arrives later
 */
export function EmptyChart({ height = 160, message = "No data yet" }: { height?: number; message?: string }) {
  return (
    <div style={{ height, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 8 }}>
      {/* Faint flat line */}
      <div style={{ width: "60%", height: 1, background: "linear-gradient(90deg, transparent, rgba(107,94,82,0.18) 30%, rgba(107,94,82,0.18) 70%, transparent)" }} />
      <span style={{ fontFamily: SANS, fontSize: 11, color: C.umber, fontStyle: "italic", opacity: 0.7 }}>{message}</span>
    </div>
  );
}
