import { C, SANS, SERIF } from "../../theme";
import { useWindowWidth } from "../../hooks/useWindowWidth";
import { useSettings } from "../../hooks/useSettings";
import { Divider } from "../../components/Primitives";
import { SettingToggle, RetentionSpinner, DefaultButton } from "../../components/SettingsComponents";
import { ExcludedAppsCard } from "../../components/ExcludedAppsCard";

const SECTIONS = [
  { label: "Capture",       items: ["Capture enabled", "Video retention"] },
  { label: "Privacy",       items: ["Excluded apps", "Data encryption"] },
  { label: "AI Processing", items: ["VLM Selection", "VLM enabled",] },
  { label: "Storage",       items: ["Local path", "Compression"] },
];

export function SettingsView() {
  const w        = useWindowWidth();
  const cols     = w < 720 ? 1 : 2;
  const settings = useSettings();

  function renderItem(item: string) {
    if (item === "Video retention")
      return <RetentionSpinner key={item} value={settings.retentionDays} onChange={settings.handleRetentionChange} onBlur={settings.handleRetentionBlur} onAdjust={settings.adjustRetentionDays} />;
    if (item === "VLM enabled")
      return <SettingToggle key={item} label={item} enabled={settings.vlmEnabled} status={settings.vlmStatus} onToggle={settings.toggleVLM} />;
    if (item === "Capture enabled")
      return <SettingToggle key={item} label={item} enabled={settings.captureEnabled} status={settings.captureStatus} onToggle={settings.toggleCapture} />;
    if (item === "Excluded apps")
      return <ExcludedAppsCard key={item} />;
    return <DefaultButton key={item} label={item} />;
  }

  return (
    <div style={{ paddingBottom: 90 }}>
      <div style={{ marginBottom: 28 }}>
        <div style={{ fontFamily: SANS, fontSize: 9, color: C.umber, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: 6 }}>
          Settings · {new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" })}
        </div>
        <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 22, color: C.shadow, lineHeight: 1 }}>Configure Tavlio</div>
        <div style={{ fontFamily: SANS, fontSize: 12, color: C.umber, marginTop: 7 }}>Capture, privacy, AI processing and storage preferences</div>
      </div>

      <Divider />

      <div style={{
        display: "grid",
        gridTemplateColumns: `repeat(${cols}, 1fr)`,
        alignItems: "start",
        gap: 14,
        marginTop: 18,
      }}>
        {SECTIONS.map(sec => (
          <div key={sec.label} style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 12, overflow: "hidden" }}>
            <div style={{ padding: "10px 20px", borderBottom: `1px solid ${C.border}`, fontFamily: SANS, fontSize: 9.5, color: C.sienna, letterSpacing: "0.12em", textTransform: "uppercase", background: "rgba(107,94,82,0.06)" }}>
              {sec.label}
            </div>
            <div style={{ display: "flex", flexDirection: "column" }}>
              {sec.items.map(item => renderItem(item))}
            </div>
          </div>
        ))}
      </div>

      <div style={{ marginTop: 20, fontFamily: SANS, fontSize: 10, color: C.sienna }}>
        v0.1.0-alpha · Tavlio
      </div>
    </div>
  );
}
