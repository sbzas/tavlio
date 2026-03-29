import { useState, useEffect } from "react";
import { C, SANS, SERIF } from "../theme";
import type { AppEntry } from "../types";
import { APP_TINTS, fmt } from "../mockConfig";
import { Divider, EmptyChart } from "../components/Primitives";
import { I } from "../components/Icons";

function FolderCard({ app, index, total, onClick }: { app: AppEntry; index: number; total: number; onClick: () => void }) {
  const [hov, setHov] = useState(false);

  const sparkBars = [0.45, 0.7, 0.55, 1.0, 0.8, 0.65, 0.9].map(
    (v, i) => v * ((((index + i) % 4) + 1) / 4) * 0.5 + v * 0.5
  );

  const borderRadius =
    index === 0         ? "10px 10px 4px 4px" :
    index === total - 1 ? "4px 4px 10px 10px" : "4px";

  return (
    <div style={{ position: "relative", marginBottom: index < total - 1 ? "-1px" : 0, zIndex: hov ? 50 : total - index }}>
      <div
        onClick={onClick}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
          background: hov ? C.cream : C.surface,
          border: "1px solid " + (hov ? app.tint : C.border),
          borderRadius,
          padding: "13px 20px",
          display: "flex", alignItems: "center", gap: 16,
          transform: hov ? "translateY(-6px)" : "translateY(0)",
          boxShadow: hov ? "0 10px 28px rgba(80,65,55,0.16), 0 2px 6px rgba(80,65,55,0.08)" : "none",
          transition: "transform 0.24s cubic-bezier(.34,1.56,.64,1), box-shadow 0.24s, background 0.18s, border-color 0.18s",
          cursor: "pointer",
        }}
      >
        <div style={{ width: 38, height: 38, borderRadius: 10, flexShrink: 0, background: hov ? app.tint + "22" : "rgba(90,80,70,0.10)", border: "1px solid " + (hov ? app.tint + "55" : "rgba(90,80,70,0.18)"), display: "flex", alignItems: "center", justifyContent: "center", transition: "background 0.18s, border-color 0.18s" }}>
          <span style={{ fontFamily: SERIF, fontSize: 15, color: hov ? app.tint : C.umber, fontStyle: "italic" }}>{app.name[0]}</span>
        </div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 15, color: hov ? C.shadow : C.ink, lineHeight: 1, transition: "color 0.18s" }}>{app.name}</div>
          <div style={{ fontFamily: SANS, fontSize: 10, color: C.umber, marginTop: 5, display: "flex", alignItems: "center", gap: 4 }}>
            <span style={{ display: "flex" }}>{I.clock()}</span> {fmt(app.weekMins)} this week
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "flex-end", gap: 2, height: 22, flexShrink: 0 }}>
          {sparkBars.map((v, i) => (
            <div key={i} style={{ width: 3, height: Math.max(3, v * 22), borderRadius: 2, background: hov ? app.tint : C.sienna, opacity: hov ? 0.55 + v * 0.45 : 0.35 + v * 0.3, transition: "background 0.2s, opacity 0.2s" }} />
          ))}
        </div>

        <div style={{ opacity: hov ? 1 : 0, transform: hov ? "translateX(0)" : "translateX(-5px)", transition: "opacity 0.18s, transform 0.18s", color: C.umber, flexShrink: 0 }}>
          {I.chevronR(15)}
        </div>
      </div>
    </div>
  );
}

export function ArchivesView({ onSelectApp }: { onSelectApp: (app: AppEntry) => void }) {
  const [apps, setApps]       = useState<AppEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    import("../../bindings/tavlio/dbase/store")
      .then(m => m.GetAllAppsWeeklySummary())
      .then(rows => {
        const entries: AppEntry[] = (rows ?? []).map(r => ({
          name:     r.Name,
          tint:     APP_TINTS[r.Name] ?? C.sienna,
          weekMins: r.WeekMins,
        }));
        setApps(entries);
      })
      .catch(() => setApps([]))
      .finally(() => setLoading(false));
  }, []);

  const total = apps.length;

  return (
    <div style={{ paddingBottom: 90 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: SANS, fontSize: 9, color: C.umber, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
          Archives · {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 22, color: C.shadow, lineHeight: 1 }}>Your application cabinet</div>
        {!loading && total > 0 && (
          <div style={{ fontFamily: SANS, fontSize: 12, color: C.umber, marginTop: 7 }}>{total} apps tracked · hover to preview · click to open</div>
        )}
      </div>

      <Divider />

      {loading ? (
        <EmptyChart height={200} message="Loading…" />
      ) : total === 0 ? (
        <EmptyChart height={200} message="Apps will appear here once Tavlio has recorded some sessions" />
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 0 }}>
          {apps.map((app, i) => (
            <FolderCard key={app.name} app={app} index={i} total={total} onClick={() => onSelectApp(app)} />
          ))}
        </div>
      )}
    </div>
  );
}
