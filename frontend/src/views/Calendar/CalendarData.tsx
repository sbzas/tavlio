import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { C } from "../../theme";
import type { CalEvent } from "../../types";
import { APP_TINTS } from "../../mockConfig";
import { HOUR_H } from "./CalendarUtils";
  import type { ExternalCal, ExternalCalEvent } from "../../../bindings/tavlio/dbase/models";
import {
  GetSessionsForDay,
  GetCalendars,
  AddCalendar,
  DeleteCalendar,
  GetCalendarEventsForDay,
  SyncAllCalendars,
} from "../../../bindings/tavlio/dbase/store";

/**
 *  Owns all data-fetching and mutation state for the Calendar view:
 *   - day navigation (offset / label / ISO)
 *   - tracked "actual" sessions for the selected day
 *   - configured third-party calendars + their cached "intended" events
 *   - manual sync, add, delete, toggle operations
 *
 * Presentation state (selected session, modal/dock visibility) stays in the view.
 */
export function useCalendarData() {
  const [dayOffset, setDayOffset] = useState(0);

  const [actual,   setActual]   = useState<CalEvent[]>([]);
  // Tracks which day's data is currently in `actual`
  const [loadedDay, setLoadedDay] = useState<string | null>(null);

  const [calendars,    setCalendars]    = useState<ExternalCal[]>([]);
  const [hiddenCalIds, setHiddenCalIds] = useState<number[]>([]);
  const [rawIntended,  setRawIntended]  = useState<ExternalCalEvent[]>([]);
  const [syncing,      setSyncing]      = useState(false);

  // Visibility filtering AND the no-calendars case are derived at render time
  // (useMemo) rather than inside the fetch effect, so toggling a calendar or
  // disconnecting the last one never triggers a setRawIntended([]) DB-path render.
  const intendedEvents = useMemo<CalEvent[]>(
    () => calendars.length === 0
      ? []
      : rawIntended
          .filter(ev => !hiddenCalIds.includes(ev.calendarId))
          .map((ev, i) => ({
            id: "i" + i,
            label: ev.title,
            start: ev.startMins,
            end: ev.endMins,
            color: C.rose,
            type: "intended" as const,
          })),
    [rawIntended, hiddenCalIds, calendars]
  );

  const calendarConnected = calendars.length > 0;
  const gridScrollRef = useRef<HTMLDivElement>(null);

  const targetDate = new Date();
  targetDate.setDate(targetDate.getDate() + dayOffset);
  const dateLabel = targetDate.toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  const dateISO   = targetDate.toISOString().slice(0, 10);

  // Derived loading flag:true until the fetch for the currently visible day has resolved
  const loading = loadedDay !== dateISO;

  const loadCalendars = useCallback(() => {
    GetCalendars()
      .then(c => setCalendars(c ?? []))
      .catch(() => setCalendars([]));
  }, []);

  useEffect(() => { loadCalendars(); }, [loadCalendars]);

  // Tracked sessions for the selected day
  useEffect(() => {
    let cancelled = false;
    GetSessionsForDay(dateISO)
      .then(sessions => {
        if (cancelled) return;
        const events: CalEvent[] = (sessions ?? []).map((s, i) => ({
          id: "a" + i, dbID: s.ID, label: s.AppName, app: s.AppName,
          start: s.StartMins, end: s.EndMins,
          color: APP_TINTS[s.AppName] ?? C.sienna,
          type: "actual" as const,
          match: (s.Match as CalEvent["match"]) ?? "unplanned",
        }));
        setActual(events);
        setLoadedDay(dateISO);
      })
      .catch(() => {
        if (cancelled) return;
        setActual([]);
        setLoadedDay(dateISO);
      });
    return () => { cancelled = true; };
  }, [dateISO]);

  // Intended calendar events for the selected day
  // hiddenCalIds is intentionally NOT a dep so visibility toggles stay off the DB-read path; 
  // calendars stays in deps so a fresh fetch occurs after connect/disconnect/sync
  useEffect(() => {
    if (calendars.length === 0) return;
    let cancelled = false;
    GetCalendarEventsForDay(dateISO)
      .then(events => { if (!cancelled) setRawIntended(events ?? []); })
      .catch(() => { if (!cancelled) setRawIntended([]); });
    return () => { cancelled = true; };
  }, [dateISO, calendars]);

  // Scroll the grid to ~7am on first mount
  useEffect(() => {
    gridScrollRef.current?.scrollTo({ top: 7 * HOUR_H });
  }, []);

  const addCalendar = (name: string, provider: string, url: string) =>
    AddCalendar(name, provider, url).then(() => loadCalendars());

  const deleteCalendar = (id: number) =>
    DeleteCalendar(id).then(() => {
      setHiddenCalIds(prev => prev.filter(x => x !== id));
      loadCalendars();
    });

  const toggleCalendar = (id: number) =>
    setHiddenCalIds(prev =>
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );

  const syncAll = () => {
    if (syncing) return Promise.resolve();
    setSyncing(true);
    return SyncAllCalendars()
      .then(() => loadCalendars())
      .finally(() => setSyncing(false));
  };

  return {
    // day navigation
    dayOffset, setDayOffset, dateLabel, dateISO,
    // tracked (actual)
    actual, loading, gridScrollRef,
    // intended (calendars)
    calendars, intendedEvents, hiddenCalIds, calendarConnected,
    // sync
    syncing, syncAll,
    // mutations
    addCalendar, deleteCalendar, toggleCalendar,
  };
}

export type CalendarData = ReturnType<typeof useCalendarData>;
