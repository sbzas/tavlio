import { useState, useEffect } from "react";
import { C, SANS, SERIF } from "../../theme";
import type { CalEvent } from "../../types";
import { I } from "../../components/Icons";
import { fmt } from "../../mockConfig";
import { MATCH_STYLE, S, minsToLabel } from "./CalendarUtils";

interface RecordingMeta {
  durationSeconds: number;
  createdAt:       string;
  keepForever:     boolean;
}

const iconBtn: React.CSSProperties = {
  background: "transparent", border: "none", padding: 4,
  color: C.umber, cursor: "pointer", display: "flex", alignItems: "center",
};

// Private component scoped to SessionDetail
function VideoPlayer({ ev }: { ev: CalEvent }) {
  const [meta, setMeta] = useState<RecordingMeta | null | "none">(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (ev.dbID == null) { setMeta("none"); return; }
    import("../../../bindings/tavlio/dbase/store")
      .then(m => m.GetRecordingForSession(ev.dbID!))
      .then(r => setMeta(r
        ? { durationSeconds: r.DurationSeconds, createdAt: r.CreatedAt, keepForever: r.KeepForever }
        : "none"
      ))
      .catch(() => setMeta("none"));
  }, [ev.dbID]);

  const placeholder = (msg: string) => (
    <div style={{ width: "100%", aspectRatio: "16/9", background: C.shadow, borderRadius: 10, ...S.centered, marginBottom: 12 }}>
      <span style={S.bodyText}>{msg}</span>
    </div>
  );

  if (meta === null)   return placeholder("Loading recording…");
  if (meta === "none") return placeholder("No recording available");

  const src = `/recording/${ev.dbID}`;

  const autoDeleteDays = meta.keepForever ? null : (() => {
    const deletesAt = new Date(new Date(meta.createdAt).getTime() + 7 * 24 * 60 * 60 * 1000);
    return Math.max(0, Math.ceil((deletesAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
  })();

  const toggleKeepStatus = () => {
    if (ev.dbID == null) return;
    const targetState = !meta.keepForever;
    
    import("../../../bindings/tavlio/dbase/store")
      .then(m => (m as any).SetRecordingKeepStatus?.(ev.dbID!, targetState))
      .then(() => { 
        setMeta({ ...meta, keepForever: targetState }); 
        setStatusMsg(targetState ? "Saved permanently" : "Auto-delete restored");
        setTimeout(() => setStatusMsg(null), 3000); 
      })
      .catch(err => {
        console.error("Failed to update keep status:", err);
        setStatusMsg("Error updating");
        setTimeout(() => setStatusMsg(null), 3000);
      });
  };

  return (
    <div style={{ marginBottom: 12 }}>
      <video
        src={src} controls onError={() => setMeta("none")}
        style={{ width: "100%", aspectRatio: "16/9", borderRadius: 10, display: "block", background: C.shadow, outline: "none" }}
      />
      <div style={{ ...S.row, justifyContent: "space-between", marginTop: 8, alignItems: "center" }}>
        <div style={S.subLabel}>
          {meta.keepForever ? "Kept forever" : autoDeleteDays === 0 ? "Deletes today" : `Auto-deletes in ${autoDeleteDays}d`}
          {statusMsg && <span style={{ color: meta.keepForever ? C.sienna : C.umber, marginLeft: 8 }}>· {statusMsg}</span>}
        </div>
        <button
          onClick={toggleKeepStatus}
          style={{ 
            fontFamily: SANS, fontSize: 10, 
            background: meta.keepForever ? (C.sienna || "#eee") : "transparent", 
            border: "1px solid " + C.border, borderRadius: 6, padding: "3px 10px", 
            color: meta.keepForever ? C.highlight : C.umber, cursor: "pointer", transition: "all 0.2s ease"
          }}
        >
          {meta.keepForever ? "Undo Keep" : "Keep forever"}
        </button>
      </div>
    </div>
  );
}

export function SessionDetail({ ev, onClose }: { ev: CalEvent; onClose: () => void }) {
  const [summaryLines,   setSummaryLines]   = useState<string[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    if (ev.dbID == null) {
      setSummaryLines(["No context snapshots available for this session."]);
      setSummaryLoading(false);
      return;
    }
    import("../../../bindings/tavlio/dbase/store")
      .then(m => m.GetSessionSummary(ev.dbID!))
      .then(lines => setSummaryLines(lines?.length ? lines : ["No processed snapshots yet for this session."]))
      .catch(() => setSummaryLines(["Could not load session summary."]))
      .finally(() => setSummaryLoading(false));
  }, [ev.dbID]);

  useEffect(() => {
    const h = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", h);
    return () => window.removeEventListener("keydown", h);
  }, [onClose]);

  const ms = ev.match ? MATCH_STYLE[ev.match] : null;

  return (
    <div className="session-detail-panel" style={{ width: 300, flexShrink: 0, borderLeft: "1px solid " + C.border, background: C.surface, ...S.col, overflow: "hidden" }}>
      <div style={{ padding: "14px 16px 12px", borderBottom: "1px solid " + C.border, ...S.row, alignItems: "flex-start", justifyContent: "space-between", gap: 10 }}>
        <div style={{ minWidth: 0 }}>
          <div style={{ ...S.row, gap: 6, marginBottom: 4 }}>
            <div style={{ width: 8, height: 8, borderRadius: "50%", background: ev.color || C.sienna, flexShrink: 0 }} />
            <span style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 15, color: C.shadow, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ev.label}</span>
          </div>
          <div style={{ fontFamily: SANS, fontSize: 10, color: C.umber }}>
            {minsToLabel(ev.start)} – {minsToLabel(ev.end)} · {fmt(ev.end - ev.start)}
          </div>
          {ms && (
            <div style={{ ...S.row, gap: 4, marginTop: 5 }}>
              {ms.icon()}
              <span style={{ fontFamily: SANS, fontSize: 10, color: C.umber }}>{ms.label}</span>
            </div>
          )}
        </div>
        <button
          onClick={onClose}
          style={{ ...iconBtn, flexShrink: 0, marginTop: 2 }}
          onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.color = C.shadow; }}
          onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.color = C.umber; }}
        >
          {I.x(13)}
        </button>
      </div>

      <div style={{ flex: 1, overflowY: "auto", padding: "14px 16px" }}>
        <VideoPlayer ev={ev} />
        <div style={{ ...S.capsLabel, marginBottom: 8, fontSize: 10}}>Session summary</div>
        {summaryLoading ? (
          <div style={S.bodyText}>Loading snapshots…</div>
        ) : (
          <div style={{ ...S.col, gap: 8 }}>
            {summaryLines.map((line, i) => (
              <div key={i} style={{ ...S.row, gap: 8, alignItems: "flex-start" }}>
                <div style={{ width: 4, height: 4, borderRadius: "50%", background: ev.color || C.sienna, flexShrink: 0, marginTop: 6 }} />
                <span style={{ fontFamily: SANS, fontSize: 11.5, color: C.ink, lineHeight: 1.65 }}>{line}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}