import { useRef, useState, useEffect, useCallback } from "react";
import { C, SANS, SERIF, SIDEBAR_W } from "../theme";
import { I } from "./Icons";

import { 
  SetUserPreference, 
  GetUserPreference, 
  GetVideoRetentionLimit 
} from "../../bindings/tavlio/dbase/store";

const SECTIONS = [
  { label: "Capture",       items: ["Video retention", "FPS settings"] },
  { label: "Privacy",       items: ["Excluded apps", "Data encryption"] },
  { label: "AI Processing", items: ["VLM enabled", "Analysis focus"] }, // Updated label
  { label: "Storage",       items: ["Local path", "Compression"]},
];

const SPINNER_BTN_STYLE = {
  border: "none",
  background: "transparent",
  padding: 0,
  color: C.umber,
  cursor: "pointer",
  display: "flex",
  transition: "color 0.15s",
  outline: "none"
} as const;

interface SidebarProps {
  open: boolean;
  onOpen: () => void;
  onClose: () => void;
}

export function Sidebar({ open, onOpen, onClose }: SidebarProps) {
  const closeTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Use string state to allow temporary empty values while typing
  const [inputValue, setInputValue] = useState<string>("3");
  const [vlmEnabled, setVlmEnabled] = useState<boolean>(false);

  useEffect(() => {
    let isMounted = true; 

    GetVideoRetentionLimit("video_retention_days", 3)
      .then((days: number) => {
        if (isMounted) setInputValue(days.toString());
      })
      .catch((err: any) => console.error("Failed to load retention preference:", err));

    GetUserPreference("vlm_enabled", "false")
      .then((val: string) => {
        if (isMounted) setVlmEnabled(val === "true");
      })
      .catch((err: any) => console.warn("Failed to load VLM preference:", err));

    return () => { isMounted = false; }; 
  }, []);

  const scheduleClose = () => { closeTimer.current = setTimeout(onClose, 220); };
  const cancelClose = () => { if (closeTimer.current) clearTimeout(closeTimer.current); };

  const saveRetentionPreference = useCallback((value: number) => {
    SetUserPreference("video_retention_days", value.toString())
      .then(() => {
        // Broadcast the change to the rest of the app
        window.dispatchEvent(new CustomEvent("retentionChanged", { detail: value }));
      })
      .catch((err: any) => console.error("Failed to save preference:", err));
  }, []);

  const toggleVLM = () => {
    const nextState = !vlmEnabled;
    setVlmEnabled(nextState);
    // Save using the generic string setter
    SetUserPreference("vlm_enabled", nextState ? "true" : "false")
      .catch((err: any) => console.error("Failed to save VLM preference:", err));
  };

  const handleRetentionChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const raw = e.target.value.replace(/[^0-9]/g, '');
    setInputValue(raw);
  };

  // Validates and saves when the user clicks away from the input
  const handleRetentionBlur = () => {
    let val = parseInt(inputValue, 10);
    if (isNaN(val) || val < 1) val = 1; 
    setInputValue(val.toString());
    saveRetentionPreference(val);
  };

  const adjustDays = (delta: number) => {
    let current = parseInt(inputValue, 10);
    if (isNaN(current)) current = 1;
    const newVal = Math.max(1, current + delta); 
    setInputValue(newVal.toString());
    saveRetentionPreference(newVal);
  };

  return (
    <>
    <div 
      style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 24, zIndex: 110 }} 
      onMouseEnter={() => { cancelClose(); onOpen(); }} 
      onMouseLeave={scheduleClose} 
    />
    <div 
      style={{ 
        position: "fixed", top: 0, left: 0, bottom: 0, width: open ? SIDEBAR_W : 0, zIndex: 100, 
        overflow: "hidden", transition: "width 0.28s cubic-bezier(.4,0,.2,1)" }} 
        onMouseEnter={() => { cancelClose(); onOpen(); }} 
        onMouseLeave={scheduleClose} 
    />
      <div
        style={{ position: "fixed", top: 0, left: 0, bottom: 0, width: 24, zIndex: 110 }}
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
          <div style={{ padding: "28px 20px 20px", borderBottom: "1px solid " + C.border }}>
            <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 18, color: C.shadow }}>Tavlio</div>
            <div style={{ fontFamily: SANS, fontSize: 9, color: C.umber, letterSpacing: "0.12em", textTransform: "uppercase", marginTop: 4 }}>Settings</div>
          </div>

          <div style={{ flex: 1, overflowY: "auto", padding: "16px 0" }}>
            {SECTIONS.map(sec => (
              <div key={sec.label} style={{ marginBottom: 8 }}>
                <div style={{ padding: "6px 20px", fontFamily: SANS, fontSize: 9.5, color: C.sienna, letterSpacing: "0.12em", textTransform: "uppercase" }}>
                  {sec.label}
                </div>
                {sec.items.map(item => {
                  
                  if (item === "Video retention") {
                    return (
                      <div
                        key={item}
                        style={{ 
                          width: "100%", padding: "14px 20px", color: C.shadow, fontSize: 13.5, 
                          display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: SANS 
                        }}
                      >
                        <span>{item}</span>
                        <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                           <input
                             type="text"
                             inputMode="numeric"
                             value={inputValue}
                             onChange={handleRetentionChange}
                             onBlur={handleRetentionBlur}
                             style={{
                               width: "42px", background: "transparent", border: `1px solid ${C.border}`,
                               color: C.shadow, textAlign: "center", borderRadius: "4px",
                               fontFamily: SANS, fontSize: 13.5, padding: "4px 0", outline: "none"
                             }}
                           />
                           <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginLeft: "2px" }}>
                             <button
                                style={SPINNER_BTN_STYLE}
                                onMouseEnter={e => e.currentTarget.style.color = C.shadow}
                                onMouseLeave={e => e.currentTarget.style.color = C.umber}
                                onClick={() => adjustDays(1)}
                             >
                               {I.chevronUp(12)}
                             </button>
                             <button
                                style={SPINNER_BTN_STYLE}
                                onMouseEnter={e => e.currentTarget.style.color = C.shadow}
                                onMouseLeave={e => e.currentTarget.style.color = C.umber}
                                onClick={() => adjustDays(-1)}
                             >
                               {I.chevronDown(12)}
                             </button>
                           </div>
                           <span style={{ fontSize: 11, color: C.sienna, marginLeft: 4 }}>days</span>
                        </div>
                      </div>
                    );
                  }

                  if (item === "VLM enabled") {
                    return (
                      <div key={item} style={{ width: "100%", padding: "14px 20px", color: C.shadow, fontSize: 13.5, display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: SANS }}>
                        <span>{item}</span>
                        <div 
                          onClick={toggleVLM}
                          style={{
                            width: 32, height: 18, borderRadius: 9,
                            background: vlmEnabled ? C.sienna : C.border,
                            position: "relative", cursor: "pointer",
                            transition: "background 0.2s cubic-bezier(.4,0,.2,1)"
                          }}
                        >
                          <div style={{
                            position: "absolute", top: 2, 
                            left: vlmEnabled ? 16 : 2,
                            width: 14, height: 14, borderRadius: "50%",
                            background: "white", 
                            boxShadow: "0 1px 2px rgba(0,0,0,0.1)",
                            transition: "left 0.2s cubic-bezier(.4,0,.2,1)"
                          }} />
                        </div>
                      </div>
                    );
                  }

                  return (
                    <button
                      key={item}
                      style={{ 
                        width: "100%", textAlign: "left", background: "transparent", border: "none", 
                        padding: "14px 20px", color: C.umber, fontSize: 13.5, cursor: "pointer", 
                        display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: SANS,
                        transition: "background 0.15s, color 0.15s"
                      }}
                      onMouseEnter={e => { const el = e.currentTarget; el.style.color = C.shadow; el.style.background = "rgba(107,94,82,0.08)"; }}
                      onMouseLeave={e => { const el = e.currentTarget; el.style.color = C.umber;  el.style.background = "transparent"; }}
                    >
                      {item} <span style={{ color: C.umber }}>{I.chevronR(12)}</span>
                    </button>
                  );
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