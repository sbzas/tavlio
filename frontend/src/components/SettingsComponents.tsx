import { C, SANS } from "../theme";
import { I } from "./Icons";

const SPINNER_BTN_STYLE = {
  border: "none", background: "transparent", padding: 0,
  color: C.umber, cursor: "pointer", display: "flex",
  transition: "color 0.15s", outline: "none"
} as const;

export const SettingToggle = ({ label, enabled, status, onToggle }: { label: string, enabled: boolean, status: string, onToggle: () => void }) => (
  <div style={{ width: "100%", padding: "14px 20px", color: C.shadow, fontSize: 13.5, display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: SANS }}>
    <div style={{ display: "flex", flexDirection: "column", gap: "2px" }}>
      <span>{label}</span>
      {status === "downloading" && <span style={{ fontSize: 9, color: C.sienna, fontStyle: "italic" }}>Downloading dependency...</span>}
      {status === "error" && <span style={{ fontSize: 9, color: "#d9534f" }}>Download failed</span>}
    </div>
    
    <div 
      onClick={onToggle}
      style={{
        width: 32, height: 18, borderRadius: 9,
        background: status === "downloading" ? C.border : (enabled ? C.sienna : C.border),
        position: "relative", cursor: status === "downloading" ? "wait" : "pointer",
        opacity: status === "downloading" ? 0.6 : 1,
        transition: "background 0.2s, opacity 0.2s"
      }}
    >
      <div style={{ position: "absolute", top: 2, left: enabled ? 16 : 2, width: 14, height: 14, borderRadius: "50%", background: "white", boxShadow: "0 1px 2px rgba(0,0,0,0.1)", transition: "left 0.2s" }} />
    </div>
  </div>
);

export const RetentionSpinner = ({ value, onChange, onBlur, onAdjust }: { value: string, onChange: any, onBlur: () => void, onAdjust: (d: number) => void }) => (
  <div style={{ width: "100%", padding: "14px 20px", color: C.shadow, fontSize: 13.5, display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: SANS }}>
    <span>Video retention</span>
    <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
        <input type="text" inputMode="numeric" value={value} onChange={onChange} onBlur={onBlur} style={{ width: "42px", background: "transparent", border: `1px solid ${C.border}`, color: C.shadow, textAlign: "center", borderRadius: "4px", fontFamily: SANS, fontSize: 13.5, padding: "4px 0", outline: "none" }} />
        <div style={{ display: "flex", flexDirection: "column", gap: "2px", marginLeft: "2px" }}>
          <button style={SPINNER_BTN_STYLE} onMouseEnter={e => e.currentTarget.style.color = C.shadow} onMouseLeave={e => e.currentTarget.style.color = C.umber} onClick={() => onAdjust(1)}>{I.chevronUp(12)}</button>
          <button style={SPINNER_BTN_STYLE} onMouseEnter={e => e.currentTarget.style.color = C.shadow} onMouseLeave={e => e.currentTarget.style.color = C.umber} onClick={() => onAdjust(-1)}>{I.chevronDown(12)}</button>
        </div>
        <span style={{ fontSize: 11, color: C.sienna, marginLeft: 4 }}>days</span>
    </div>
  </div>
);

export const DefaultButton = ({ label }: { label: string }) => (
  <button
    style={{ width: "100%", textAlign: "left", background: "transparent", border: "none", padding: "14px 20px", color: C.umber, fontSize: 13.5, cursor: "pointer", display: "flex", justifyContent: "space-between", alignItems: "center", fontFamily: SANS, transition: "background 0.15s, color 0.15s" }}
    onMouseEnter={e => { e.currentTarget.style.color = C.shadow; e.currentTarget.style.background = "rgba(107,94,82,0.08)"; }}
    onMouseLeave={e => { e.currentTarget.style.color = C.umber;  e.currentTarget.style.background = "transparent"; }}
  >
    {label} <span style={{ color: C.umber }}>{I.chevronR(12)}</span>
  </button>
);