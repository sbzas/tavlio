import { useState, useEffect, useRef } from "react";
import { C, SANS, SERIF } from "../../theme";
import { I } from "../../components/Icons";
import { APP_TINTS } from "../../mockConfig";
import type { AppEntry } from "../../types";
import { GetAllAppsWeeklySummary } from "../../../bindings/tavlio/dbase/store";
import { type BuiltinId, BUILTIN_DEFS } from "./DashboardUtils";

function BuiltinChartCard({ def, onAdd }: { def: typeof BUILTIN_DEFS[number]; onAdd: () => void }) {
    const [hov, setHov] = useState(false);
    return (
    <button
        onClick={onAdd}
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{
        background: hov ? C.cream : C.surface,
        border: "1px solid " + (hov ? C.borderHov : C.border),
        borderRadius: 10, padding: "12px 14px", textAlign: "left",
        cursor: "pointer", transition: "background 0.15s, border-color 0.15s",
        // ADDED: Flex column layout to distribute internal space
        display: "flex", flexDirection: "column", height: "100%"
        }}
    >
        <div style={{ fontFamily: SANS, fontSize: 12, color: C.shadow, marginBottom: 4 }}>{def.label}</div>
        <div style={{ fontFamily: SANS, fontSize: 10, color: C.umber, lineHeight: 1.5 }}>{def.desc}</div>
        {/* ADDED: marginTop: "auto" pushes this element to the absolute bottom */}
        <div style={{ fontFamily: SANS, fontSize: 9, color: C.sienna, marginTop: "auto", paddingTop: 12, opacity: hov ? 1 : 0, transition: "opacity 0.15s" }}>
        + Add to dashboard
        </div>
    </button>
    );
}

function AppRow({ app, pinned, onPin }: { app: AppEntry; pinned: boolean; onPin: () => void }) {
    const [hov, setHov] = useState(false);
    const fmt = (mins: number) => {
    const h = Math.floor(mins / 60), m = Math.round(mins % 60);
    return h > 0 ? `${h}h ${m}m` : `${m}m`;
    };
    return (
    <div
        onMouseEnter={() => setHov(true)}
        onMouseLeave={() => setHov(false)}
        style={{ display: "flex", alignItems: "center", gap: 12, padding: "9px 12px", borderRadius: 8, background: hov ? C.surface : "transparent", transition: "background 0.15s" }}
    >
        <div style={{ width: 28, height: 28, borderRadius: 7, background: app.tint + "22", border: "1px solid " + app.tint + "44", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0 }}>
        <span style={{ fontFamily: SERIF, fontSize: 12, color: app.tint, fontStyle: "italic" }}>{app.name[0]}</span>
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontFamily: SANS, fontSize: 12, color: C.ink, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{app.name}</div>
        <div style={{ fontFamily: SANS, fontSize: 9.5, color: C.umber }}>{fmt(app.weekMins)} this week</div>
        </div>
        <button
        onClick={pinned ? undefined : onPin}
        disabled={pinned}
        style={{
            fontFamily: SANS, fontSize: 10,
            background: pinned ? "transparent" : hov ? C.sienna : "rgba(107,94,82,0.10)",
            border: "1px solid " + (pinned ? "transparent" : hov ? C.sienna : C.border),
            borderRadius: 6, padding: "4px 10px",
            color: pinned ? C.umber : hov ? C.highlight : C.umber,
            cursor: pinned ? "default" : "pointer",
            transition: "all 0.15s", flexShrink: 0, opacity: pinned ? 0.5 : 1,
        }}
        >
        {pinned ? "Pinned" : "Pin"}
        </button>
    </div>
    );
}

