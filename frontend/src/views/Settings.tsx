import { useRef } from "react";
import { C, SANS, SERIF, SIDEBAR_W } from "../theme";
import { useSettings } from "../hooks/useSettings";
import { SettingToggle, RetentionSpinner, DefaultButton } from "../components/SettingsComponents";

const SECTIONS = [
  { label: "Capture",       items: ["Capture enabled", "Video retention"] },
  { label: "Privacy",       items: ["Excluded apps", "Data encryption"] },
  { label: "AI Processing", items: ["VLM enabled", "Analysis focus"] },
  { label: "Storage",       items: ["Local path", "Compression"]},
];

interface SidebarProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export function Sidebar({ open, onOpen, onClose }: SidebarProps) {
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const settings = useSettings();

  const scheduleClose = () => { closeTimer.current = setTimeout(onClose, 220); };
  const cancelClose = () => { if (closeTimer.current) clearTimeout(closeTimer.current); };

  return (
    <>
      {/* Background Overlays */}
      <div style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 24, zIndex: 110 }} onMouseEnter={() => { cancelClose(); onOpen(); }} onMouseLeave={scheduleClose} />
      <div style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: open ? SIDEBAR_W : 0, zIndex: 100, overflow: "hidden", transition: "width 0.28s cubic-bezier(.4,0,.2,1)" }} onMouseEnter={() => { cancelClose(); onOpen(); }} onMouseLeave={scheduleClose}>
        
        {/* Sidebar Container */}
        <div style={{ width: SIDEBAR_W, height: "100%", background: C.sidebar, borderRight: "1px solid " + C.border, display: "flex", flexDirection: "column" }}>
          
          <div style={{ padding: "28px 20px 20px", borderBottom: "1px solid " + C.border }}>
            <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 18, color: C.shadow }}>Tavlio</div>
            <div style={{ fontFamily: SANS, fontSize: 9, color: C.umber, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 4 }}>Settings</div>
          </div>

          {/* Settings Menu */}
          <div style={{ flex: 1, overflowY: "auto", padding: "16px 0" }}>
            {SECTIONS.map(sec => (
              <div key={sec.label} style={{ marginBottom: 8 }}>
                <div style={{ padding: "6px 20px", fontFamily: SANS, fontSize: 9.5, color: C.sienna, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  {sec.label}
                </div>
                
                {sec.items.map(item => {
                  if (item === "Video retention") return <RetentionSpinner key={item} value={settings.retentionDays} onChange={settings.handleRetentionChange} onBlur={settings.handleRetentionBlur} onAdjust={settings.adjustRetentionDays} />;
                  if (item === "VLM enabled") return <SettingToggle key={item} label={item} enabled={settings.vlmEnabled} status={settings.vlmStatus} onToggle={settings.toggleVLM} />;
                  if (item === "Capture enabled") return <SettingToggle key={item} label={item} enabled={settings.captureEnabled} status={settings.captureStatus} onToggle={settings.toggleCapture} />;
                  
                  return <DefaultButton key={item} label={item} />;
                })}
              </div>
            ))}
          </div>

          <div style={{ padding: "16px 20px", borderTop: "1px solid " + C.border, fontFamily: SANS, fontSize: 10, color: C.sienna }}>
            v0.1.0-alpha · Tavlio
          </div>
        </div>
      </div>
    </>
  );
}