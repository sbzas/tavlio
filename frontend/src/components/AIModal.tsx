import { useState, useEffect } from "react";
import { AreaChart, Area, YAxis, Tooltip, ResponsiveContainer } from "recharts";
import { C, SANS, SERIF } from "../theme";
import { ChartTooltip } from "./Primitives";
import { I } from "./Icons";

interface AIModalProps { query: string; onClose: () => void; }

export function AIModal({ query, onClose }: AIModalProps) {
  const [vis, setVis] = useState(false);

  useEffect(() => { const t = setTimeout(() => setVis(true), 30); return () => clearTimeout(t); }, []);
  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const minis = [
    { label: "Focus last 7d",    key: "hours",    color: C.rose },
    { label: "Sessions last 7d", key: "sessions", color: C.sand },
  ];

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, zIndex: 300, backdropFilter: "blur(10px)", WebkitBackdropFilter: "blur(10px)", display: "flex", alignItems: "center", justifyContent: "center", opacity: vis ? 1 : 0, transition: "opacity 0.22s" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: C.bg, border: "1px solid " + C.borderHov, borderRadius: 16, width: "min(740px, 93vw)", maxHeight: "82vh", overflowY: "auto", padding: "34px 36px", transform: vis ? "translateY(0)" : "translateY(18px)", transition: "transform 0.34s cubic-bezier(.22,.68,0,1.2)", boxShadow: "0 16px 48px rgba(60,50,40,0.18)" }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 7, fontFamily: SANS, fontSize: 9, color: C.sienna, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: 12 }}>
          {I.spark(12)} Tavlio Analysis
        </div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 22, color: C.shadow, marginBottom: 8, lineHeight: 1.32 }}>"{query}"</div>
        <p style={{ fontFamily: SANS, fontSize: 13, color: C.umber, lineHeight: 1.85, marginBottom: 28, paddingBottom: 24, borderBottom: "1px solid " + C.border }}>
          Over the last 30 days you averaged <span style={{ color: C.shadow }}>4.8 hours of focus</span> per weekday. Peak output is between <span style={{ color: C.shadow }}>10–11 AM</span>. Context switching is highest on Mondays.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))", gap: 14, marginBottom: 26 }}>
          {minis.map(({ label, key, color }) => (
            <div key={label} style={{ background: C.surface, border: "1px solid " + C.border, borderRadius: 12, padding: "16px 18px" }}>
              <div style={{ fontFamily: SANS, fontSize: 9, color: C.umber, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: 10 }}>{label}</div>
              <ResponsiveContainer width="100%" height={70}>
                <AreaChart margin={{ top: 2, right: 2, left: -30, bottom: 0 }}>
                  <defs>
                    <linearGradient id={"mg" + key} x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%"   stopColor={color} stopOpacity={0.35} />
                      <stop offset="100%" stopColor={color} stopOpacity={0}    />
                    </linearGradient>
                  </defs>
                  <YAxis tick={false} axisLine={false} tickLine={false} />
                  <Tooltip content={<ChartTooltip />} cursor={{ stroke: "rgba(90,80,70,0.20)", strokeWidth: 1 }} />
                  <Area type="monotone" dataKey={key} stroke={color} strokeWidth={1.5} fill={"url(#mg" + key + ")"} dot={false} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          ))}
        </div>
        <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
          <button onClick={onClose} style={{ fontFamily: SANS, background: C.sienna, border: "none", borderRadius: 9, padding: "9px 18px", color: C.highlight, fontSize: 12, cursor: "pointer" }}>Pin charts to dashboard</button>
          <button onClick={onClose} style={{ fontFamily: SANS, background: "transparent", border: "1px solid " + C.border, borderRadius: 9, padding: "9px 18px", color: C.umber, fontSize: 12, cursor: "pointer" }}>Dismiss</button>
          <span style={{ fontFamily: SANS, fontSize: 10, color: C.umber, marginLeft: "auto", opacity: 0.6 }}>esc to close</span>
        </div>
      </div>
    </div>
  );
}
