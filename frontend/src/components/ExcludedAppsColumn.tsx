import { useState, useRef, useEffect } from "react";
import { C, SANS } from "../theme";
import { I } from "./Icons";

// ---- scrollable column of excluded app pills, with edge fades ----
export function ExclusionColumn({ title, icon, color, apps, onRemove, emptyText }: {
  title: string; icon: React.ReactElement; color: string;
  apps: string[]; onRemove: (n: string) => void; emptyText: string;
}) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const [topFade, setTopFade]     = useState(false);
  const [bottomFade, setBottomFade] = useState(false);

  const updateFades = () => {
    const el = scrollRef.current;
    if (!el) return;
    setTopFade(el.scrollTop > 2);
    setBottomFade(el.scrollTop + el.clientHeight < el.scrollHeight - 2);
  };

  useEffect(() => { updateFades(); }, [apps]);

  return (
    <div style={{ display: "flex", flexDirection: "column", minHeight: 0 }}>
      <div style={{
        display: "flex", alignItems: "center", gap: 6, marginBottom: 8,
        fontFamily: SANS, fontSize: 9.5, color, letterSpacing: "0.08em", textTransform: "uppercase",
      }}>
        <span style={{ display: "flex", color }}>{icon}</span>
        {title}
        <span style={{ marginLeft: "auto", color: C.umber, letterSpacing: 0 }}>{apps.length}</span>
      </div>

      <div style={{ position: "relative", flex: 1, minHeight: 0 }}>
        {/* top fade */}
        {topFade && (
          <div style={{
            position: "absolute", top: 0, left: 0, right: 0, height: 14, zIndex: 2, pointerEvents: "none",
            background: "linear-gradient(to bottom, rgba(221,214,201,1), rgba(221,214,201,0))",
          }} />
        )}
        {/* bottom fade */}
        {bottomFade && (
          <div style={{
            position: "absolute", bottom: 0, left: 0, right: 0, height: 14, zIndex: 2, pointerEvents: "none",
            background: "linear-gradient(to top, rgba(221,214,201,1), rgba(221,214,201,0))",
          }} />
        )}

        <div
          ref={scrollRef}
          onScroll={updateFades}
          style={{
            // fixed height so the card never shifts as apps are added/removed;
            // fits ~3 pills, 4th onward requires scrolling to show up
            height: 102, overflowY: "auto", paddingRight: 2,
            display: "flex", flexDirection: "column", gap: 6,
            justifyContent: apps.length === 0 ? "center" : "flex-start",
          }}
        >
          {apps.length === 0 ? (
            <div style={{
              padding: "14px 8px", textAlign: "center", fontFamily: SANS, fontStyle: "italic",
              fontSize: 11, color: C.umber, opacity: 0.7, border: "1px dashed " + C.border, borderRadius: 8,
            }}>
              {emptyText}
            </div>
          ) : apps.map(n => (
            <div key={n} style={{
              display: "flex", alignItems: "center", gap: 7, padding: "6px 8px 6px 11px",
              background: "rgba(107,94,82,0.06)", border: "1px solid " + C.border, borderRadius: 999,
              fontFamily: SANS, fontSize: 12, color: C.shadow,
            }}>
              <span style={{ display: "flex", color }}>{icon}</span>
              <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{n}</span>
              <button
                onClick={() => onRemove(n)}
                style={{ border: "none", background: "transparent", color: C.umber, cursor: "pointer", padding: 0, display: "flex", lineHeight: 0 }}
                onMouseEnter={e => e.currentTarget.style.color = C.rose}
                onMouseLeave={e => e.currentTarget.style.color = C.umber}
                title="Remove exclusion"
              >{I.x(11)}</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
