package dbase

import (
	"fmt"
	"net/http"
	"strings"
	"time"

	"tavlio/processing"
)

//shared across syncs so keep-alive connections are reusedrather than reallocated on every fetch
var httpClient = &http.Client{Timeout: 15 * time.Second}

type ExternalCal struct {
	ID         int64  `json:"id"`
	Name       string `json:"name"`
	Provider   string `json:"provider"`
	URL        string `json:"url"`
	LastSynced int64  `json:"lastSynced"`
}

type ExternalCalEvent struct {
	ID         string `json:"id"`
	Title      string `json:"title"`
	StartMins  int    `json:"startMins"`
	EndMins    int    `json:"endMins"`
	CalendarID int64  `json:"calendarId"`
}

// retrieves all configured third-party calendars from db
func (s *Store) GetCalendars() ([]ExternalCal, error) {
	rows, err := s.DB.Query("SELECT id, name, provider, url, last_synced FROM calendars ORDER BY name")
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var result []ExternalCal
	for rows.Next() {
		var c ExternalCal
		if err := rows.Scan(&c.ID, &c.Name, &c.Provider, &c.URL, &c.LastSynced); err != nil {
			return nil, err
		}
		result = append(result, c)
	}
	return result, rows.Err()
}

// Register a new third-party calendar and triggers an immediate async sync
func (s *Store) AddCalendar(name string, provider string, url string) (int64, error) {
	res, err := s.DB.Exec("INSERT INTO calendars (name, provider, url, last_synced) VALUES (?, ?, ?, 0)", name, provider, url)
	if err != nil {
		return 0, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return 0, err
	}

	// immediately sync the newly added calendar in the background
	go func() {
		if err := s.SyncCalendar(id); err != nil {
			fmt.Printf("[Calendar] Initial sync failed for new calendar %s: %v\n", name, err)
		}
	}()

	return id, nil
}

func (s *Store) DeleteCalendar(id int64) error {
	_, err := s.DB.Exec("DELETE FROM calendars WHERE id = ?", id)
	return err
}

func (s *Store) SyncAllCalendars() error {
	calendars, err := s.GetCalendars()
	if err != nil {
		return err
	}

	for _, cal := range calendars {
		if err := s.SyncCalendar(cal.ID); err != nil {
			fmt.Printf("[Calendar] Syncing calendar '%s' failed: %v\n", cal.Name, err)
		}
	}
	return nil
}

// Fetches and parses the ICS feed for a single calendar, updating DB
func (s *Store) SyncCalendar(calendarID int64) error {
	var url, name string
	err := s.DB.QueryRow("SELECT url, name FROM calendars WHERE id = ?", calendarID).Scan(&url, &name)
	if err != nil {
		return err
	}

	// webcal protocol support (common for Apple iCloud/calendar links)
	if after, ok :=strings.CutPrefix(url, "webcal://"); ok  {
		url = "https://" + after
	}

	req, err := http.NewRequest("GET", url, nil)
	if err != nil {
		return err
	}
	// Add a standard browser-like User-Agent header to prevent blocking by Outlook, Google, etc
	req.Header.Set("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64) TavlioCalendar/1.0")

	resp, err := httpClient.Do(req)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != http.StatusOK {
		return fmt.Errorf("http error %d", resp.StatusCode)
	}

	events, err := processing.ParseICS(resp.Body)
	if err != nil {
		return err
	}

	// single atomic transaction for saving to db
	tx, err := s.DB.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback()

	// Delete old cached events for this calendar
	_, err = tx.Exec("DELETE FROM calendar_events WHERE calendar_id = ?", calendarID)
	if err != nil {
		return err
	}

	stmt, err := tx.Prepare(`
		INSERT INTO calendar_events (id, calendar_id, title, description, start_time, end_time)
		VALUES (?, ?, ?, ?, ?, ?)
	`)
	if err != nil {
		return err
	}
	defer stmt.Close()

	for _, ev := range events {
		_, err = stmt.Exec(ev.UID, calendarID, ev.Title, ev.Description, ev.Start.Unix(), ev.End.Unix())
		if err != nil {
			return err
		}
	}

	_, err = tx.Exec("UPDATE calendars SET last_synced = ? WHERE id = ?", time.Now().Unix(), calendarID)
	if err != nil {
		return err
	}

	return tx.Commit()
}

// Returns cached calendar events for a specific day, clamped to that day
func (s *Store) GetCalendarEventsForDay(dateISO string) ([]ExternalCalEvent, error) {
	// lazy on-demand sync check
	s.triggerLazySync()

	loc := time.Local
	day, err := time.ParseInLocation(time.DateOnly, dateISO, loc)
	if err != nil {
		return nil, fmt.Errorf("GetCalendarEventsForDay: invalid date %q: %w", dateISO, err)
	}
	dayStart := day.Unix()
	dayEnd   := day.Add(24 * time.Hour).Unix()

	const q = `
		SELECT id, calendar_id, title, start_time, end_time
		FROM calendar_events
		WHERE start_time < ? AND end_time >= ?
		ORDER BY start_time`

	rows, err := s.DB.Query(q, dayEnd, dayStart)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []ExternalCalEvent
	for rows.Next() {
		var id, title string
		var startUnix, endUnix int64
		var calendarID int64

		if err := rows.Scan(&id, &calendarID, &title, &startUnix, &endUnix); err != nil {
			return nil, err
		}

		// Clamp event boundaries to the visible target day so startMins/endMins calculation remains within 0..1440
		if startUnix < dayStart {
			startUnix = dayStart
		}
		if endUnix > dayEnd {
			endUnix = dayEnd
		}

		results = append(results, ExternalCalEvent{
			ID:         id,
			Title:      title,
			StartMins:  int((startUnix - dayStart) / 60),
			EndMins:    int((endUnix - dayStart) / 60),
			CalendarID: calendarID,
		})
	}

	return results, rows.Err()
}

// Asynchronously checks if configured calendars haven't been synchronized (last 30 min)
// and then triggers sync routines for them
func (s *Store) triggerLazySync() {
	cutoff := time.Now().Unix() - 30*60
	rows, err := s.DB.Query("SELECT id FROM calendars WHERE last_synced < ?", cutoff)
	if err != nil {
		return
	}
	defer rows.Close()

	var idsToSync []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err == nil {
			idsToSync = append(idsToSync, id)
		}
	}

	if len(idsToSync) > 0 {
		// dont block the UI rendering thread
		go func() {
			for _, id := range idsToSync {
				if err := s.SyncCalendar(id); err != nil {
					fmt.Printf("[Calendar] Lazy sync failed for calendar ID %d: %v\n", id, err)
				}
			}
		}()
	}
}
