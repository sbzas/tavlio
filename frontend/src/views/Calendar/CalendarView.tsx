import { useState } from "react";
import { C, SANS, SERIF } from "../../theme";
import type { CalEvent } from "../../types";
import { fmt } from "../../mockConfig";
import { StatPill } from "../../components/Primitives";
import { I } from "../../components/Icons";
import { IconRefresh } from "@tabler/icons-react";

// Internal Calendar Components
import { CalBlock, IntendedGhost } from "./CalBlocks";
import { SessionDetail } from "./SessionDetail";
import { ALL_HOURS, HOUR_H, GRID_H, TOTAL_H, MATCH_STYLE, S, minsToY, minsToH, groupOverlappingSessions } from "./CalendarUtils";
import { useCalendarData } from "./CalendarData";
import { ConnectCalendarModal } from "./ConnectCalendar";
import { CalendarDock, IconList } from "./CalendarDock";

const todayPill = (active: boolean): React.CSSProperties => ({
  fontFamily: SANS, fontSize: 11,
  background: active ? "rgba(107,94,82,0.14)" : "transparent",
  border: "1px solid " + C.border, borderRadius: 7,
  padding: "5px 12px", color: C.umber, cursor: "pointer",
});

export function CalendarView() {
  const data = useCalendarData();
  const {
    dayOffset, setDayOffset, dateLabel,
    actual, loading, gridScrollRef,
    calendars, intendedEvents, hiddenCalIds, calendarConnected,
    syncing, syncAll, addCalendar, deleteCalendar, toggleCalendar,
  } = data;

  const [selectedSession, setSelectedSession] = useState<CalEvent | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showDock,    setShowDock]    = useState(false);

  const handleSync = () => {
    syncAll().catch(err => alert("Failed to sync calendars: " + err));
  };

  const intendedMins = intendedEvents.reduce((s, e) => s + (e.end - e.start), 0);
  const alignedMins  = actual.filter(e => e.match === "aligned").reduce((s, e) => s + (e.end - e.start), 0);
  const score        = intendedMins > 0 ? Math.round((alignedMins / intendedMins) * 100) : 0;
  const trackedMins  = actual.reduce((s, e) => s + (e.end - e.start), 0);
  const unplanned    = actual.filter(e => e.match === "unplanned");
  const unplannedMins = unplanned.reduce((s, e) => s + (e.end - e.start), 0);
  // group overlapping sessions before rendering
  const clusteredActual = groupOverlappingSessions(actual);

  // Clearing the detail panel on day change is done here in the handlers so a single day navigation batches into one render
  // instead of cascading a separate setSelectedSession render after the data effects
  const goDay   = (delta: number) => { setSelectedSession(null); setDayOffset(o => o + delta); };
  const goToday = () => { setSelectedSession(null); setDayOffset(0); };

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

          {calendarConnected && (
            <>
              <div style={{ width: 1, height: 16, background: C.border, margin: "0 4px" }} />
              <button onClick={handleSync} disabled={syncing} style={S.navBtn} title="Sync Calendars Now">
                <IconRefresh size={14} style={{
                  color: C.umber,
                  transform: syncing ? "rotate(360deg)" : "none",
                  transition: syncing ? "transform 1s ease" : "none",
                }} />
              </button>
              <button onClick={() => setShowAddModal(true)} style={S.navBtn} title="Add Calendar Feed">
                {I.plus(13)}
              </button>
              <button
                onClick={() => setShowDock(!showDock)}
                style={{ ...S.navBtn, background: showDock ? "rgba(107,94,82,0.18)" : S.navBtn.background }}
                title="Manage Connected Calendars"
              >
                <IconList size={14} style={{ color: C.umber }} />
              </button>
            </>
          )}
        </div>
      </div>

      {/* Stat pills */}
      <div style={{ ...S.row, gap: 10, marginBottom: 16, flexWrap: "wrap" }}>
        {trackedMins > 0 && <StatPill label="Alignment score" value={score + "%"} />}
        {calendarConnected && <StatPill label="Intended" value={fmt(intendedMins)} />}
        {trackedMins > 0 && <StatPill label="Tracked" value={fmt(trackedMins)} />}
        {trackedMins > 0 && unplanned.length > 0 && (
          <StatPill label="Unplanned" value={fmt(unplannedMins)} />
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
      <div style={{ ...S.card, display: "flex", alignItems: "stretch", position: "relative" }}>
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
                  <button onClick={() => setShowAddModal(true)} style={{ ...S.connectBtn, pointerEvents: "auto" }}>Connect →</button>
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
                const clusterEnd   = Math.max(...group.map(e => e.end));
                const displayEv    = { ...primaryEv, start: clusterStart, end: clusterEnd };

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

        {showDock && calendarConnected && (
          <CalendarDock
            calendars={calendars}
            hiddenCalIds={hiddenCalIds}
            onToggle={toggleCalendar}
            onDelete={id => deleteCalendar(id).catch(err => alert("Failed to delete calendar: " + err))}
            onClose={() => setShowDock(false)}
          />
        )}

        {selectedSession && <SessionDetail ev={selectedSession} onClose={() => setSelectedSession(null)} />}
      </div>

      {showAddModal && (
        <ConnectCalendarModal
          onClose={() => setShowAddModal(false)}
          onAdd={addCalendar}
        />
      )}
    </div>
  );
}
