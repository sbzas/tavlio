import { useState, useEffect } from "react";
import { C, SANS, SERIF } from "../../theme";
import type { CalEvent } from "../../types";
import { I } from "../../components/Icons";
import { fmt } from "../../mockConfig";
import { MATCH_STYLE, S, minsToLabel } from "./CalendarUtils";
import { VideoPlayer } from "./VideoPlayer";

import { GetSessionSummary } from "../../../bindings/tavlio/dbase/store";

const iconBtn: React.CSSProperties = {
  background: "transparent", border: "none", padding: 4,
  color: C.umber, cursor: "pointer", display: "flex", alignItems: "center",
};

export function SessionDetail({ ev, onClose }: { ev: CalEvent; onClose: () => void }) {
  const [summaryLines,   setSummaryLines]   = useState<string[]>([]);
  const [summaryLoading, setSummaryLoading] = useState(true);

  useEffect(() => {
    if (ev.dbID == null) return; // render handles the empty state
    let isMounted = true;

    GetSessionSummary(ev.dbID)
      .then(lines => {
        if (isMounted) setSummaryLines(lines?.length ? lines : ["No processed snapshots yet for this session."]);
      })
      .catch(() => {
        if (isMounted) setSummaryLines(["Could not load session summary."]);
      })
      .finally(() => {
        if (isMounted) setSummaryLoading(false);
      });

    return () => { isMounted = false; };
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
        <VideoPlayer key={ev.dbID} ev={ev} />
        <div style={{ ...S.capsLabel, marginBottom: 8, fontSize: 10}}>Session summary</div>
        {ev.dbID == null ? (
          <div style={S.bodyText}>No context snapshots available for this session.</div>
        ) : summaryLoading ? (
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
