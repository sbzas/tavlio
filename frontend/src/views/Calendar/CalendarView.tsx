import { useState, useEffect, useRef } from "react";
import { C, SANS, SERIF } from "../../theme";
import type { CalEvent } from "../../types";
import { APP_TINTS, INTENDED_EVENTS, fmt } from "../../mockConfig";
import { StatPill } from "../../components/Primitives";
import { I } from "../../components/Icons";

// Internal Calendar Components
import { CalBlock, IntendedGhost } from "./CalBlocks";
import { SessionDetail } from "./SessionDetail";
import { ALL_HOURS, HOUR_H, GRID_H, TOTAL_H, MATCH_STYLE, S, minsToY, minsToH, groupOverlappingSessions } from "./CalendarUtils";

const todayPill = (active: boolean): React.CSSProperties => ({
  fontFamily: SANS, fontSize: 11,
  background: active ? "rgba(107,94,82,0.14)" : "transparent",
  border: "1px solid " + C.border, borderRadius: 7,
  padding: "5px 12px", color: C.umber, cursor: "pointer",
});

export function CalendarView() {
  const [dayOffset,       setDayOffset]       = useState(0);
  const [selectedSession, setSelectedSession] = useState<CalEvent | null>(null);
  const [actual,          setActual]          = useState<CalEvent[]>([]);
  const [loading,         setLoading]         = useState(true);

  const calendarConnected = false;
  const intendedEvents = calendarConnected ? INTENDED_EVENTS : [];
  const gridScrollRef  = useRef<HTMLDivElement>(null);

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + dayOffset);
  const dateLabel = targetDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const dateISO   = targetDate.toISOString().slice(0, 10);

  useEffect(() => {
    gridScrollRef.current?.scrollTo({ top: 7 * HOUR_H });
  }, []);

  useEffect(() => {
    setLoading(true);
    setSelectedSession(null);
    import("../../../bindings/tavlio/dbase/store")
      .then(m => m.GetSessionsForDay(dateISO))
      .then(sessions => {
        const events: CalEvent[] = (sessions ?? []).map((s, i) => ({
          id: "a" + i, dbID: s.ID, label: s.AppName, app: s.AppName,
          start: s.StartMins, end: s.EndMins,
          color: APP_TINTS[s.AppName] ?? C.sienna,
          type: "actual" as const,
          match: (s.Match as CalEvent["match"]) ?? "unplanned",
        }));
        setActual(events);
      })
      .catch(() => setActual([]))
      .finally(() => setLoading(false));
  }, [dateISO]);

  const intendedMins = intendedEvents.reduce((s, e) => s + (e.end - e.start), 0);
  const alignedMins  = actual.filter(e => e.match === "aligned").reduce((s, e) => s + (e.end - e.start), 0);
  const score        = intendedMins > 0 ? Math.round((alignedMins / intendedMins) * 100) : 0;
  const trackedMins  = actual.reduce((s, e) => s + (e.end - e.start), 0);
  // group overlapping sessions before rendering
  const clusteredActual = groupOverlappingSessions(actual);

  const goDay   = (delta: number) => setDayOffset(o => o + delta);
  const goToday = () => setDayOffset(0);

  return (
    <div style={{ paddingBottom: 90 }}>
      {/* Header */}
      <div style={{ ...S.row, justifyContent: "space-between", marginBottom: 6 }}>
        <div>
          <div style={{ ...S.capsLabel, marginBottom: 4 }}>Calendar · intended vs actual</div>
          <div style={{ fontFamily: SERIF, fontStyle: "italic", fontSize: 20, color: C.shadow }}>{dateLabel}</div>
        </div>
        <div style={{ ...S.row, gap: 8 }}>
          <button onClick={() => goDay(-1)} style={S.navBtn}>{I.chevronL(13)}</button>
          <button onClick={goToday} style={todayPill(dayOffset === 0)}>Today</button>
          <button onClick={() => goDay(1)}  style={S.navBtn}>{I.chevronR(13)}</button>
        </div>
      </div>

      {/* Stat pills */}
      <div style={{ ...S.row, gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {trackedMins > 0 && <StatPill label="Alignment score" value={score + "%"} />}
        {calendarConnected && <StatPill label="Intended" value={fmt(intendedMins)} />}
        {trackedMins > 0 && <StatPill label="Tracked" value={fmt(trackedMins)} />}
        {trackedMins > 0 && actual.filter(e => e.match === "unplanned").length > 0 && (
          <StatPill label="Unplanned" value={fmt(actual.filter(e => e.match === "unplanned").reduce((s, e) => s + (e.end - e.start), 0))} />
        )}
      </div>

      {/* Legend */}
      <div style={{ ...S.row, gap: 16, marginBottom: 12, flexWrap: "wrap" }}>
        {Object.entries(MATCH_STYLE).map(([key, val]) => (
          <div key={key} style={{ ...S.row, gap: 5, fontFamily: SANS, fontSize: 10, color: C.umber }}>
            {val.icon()} <span>{val.label}</span>
          </div>
        ))}
        {!selectedSession && actual.length > 0 && (
          <div style={{ fontFamily: SANS, fontSize: 10, color: C.sienna, marginLeft: "auto", fontStyle: "italic" }}>
            Click a tracked session to view recording
          </div>
        )}
      </div>

      {/* Column headers */}
      <div style={{ ...S.row, marginBottom: 0 }}>
        <div style={{ width: 44, flexShrink: 0 }} />
        <div style={{
          overflow: "hidden", transition: "width 0.32s cubic-bezier(.4,0,.2,1), opacity 0.22s",
          width: selectedSession ? 0 : "50%", opacity: selectedSession ? 0 : 1, flexShrink: 0,
        }}>
          <div style={{ padding: "0 0 8px 10px" }}><span style={S.capsLabel}>Intended · calendar</span></div>
        </div>
        <div style={{ flex: 1, ...S.capsLabel, padding: "0 0 8px 10px" }}>Tracked · Tavlio</div>
      </div>

      {/* Outer card */}
      <div style={{ ...S.card, display: "flex", alignItems: "stretch" }}>
        <div ref={gridScrollRef} style={{ flex: 1, minWidth: 0, height: GRID_H, overflowY: "auto" }}>
          <div style={{ display: "flex", height: TOTAL_H }}>

            {/* Hour labels */}
            <div style={{ width: 44, flexShrink: 0, borderRight: "1px solid " + C.border }}>
              {ALL_HOURS.map(h => (
                <div key={h} style={{ height: HOUR_H, display: "flex", alignItems: "flex-start", justifyContent: "flex-end", paddingRight: 8, paddingTop: 4 }}>
                  <span style={{ fontFamily: SANS, fontSize: 9, color: C.umber, whiteSpace: "nowrap" }}>
                    {h % 12 === 0 ? 12 : h % 12}{h < 12 ? "a" : "p"}
                  </span>
                </div>
              ))}
            </div>

            {/* Intended column */}
            <div
              onClick={() => { if (selectedSession) setSelectedSession(null); }}
              title={selectedSession ? "Click to restore" : undefined}
              style={{
                position: "relative", height: TOTAL_H, borderRight: "1px solid " + C.border, overflow: "clip",
                cursor: selectedSession ? "pointer" : "default",
                width: selectedSession ? 10 : "50%", flexShrink: 0,
                transition: "width 0.32s cubic-bezier(.4,0,.2,1)",
              }}
            >
              <div style={{ filter: (!calendarConnected && !selectedSession) ? "blur(4px)" : "none" }}>
                {ALL_HOURS.map((_, i) => (
                  <div key={i} style={{ ...S.hrLine, top: i * HOUR_H, opacity: selectedSession ? 0 : 1, transition: "opacity 0.18s" }} />
                ))}
              </div>

              {!calendarConnected && !selectedSession && (
                <div style={{
                  position: "sticky", top: GRID_H / 2 - 52, display: "flex", flexDirection: "column",
                  alignItems: "center", gap: 10, padding: "0 20px", zIndex: 2, pointerEvents: "none",
                }}>
                  <span style={{ color: C.sand, opacity: 0.5, display: "flex" }}>{I.calendar(22)}</span>
                  <p style={{
                    fontFamily: SANS, fontSize: 11, color: C.umber, textAlign: "center", lineHeight: 1.6, 
                    opacity: 0.75, maxWidth: 175, background: C.surface, padding: "4px 10px", borderRadius: 6,
                  }}>Connect a calendar to see your intended schedule here</p>
                  <button style={{ ...S.connectBtn, pointerEvents: "auto" }}>Connect →</button>
                </div>
              )}

              {calendarConnected && !selectedSession && intendedEvents.map(ev => (
                <CalBlock key={ev.id} ev={ev} col="intended" selected={false} />
              ))}

              {calendarConnected && intendedEvents.map(ev => (
                <div key={"stripe-" + ev.id} style={{
                  position: "absolute", left: 2, width: 5, top: minsToY(ev.start), height: minsToH(ev.start, ev.end),
                  background: ev.color || C.sand, borderRadius: 2,
                  opacity: selectedSession ? 0.75 : 0, transition: "opacity 0.18s 0.20s",
                }} />
              ))}
            </div>

            {/* Tracked column */}
            <div style={{ position: "relative", height: TOTAL_H, flex: 1 }}>
              {ALL_HOURS.map((_, i) => (
                <div key={i} style={{ ...S.hrLine, top: i * HOUR_H }} />
              ))}

              {loading && (
                <div style={{ position: "absolute", inset: 0, ...S.centered }}>
                  <span style={{ ...S.bodyText, background: C.surface, padding: "3px 10px", borderRadius: 6 }}>Loading sessions…</span>
                </div>
              )}

              <div style={{ filter: (!loading && actual.length === 0) ? "blur(4px)" : "none", transition: "filter 0.2s" }}>
                {!loading && intendedEvents.map(ev => (
                  <IntendedGhost key={"ghost-" + ev.id} ev={ev} />
                ))}
              </div>

              {!loading && actual.length === 0 && (
                <div style={{ position: "sticky", top: GRID_H / 2 - 12, display: "flex", justifyContent: "center", zIndex: 2, pointerEvents: "none" }}>
                  <span style={{ ...S.bodyText, opacity: 0.7, background: C.surface, padding: "3px 10px", borderRadius: 6 }}>Nothing tracked yet today</span>
                </div>
              )}

                {clusteredActual.map(group => {
                  // first item is our primary session (the longest one starting earliest)
                  const primaryEv = group[0];
                  const hiddenCount = group.length - 1;
                  
                  // merge boundaries so the cal block stretches to cover the entire cluster's time span
                  const clusterStart = Math.min(...group.map(e => e.start));
                  const clusterEnd = Math.max(...group.map(e => e.end));
                  const displayEv = { ...primaryEv, start: clusterStart, end: clusterEnd };

                  return (
                    <CalBlock
                      key={primaryEv.id} 
                      ev={displayEv} 
                      col="actual"
                      selected={selectedSession?.id === primaryEv.id}
                      onClick={() => setSelectedSession(selectedSession?.id === primaryEv.id ? null : primaryEv)}
                      hiddenCount={hiddenCount} 
                    />
                  );
                })}
            </div>
          </div>
        </div>
        {selectedSession && <SessionDetail ev={selectedSession} onClose={() => setSelectedSession(null)} />}
      </div>
    </div>
  );
}