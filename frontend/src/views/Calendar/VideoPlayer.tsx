import { useState, useEffect } from "react";
import { C, SANS } from "../../theme";
import type { CalEvent } from "../../types";
import { I } from "../../components/Icons";
import { GetRecordingForSession, SetRecordingKeepStatus, GetVideoRetentionLimit } from "../../../bindings/tavlio/dbase/store";
import { S } from "./CalendarUtils";

interface RecordingMeta {
  durationSeconds: number;
  createdAt:       string;
  keepForever:     boolean;
}

// Compute how many days remain before a recording is auto-deleted.
// Invoked only from effects / event handlers (never during render) since it
// reads the current time, which is an impure, non-idempotent operation.
function computeDaysRemaining(meta: RecordingMeta, retentionDays: number): number {
  const deletesAt = new Date(new Date(meta.createdAt).getTime() + retentionDays * 24 * 60 * 60 * 1000);
  return Math.max(0, Math.ceil((deletesAt.getTime() - Date.now()) / (24 * 60 * 60 * 1000)));
}

export function VideoPlayer({ ev }: { ev: CalEvent }) {
  const [meta, setMeta] = useState<RecordingMeta | null | "none">(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [retentionDays, setRetentionDays] = useState<number>(3);
  const [daysRemaining, setDaysRemaining] = useState<number | null>(null);
  // The <video> element is only mounted once the user explicitly presses play.
  // This keeps the webview's media pipeline dormant while the sidepanel is
  // open, so merely viewing a session's details no longer allocates the
  // decoder / GPU video context that drives the RAM spike.
  const [started, setStarted] = useState(false);
  // A server-side cached first-frame JPG powers the blurred backdrop on the
  // play button. If it can't be generated/served we fall back to the solid
  // color so the UI never breaks.
  const [thumbFailed, setThumbFailed] = useState(false);

  // Listen for live retention updates from the settings
  useEffect(() => {
    const handleRetentionUpdate = (e: Event) => {
      const days = (e as CustomEvent<number>).detail;
      if (typeof days !== "number") return;
      setRetentionDays(days);
      if (meta && meta !== "none" && !meta.keepForever) {
        setDaysRemaining(computeDaysRemaining(meta, days));
      }
    };

    window.addEventListener("retentionChanged", handleRetentionUpdate);
    return () => window.removeEventListener("retentionChanged", handleRetentionUpdate);
  }, [meta]);

  // Fetch recording metadata on mount / when the session changes.
  // This is a cheap DB lookup — it never touches the media stack.
  useEffect(() => {
    if (ev.dbID == null) return; // render handles the empty state
    let isMounted = true;

    Promise.all([
      GetRecordingForSession(ev.dbID).catch(() => null),
      GetVideoRetentionLimit("video_retention_days", 3).catch(() => 3),
    ]).then(([r, days]) => {
      if (!isMounted) return;
      setRetentionDays(days);
      if (r) {
        const m: RecordingMeta = {
          durationSeconds: r.DurationSeconds,
          createdAt: r.CreatedAt,
          keepForever: r.KeepForever,
        };
        setMeta(m);
        setDaysRemaining(m.keepForever ? null : computeDaysRemaining(m, days));
      } else {
        setMeta("none");
      }
    });

    return () => { isMounted = false; };
  }, [ev.dbID]);

  const placeholder = (msg: string) => (
    <div style={{ width: "100%", aspectRatio: "16/9", background: C.shadow, borderRadius: 10, ...S.centered, marginBottom: 12 }}>
      <span style={S.bodyText}>{msg}</span>
    </div>
  );

  if (ev.dbID == null) return placeholder("No recording available");
  if (meta === null)   return placeholder("Loading recording…");
  if (meta === "none") return placeholder("No recording available");

  const src = `/recording/${ev.dbID}`;

  const toggleKeepStatus = async () => {
    if (ev.dbID == null) return; // meta is already narrowed to RecordingMeta here
    const targetState = !meta.keepForever;

    try {
      await SetRecordingKeepStatus(ev.dbID, targetState);
      const updated: RecordingMeta = { ...meta, keepForever: targetState };
      setMeta(updated);
      setDaysRemaining(targetState ? null : computeDaysRemaining(updated, retentionDays));
      setStatusMsg(targetState ? "Saved permanently" : "Auto-delete restored");
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      console.error("Failed to update keep status:", err);
      setStatusMsg("Error updating");
      setTimeout(() => setStatusMsg(null), 3000);
    }
  };

  return (
    <div style={{ marginBottom: 12 }}>
      {started ? (
        // Only now do we instantiate the media pipeline. autoPlay begins
        // playback immediately since the user already pressed play.
        <video
          src={src} autoPlay controls onError={() => setMeta("none")}
          style={{ width: "100%", aspectRatio: "16/9", borderRadius: 10, display: "block", background: C.shadow, outline: "none" }}
        />
      ) : (
        <button
          onClick={() => setStarted(true)}
          title="Play recording"
          style={{
            position: "relative", width: "100%", aspectRatio: "16/9", borderRadius: 10,
            display: "flex", alignItems: "center", justifyContent: "center", gap: 8,
            background: C.shadow, border: "none", cursor: "pointer", padding: 0, overflow: "hidden",
          }}
        >
          {/* blurred first-frame backdrop; onError hides it so C.shadow shows through */}
          {!thumbFailed && (
            <img
              src={`/recording/${ev.dbID}/thumb`}
              alt=""
              onError={() => setThumbFailed(true)}
              style={{
                position: "absolute", inset: 0, width: "100%", height: "100%",
                objectFit: "cover", filter: "blur(8px) brightness(1.15)", transform: "scale(1.12)", opacity: 0.9,
              }}
            />
          )}
          {/* light scrim for icon legibility that still lets the backdrop show through */}
          <span style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.15)" }} />
          <span style={{ position: "relative", display: "flex", color: C.highlight, opacity: 0.95, zIndex: 1 }}>{I.play(26)}</span>
          <span style={{ position: "relative", fontFamily: SANS, fontSize: 11, color: C.highlight, opacity: 0.85, zIndex: 1 }}>
            {Math.round(meta.durationSeconds / 60)} min recording
          </span>
        </button>
      )}
      <div style={{ ...S.row, justifyContent: "space-between", marginTop: 8, alignItems: "center" }}>
        <div style={S.subLabel}>
          {meta.keepForever ? "Kept forever" : daysRemaining === 0 ? "Deletes today" : `Auto-deletes in ${daysRemaining}d`}
          {statusMsg && <span style={{ color: meta.keepForever ? C.sienna : C.umber, marginLeft: 8 }}>· {statusMsg}</span>}
        </div>
        <button
          onClick={toggleKeepStatus}
          style={{ fontFamily: SANS, fontSize: 10, background: meta.keepForever ? (C.sienna || "#eee") : "transparent", border: "1px solid " + C.border, borderRadius: 6, padding: "3px 10px", color: meta.keepForever ? C.highlight : C.umber, cursor: "pointer", transition: "all 0.2s ease" }}
        >
          {meta.keepForever ? "Undo Keep" : "Keep forever"}
        </button>
      </div>
    </div>
  );
}
