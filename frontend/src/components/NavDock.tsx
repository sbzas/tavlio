import { C, SANS } from "../theme";
import { I } from "./Icons";
import { useWindowWidth } from "../hooks/useWindowWidth";

const NAV = [
  { id: "dashboard", label: "Dashboard", icon: () => I.dashboard() },
  { id: "archives",  label: "Archives",  icon: () => I.archive()   },
  { id: "calendar",  label: "Calendar",  icon: () => I.calendar()  },
];

interface NavDockProps { active: string; onNav: (v: string) => void; }

export function NavDock({ active, onNav }: NavDockProps) {
  const w       = useWindowWidth();
  const compact = w < 480;

  return (
    <div style={{ position: "fixed", bottom: 26, left: "50%", transform: "translateX(-50%)", zIndex: 100, background: C.parchment, border: "1px solid " + C.border, borderRadius: 999, padding: "6px 8px", display: "flex", gap: 2, boxShadow: "0 4px 20px rgba(107,94,82,0.18)" }}>
      {NAV.map(({ id, label, icon }) => (
        <button
          key={id}
          onClick={() => onNav(id)}
          style={{ background: active === id ? "rgba(107,94,82,0.14)" : "transparent", border: "1px solid " + (active === id ? C.border : "transparent"), borderRadius: 999, padding: compact ? "8px 12px" : "8px 18px", display: "flex", alignItems: "center", gap: compact ? 0 : 7, color: active === id ? C.shadow : C.umber, fontSize: 12, cursor: "pointer", fontFamily: SANS, transition: "all 0.17s" }}
          onMouseEnter={e => { if (active !== id) (e.currentTarget as HTMLButtonElement).style.color = C.shadow; }}
          onMouseLeave={e => { if (active !== id) (e.currentTarget as HTMLButtonElement).style.color = C.umber; }}
        >
          {icon()} {!compact && <span>{label}</span>}
        </button>
      ))}
    </div>
  );
}
