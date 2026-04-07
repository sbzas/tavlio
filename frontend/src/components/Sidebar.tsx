import { useRef } from "react";
import { C, SANS, SERIF, SIDEBAR_W } from "../theme";
import { I } from "./Icons";

const SECTIONS = [
  { label: "Capture",       items: ["Video retention", "FPS settings"] },
  { label: "Privacy",       items: ["Excluded apps", "Data encryption"] },
  { label: "AI Processing", items: ["VLM model", "Analysis focus"] },
  { label: "Storage",       items: ["Local path", "Compression"]},

];

interface SidebarProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export function Sidebar({ open, onOpen, onClose }: SidebarProps) {
  // Debounce close so a momentary mouse-exit doesn't collapse the panel
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const scheduleClose = () => {
    closeTimer.current = setTimeout(onClose, 220);
  };
  const cancelClose = () => {
    if (closeTimer.current) clearTimeout(closeTimer.current);
  };

  return (
    <>
      {/* hovering over the left edge of the app opens the sidebar regardless of its current state*/}
      <div
        style={{
          position: "fixed", top: 0, left: 0, bottom: 0, width: 16,
          zIndex: 110,
        }}
        onMouseEnter={() => { cancelClose(); onOpen(); }}
        onMouseLeave={scheduleClose}
      />

      <div
        style={{
          position: "fixed", top: 0, left: 0, bottom: 0,
          width: open ? SIDEBAR_W : 0,
          zIndex: 100,
          overflow: "hidden",
          transition: "width 0.28s cubic-bezier(.4,0,.2,1)",
        }}
        onMouseEnter={() => { cancelClose(); onOpen(); }}
        onMouseLeave={scheduleClose}
      >
        <div style={{
          width: SIDEBAR_W, height: "100%",
          background: C.sidebar,
          borderRight: "1px solid " + C.border,
          display: "flex", flexDirection: "column",
        }}>
          <div style={{ padding: "24px 20px 16px", borderBottom: "1px solid " + C.border }}>
            <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 18, color: C.shadow }}>Tavlio</div>
            <div style={{ fontFamily: SANS, fontSize: 9, color: C.umber, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 4 }}>Settings</div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "12px 0" }}>
            {SECTIONS.map(sec => (
              <div key={sec.label} style={{ marginBottom: 4 }}>
                <div style={{ padding: "5px 20px", fontFamily: SANS, fontSize: 9, color: C.sienna, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  {sec.label}
                </div>
                {sec.items.map(item => (
                  <button
                    key={item}
                    style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", padding: "8px 20px", color: C.umber, fontSize: 12, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: SANS }}
                    onMouseEnter={e => { const el = e.currentTarget; el.style.color = C.shadow; el.style.background = "rgba(107,94,82,0.08)"; }}
                    onMouseLeave={e => { const el = e.currentTarget; el.style.color = C.umber;  el.style.background = "transparent"; }}
                  >
                    {item} <span style={{ color: C.umber }}>{I.chevronR(11)}</span>
                  </button>
                ))}
              </div>
            ))}
          </div>

          <div style={{ padding: "12px 20px", borderTop: "1px solid " + C.border, fontFamily: SANS, fontSize: 9.5, color: C.sienna }}>
            v0.1.0-alpha · Tavlio
          </div>
        </div>
      </div>
    </>
  );
}
