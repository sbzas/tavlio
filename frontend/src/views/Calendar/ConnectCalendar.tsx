import { useState } from "react";
import { C, SANS, SERIF } from "../../theme";
import { I } from "../../components/Icons";
import { IconLoaderQuarter } from "@tabler/icons-react";

const fieldStyle: React.CSSProperties = {
  fontFamily: SANS, fontSize: 13, padding: "8px 12px", border: "1px solid " + C.border,
  borderRadius: 8, background: C.highlight, color: C.ink, outline: "none",
};

const labelStyle: React.CSSProperties = {
  fontFamily: SANS, fontSize: 10, textTransform: "uppercase",
  letterSpacing: "0.05em", color: C.sienna, fontWeight: 500,
};

const PROVIDER_INSTRUCTIONS: Record<string, string> = {
  google:    "Go to Google Calendar → Settings → Integrate Calendar → Copy the 'Secret address in iCal format' URL.",
  apple:     "Open Apple Calendar → Click the Share icon next to your calendar → Enable 'Public Calendar' → Copy the link (webcal:// is supported!).",
  outlook:   "Open Outlook Web Settings → Calendar → Shared Calendars → Publish a Calendar → Select permissions → Copy the 'ICS link'.",
  caldotcom: "Go to Cal.com Dashboard → Settings → Calendar → Copy your private booking feed .ics URL.",
  custom:    "Paste any valid standard iCalendar (.ics) internet link.",
};

const PROVIDER_LABEL: Record<string, string> = {
  google:    "Google Calendar",
  apple:     "Apple Calendar (iCloud)",
  outlook:   "Outlook / Microsoft 365",
  caldotcom: "Cal.com",
  custom:    "Custom ICS URL",
};

export function ConnectCalendarModal({
  onClose,
  onAdd,
}: {
  onClose: () => void;
  onAdd: (name: string, provider: string, url: string) => Promise<void>;
}) {
  const [name,     setName]     = useState("");
  const [url,      setUrl]      = useState("");
  const [provider, setProvider] = useState("google");
  const [submitting, setSubmitting] = useState(false);

  const submit = () => {
    if (!name || !url || submitting) return;
    setSubmitting(true);
    onAdd(name, provider, url)
      .then(() => {
        setName(""); setUrl("");
        onClose();
      })
      .catch(err => alert("Failed to add calendar: " + err))
      .finally(() => setSubmitting(false));
  };

  return (
    <div style={{
      position: "fixed", inset: 0, background: "rgba(28,23,20,0.45)",
      display: "flex", alignItems: "center", justifyContent: "center", zIndex: 100,
    }}>
      <div style={{
        background: C.surface, border: "1px solid " + C.border, borderRadius: 12,
        padding: "24px 30px", width: "100%", maxWidth: 440, boxShadow: "0 10px 25px rgba(0,0,0,0.15)",
        position: "relative",
      }}>
        <button
          onClick={onClose}
          style={{ position: "absolute", top: 16, right: 16, background: "none", border: "none", cursor: "pointer", color: C.umber }}
        >
          {I.x(14)}
        </button>

        <div style={{ fontFamily: SERIF, fontSize: 18, fontStyle: "italic", color: C.shadow, marginBottom: 16 }}>
          Connect a calendar
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={labelStyle}>Calendar Name</label>
            <input
              type="text"
              placeholder="e.g. Work, Personal"
              value={name}
              onChange={e => setName(e.target.value)}
              style={fieldStyle}
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={labelStyle}>Provider</label>
            <select
              value={provider}
              onChange={e => setProvider(e.target.value)}
              style={{ ...fieldStyle, cursor: "pointer" }}
            >
              {Object.entries(PROVIDER_LABEL).map(([val, lbl]) => (
                <option key={val} value={val}>{lbl}</option>
              ))}
            </select>
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            <label style={labelStyle}>Secret ICS Feed URL</label>
            <input
              type="text"
              placeholder="Paste private .ics or webcal:// URL"
              value={url}
              onChange={e => setUrl(e.target.value)}
              style={{ ...fieldStyle, fontSize: 12 }}
            />
          </div>

          {/* Instructions Panel */}
          <div style={{
            background: "rgba(107,94,82,0.06)", border: "1px solid " + C.border, borderRadius: 8,
            padding: "10px 14px", marginTop: 4, display: "flex", flexDirection: "column", gap: 4
          }}>
            <span style={{ fontFamily: SANS, fontSize: 10, fontWeight: 600, color: C.umber }}>
              How to get your private feed:
            </span>
            <p style={{ fontFamily: SANS, fontSize: 11, color: C.umber, lineHeight: 1.4, margin: 0 }}>
              {PROVIDER_INSTRUCTIONS[provider]}
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, marginTop: 12 }}>
            <button
              onClick={onClose}
              style={{
                flex: 1, fontFamily: SANS, fontSize: 12, border: "1px solid " + C.border,
                borderRadius: 8, padding: "8px 12px", background: "transparent", color: C.umber, cursor: "pointer"
              }}
            >
              Cancel
            </button>
            <button
              onClick={submit}
              disabled={!name || !url || submitting}
              style={{
                flex: 1, fontFamily: SANS, fontSize: 12, border: "none", borderRadius: 8,
                padding: "8px 12px", background: C.sienna, color: C.highlight,
                cursor: (!name || !url || submitting) ? "not-allowed" : "pointer",
                opacity: (!name || !url || submitting) ? 0.6 : 1,
                display: "flex", alignItems: "center", justifyContent: "center", gap: 6
              }}
            >
              {submitting ? <IconLoaderQuarter size={13} style={{ animation: "spin 1s linear infinite" }} /> : "Connect"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
