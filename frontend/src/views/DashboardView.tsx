import { C, SANS } from "../theme";
import { I } from "../components/Icons";
import { useWindowWidth } from "../hooks/useWindowWidth";
import { FocusAreaChart }  from "../charts/FocusAreaChart";
import { AppUsageBar }     from "../charts/AppUsageBar";
import { SwitchHeatmap }   from "../charts/SwitchHeatmap";
import { WeeklyLineChart } from "../charts/WeeklyLineChart";
import { RecentLogs }      from "../charts/RecentLogs";

export function DashboardView() {
  const w    = useWindowWidth();
  const cols = w < 600 ? 1 : 2;

  return (
    <div style={{ paddingBottom: 90 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
        <span style={{ fontFamily: SANS, fontSize: 9, color: C.umber, letterSpacing: "0.12em", textTransform: "uppercase" }}>
          Dashboard · {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </span>
        <button style={{ fontFamily: SANS, background: "rgba(107,94,82,0.10)", border: "1px solid " + C.border, borderRadius: 8, padding: "6px 13px", color: C.umber, fontSize: 11, cursor: "pointer", display: "flex", alignItems: "center", gap: 5 }}>
          {I.plus(12)} Add widget
        </button>
      </div>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(" + cols + ", 1fr)", gap: 14 }}>
        <FocusAreaChart />
        <AppUsageBar />
        <SwitchHeatmap />
        <WeeklyLineChart />
        <RecentLogs />
      </div>

      <div
        style={{ marginTop: 14, border: "1px dashed rgba(107,94,82,0.18)", borderRadius: 12, padding: "24px", textAlign: "center", fontFamily: SANS, color: C.umber, fontSize: 12, cursor: "pointer", transition: "border-color 0.2s, color 0.2s" }}
        onMouseEnter={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = "rgba(107,94,82,0.38)"; el.style.color = C.shadow; }}
        onMouseLeave={e => { const el = e.currentTarget as HTMLDivElement; el.style.borderColor = "rgba(107,94,82,0.18)"; el.style.color = C.umber; }}
      >
        + Drop a chart here or ask Tavlio to generate one
      </div>
    </div>
  );
}