export function AddWidgetModal({ activeBuiltins, pinnedApps, onAddBuiltin, onPinApp, onClose }: {
  activeBuiltins: BuiltinId[];
  pinnedApps: AppEntry[];
  onAddBuiltin: (id: BuiltinId) => void;
  onPinApp: (app: AppEntry) => void;
  onClose: () => void;
}) {
    const [apps, setApps]               = useState<AppEntry[]>([]);
    const [appsLoading, setAppsLoading] = useState(true);
    const [vis, setVis]                 = useState(false);
    const closeBtnRef                   = useRef<HTMLButtonElement>(null);
    const pinnedNames                   = new Set(pinnedApps.map(a => a.name));
  
    // Animation and focus
    useEffect(() => { 
      const t = setTimeout(() => setVis(true), 20); 
      closeBtnRef.current?.focus(); 
      return () => clearTimeout(t); 
    }, []);
  
    // Safe async loading
    useEffect(() => {
      let isMounted = true;
      
      GetAllAppsWeeklySummary()
        .then(rows => {
          if (isMounted) {
            setApps((rows ?? []).map(r => ({ name: r.Name, tint: APP_TINTS[r.Name] ?? C.sienna, weekMins: r.WeekMins })));
          }
        })
        .catch(err => {
          console.error("Failed to fetch apps", err);
          if (isMounted) setApps([]);
        })
        .finally(() => {
          if (isMounted) setAppsLoading(false);
        });
  
      return () => { isMounted = false; }; 
    }, []);
  
    useEffect(() => {
      const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
      window.addEventListener("keydown", h);
      return () => window.removeEventListener("keydown", h);
    }, [onClose]);
  
    const available = BUILTIN_DEFS.filter(d => !activeBuiltins.includes(d.id));
  
    return (
      <div onClick={onClose} style={{ position: "fixed", inset: 0, zIndex: 300, backdropFilter: "blur(8px)", display: "flex", alignItems: "center", justifyContent: "center", opacity: vis ? 1 : 0, transition: "opacity 0.2s" }}>
        <div onClick={e => e.stopPropagation()} style={{ background: C.bg, border: "1px solid " + C.borderHov, borderRadius: 16, width: "min(640px, 92vw)", maxHeight: "80vh", display: "flex", flexDirection: "column", transform: vis ? "translateY(0)" : "translateY(14px)", transition: "transform 0.3s" }}>
          
          {/* Header */}
          <div style={{ padding: "18px 22px 14px", borderBottom: "1px solid " + C.border, display: "flex", alignItems: "center", justifyContent: "space-between", flexShrink: 0 }}>
            <div>
              <div style={{ fontFamily: SANS, fontSize: 9, color: C.sienna, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 3 }}>Dashboard</div>
              <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 17, color: C.shadow }}>Add a widget</div>
            </div>
            <button ref={closeBtnRef} onClick={onClose} style={{ background: "transparent", border: "none", color: C.umber, cursor: "pointer", display: "flex", padding: 4 }}>
              {I.x(14)}
            </button>
          </div>
  
          {/* Body */}
          <div style={{ flex: 1, overflowY: "auto", padding: "18px 22px 22px" }}>
  
            {/* Built-in charts */}
            <div style={{ fontFamily: SANS, fontSize: 9, color: C.sienna, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>Charts</div>
            {available.length === 0 ? (
              <p style={{ fontFamily: SANS, fontSize: 11, color: C.umber, fontStyle: "italic", marginBottom: 22 }}>All built-in charts are already on your dashboard.</p>
            ) : (
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(175px, 1fr))", gap: 8, marginBottom: 24 }}>
                {available.map(def => (
                  <BuiltinChartCard key={def.id} def={def} onAdd={() => { onAddBuiltin(def.id); }} />
                ))}
              </div>
            )}
  
            {/* App pins */}
            <div style={{ fontFamily: SANS, fontSize: 9, color: C.sienna, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 10 }}>From Archives</div>
            {appsLoading ? (
              <p style={{ fontFamily: SANS, fontSize: 11, color: C.umber, fontStyle: "italic" }}>Loading apps…</p>
            ) : apps.length === 0 ? (
              <p style={{ fontFamily: SANS, fontSize: 11, color: C.umber, fontStyle: "italic" }}>No apps tracked yet — open Archives once Tavlio has recorded some sessions.</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                {apps.map(app => (
                  <AppRow key={app.name} app={app} pinned={pinnedNames.has(app.name)} onPin={() => { onPinApp(app); }} />
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    );
}