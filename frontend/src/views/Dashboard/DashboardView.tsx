import { useState } from "react";
import { C, SANS } from "../../theme";
import { I } from "../../components/Icons";
import { useWindowWidth } from "../../hooks/useWindowWidth";
import type { AppEntry } from "../../types";

// Charts
import { FocusAreaChart }  from "../../charts/FocusAreaChart";
import { SwitchesBarChart }     from "../../charts/SwitchBar";
import { SwitchHeatmap }   from "../../charts/SwitchHeatmap";
import { WeeklyLineChart } from "../../charts/WeeklyLineChart";
import { RecentLogs }      from "../../charts/RecentLogs";
import { SessionsChart }   from "../../charts/SessionsBar";
import { AppSharePie }     from "../../charts/AppSharePie";
import { AppPinnedCard }   from "../../charts/AppPinnedCard";

// dashboard parst
import type { BuiltinId } from "./DashboardUtils";
import { useDashboardState } from "./DashboardState";
import { RemovableWidget } from "./RemovableWidget";
import { AddWidgetModal } from "./AddWidgetModal";

export function DashboardView() {
  const { state, isLoading, updateState } = useDashboardState();
  const [modalOpen, setModal] = useState(false);
  
  const w    = useWindowWidth();
  const cols = w < 600 ? 1 : 2;

  // State mutators
  const addBuiltin  = (id: BuiltinId) => { updateState(s => ({ ...s, builtins: [...s.builtins, id] })); setModal(false); };
  const removeBuiltin = (id: BuiltinId) => updateState(s => ({ ...s, builtins: s.builtins.filter(b => b !== id) }));
  const pinApp    = (app: AppEntry) => { updateState(s => ({ ...s, pinnedApps: [...s.pinnedApps.filter(a => a.name !== app.name), app] })); setModal(false); };
  const unpinApp  = (name: string) => updateState(s => ({ ...s, pinnedApps: s.pinnedApps.filter(a => a.name !== name) }));

  const isWideWidget = (id: string) => ["focus", "weekly", "logs"].includes(id);

  function renderBuiltin(id: BuiltinId) {
    switch (id) {
      case "focus":    return <FocusAreaChart />;
      case "apps":     return <SwitchesBarChart />;
      case "switches": return <SwitchHeatmap />;
      case "weekly":   return <WeeklyLineChart />;
      case "logs":     return <RecentLogs />;
      case "sessions": return <SessionsChart />;
      case "share":    return <AppSharePie />;
    }
  }

  if (isLoading) {
      return <div style={{ fontFamily: SANS, color: C.umber, padding: 20 }}>Loading dashboard...</div>;
  }

  const empty = state.builtins.length === 0 && state.pinnedApps.length === 0;

  return (
    <>
      <style>{`
        .removable-widget:hover .remove-btn { display: flex !important; }
        .remove-btn { background: ${C.surface}; border: 1px solid ${C.border}; }
        .remove-btn:hover { background: ${C.cream}; }
        .add-widget-btn { background: rgba(107,94,82,0.10); border: 1px solid ${C.border}; color: ${C.umber}; transition: background 0.2s, color 0.2s; }
        .add-widget-btn:hover { background: rgba(107,94,82,0.18); color: ${C.shadow}; }
      `}</style>

      <div style={{ paddingBottom: 90 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <span style={{ fontFamily: SANS, fontSize: 9, color: C.umber, letterSpacing: "0.12em", textTransform: "uppercase" }}>
            Dashboard · {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
          </span>
          <button onClick={() => setModal(true)} className="add-widget-btn" style={{ fontFamily: SANS, borderRadius: 8, padding: "6px 13px", fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
            {I.plus(12)} Add widget
          </button>
        </div>

        {!empty && (
          <div style={{
            display: "grid", gridTemplateColumns: "repeat(" + cols + ", 1fr)",
            gridAutoRows: "auto", alignItems: "start", gap: 14,
          }}>
            {state.builtins.map(id => (
              <RemovableWidget 
                key={id} onRemove={() => removeBuiltin(id)}
                style={{ gridColumn: cols === 2 && isWideWidget(id) ? "span 2" : "span 1" }}
              >
                {renderBuiltin(id)}
              </RemovableWidget>
            ))}
            {state.pinnedApps.map(app => (
              <RemovableWidget key={"pin-" + app.name} onRemove={() => unpinApp(app.name)}>
                <AppPinnedCard app={app} />
              </RemovableWidget>
            ))}
          </div>
        )}

        {empty && (
          <div onClick={() => setModal(true)} style={{ marginTop: 14, border: "1px dashed rgba(107,94,82,0.18)", borderRadius: 12, padding: "36px 24px", textAlign: "center", fontFamily: SANS, color: C.umber, fontSize: 12, cursor: "pointer" }}>
            Your dashboard is empty · click to add widgets
          </div>
        )}

        {modalOpen && (
          <AddWidgetModal activeBuiltins={state.builtins} pinnedApps={state.pinnedApps} onAddBuiltin={addBuiltin} onPinApp={pinApp} onClose={() => setModal(false)} />
        )}
      </div>
    </>
  );
}