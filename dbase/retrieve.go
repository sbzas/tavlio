package dbase

import (
	"fmt"
	"time"
)

// Wails JSON-encodes these structs and the TypeScript side reads them by the same names 
type SessionRow struct {
	ID        int
	AppName   string
	StartMins int
	EndMins   int
	Match     string // "aligned" | "overran" | "unplanned" | "missed" (placeholders for now)
}

type RecordingRow struct {
	FilePath        string
	DurationSeconds int
	CreatedAt       string // RFC3339 formatted for frontend
	KeepForever     bool
}

type AppWeeklySummary struct {
	AppID    int
	Name     string
	WeekMins int
}

type DailyFocus struct {
	Day      string
	Hours    float64
	Sessions int
}

type AppUsage struct {
	AppID    int
	Name     string
	Minutes  int
	Sessions int
}

type HourlyActivity struct {
	Hour  string
	ContextSwitches int  // number of context_switch events in that hour
}

type WeeklyTotal struct {
	Week  string
	Hours float64 // total session hours in that ISO week
}

type RecentLog struct {
	App    string
	Desc   string
	Time   string // human-readable relative time
	Status string
}

type ExpiredVideo struct {
	ID   int
	Path string
}

// Return all sessions that overlap with the given calendar date (UTC)
func (s *Store) GetSessionsForDay(dateISO string) ([]SessionRow, error) {
	// Parse the date and compute the Unix range for the full day (local time)
	loc := time.Local
	//dateISO must be in "2006-01-02" format to keep consistency with frontend format
	day, err := time.ParseInLocation(time.DateOnly, dateISO, loc)
	if err != nil {
		return nil, fmt.Errorf("GetSessionsForDay: invalid date %q: %w", dateISO, err)
	}
	dayStart := day.Unix()
	dayEnd   := day.Add(24 * time.Hour).Unix()

	const q = `
		SELECT
			s.id,
			a.name,
			s.start_time,
			COALESCE(s.end_time, s.start_time) AS end_time
		FROM sessions s
		JOIN apps a ON a.id = s.app_id
		WHERE s.start_time < ? AND COALESCE(s.end_time, s.start_time) >= ?
		ORDER BY s.start_time`

	rows, err := s.DB.Query(q, dayEnd, dayStart)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	midnight := day.Unix() // seconds at 00:00 of the requested day

	var results []SessionRow
	for rows.Next() {
		var id              int
		var appName         string
		var startUnix, endUnix int64

		if err := rows.Scan(&id, &appName, &startUnix, &endUnix); err != nil {
			return nil, err
		}

		// Clamp to the visible day boundary so blocks don't extend off-screen
		if startUnix < dayStart { startUnix = dayStart }
		if endUnix   > dayEnd   { endUnix   = dayEnd   }

		results = append(results, SessionRow{
			ID:        id,
			AppName:   appName,
			StartMins: int((startUnix - midnight) / 60),
			EndMins:   int((endUnix   - midnight) / 60),
			Match:     "unplanned", // TO BE REPLACED WHEN CALENDAR DIFF FUNCTIONALITY IS READY
		})
	}
	return results, rows.Err()
}

// Return the VLM-generated descriptions from context_logs for a given session, unique and in chronological order
func (s *Store) GetSessionSummary(sessionID int) ([]string, error) {
	const q = `
		SELECT description
		FROM context_logs
		WHERE session_id = ? AND processing_status = 'processed' AND description IS NOT NULL
		GROUP BY description
		ORDER BY MIN(timestamp)`

	rows, err := s.DB.Query(q, sessionID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var lines []string
	for rows.Next() {
		var desc string
		if err := rows.Scan(&desc); err != nil {
			return nil, err
		}
		lines = append(lines, desc)
	}
	return lines, rows.Err()
}

// Retrieve the most recent recording for a session if it exists 
func (s *Store) GetRecordingForSession(sessionID int) (*RecordingRow, error) {
	const q = `
		SELECT file_path, COALESCE(duration_seconds, 0), created_at, keep_forever
		FROM recordings
		WHERE session_id = ?
		ORDER BY created_at DESC
		LIMIT 1`

	var (
		filePath    string
		durationSec int
		createdAt   int64
		keepForever bool
	)
	err := s.DB.QueryRow(q, sessionID).Scan(&filePath, &durationSec, &createdAt, &keepForever)
	if err != nil {
		// sql.ErrNoRows is not an error from the frontend's perspective
		return nil, nil
	}

	return &RecordingRow{
		FilePath:        filePath,
		DurationSeconds: durationSec,
		CreatedAt:       time.Unix(createdAt, 0).Format(time.RFC3339),
		KeepForever:     keepForever,
	}, nil
}

// Get every app that has had at least one session in the last 7 days, ordered by total time (descending)
func (s *Store) GetAllAppsWeeklySummary() ([]AppWeeklySummary, error) {
	cutoff := time.Now().AddDate(0, 0, -7).Unix()

	const q = `
		SELECT
			a.id,
			a.name,
			CAST(COALESCE(SUM(s.duration_seconds), 0) / 60 AS INTEGER) AS week_mins
		FROM apps a
		JOIN sessions s ON s.app_id = a.id
		WHERE s.start_time >= ?
		GROUP BY a.id, a.name
		ORDER BY week_mins DESC`

	rows, err := s.DB.Query(q, cutoff)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []AppWeeklySummary
	for rows.Next() {
		var r AppWeeklySummary
		if err := rows.Scan(&r.AppID, &r.Name, &r.WeekMins); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, rows.Err()
}

// Return one entry per calendar day for the last "days" days
// (today inclusive), containing total focus hours and session count.
// Days with no sessions are included as zero rows so area charts never have
// gaps
func (s *Store) GetDailyFocus(days int) ([]DailyFocus, error) {
	if days <= 0 {
		days = 30
	}

	// Build a CTE of every date in the window so zero-session days appear (recursive since SQLite has no generate_series func)
	const q = `
		WITH RECURSIVE dates(d) AS (
			SELECT date('now', 'localtime', '-' || (? - 1) || ' days')
			UNION ALL
			SELECT date(d, '+1 day')
			FROM dates
			WHERE d < date('now', 'localtime')
		)
		SELECT
			dates.d,
			COALESCE(ROUND(SUM(s.duration_seconds) / 3600.0, 1), 0.0) AS hours,
			COUNT(s.id) AS session_count
		FROM dates
		LEFT JOIN sessions s
			ON  date(s.start_time, 'unixepoch', 'localtime') = dates.d
			AND s.duration_seconds IS NOT NULL
		GROUP BY dates.d
		ORDER BY dates.d`

	rows, err := s.DB.Query(q, days)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []DailyFocus
	for rows.Next() {
		var rawDate string
		var hours    float64
		var sessions int

		if err := rows.Scan(&rawDate, &hours, &sessions); err != nil {
			return nil, err
		}

		t, err := time.ParseInLocation(time.DateOnly, rawDate, time.Local)
		if err != nil {
			return nil, fmt.Errorf("GetDailyFocus: bad date from DB %q: %w", rawDate, err)
		}

		results = append(results, DailyFocus{
			Day:      t.Format("2 Jan"),
			Hours:    hours,
			Sessions: sessions,
		})
	}
	return results, rows.Err()
}

// GetAppUsage returns per-app totals for the last `days` days, ordered by
// total time descending. Used for the horizontal bar chart on the dashboard.
func (s *Store) GetAppUsage(days int) ([]AppUsage, error) {
	if days <= 0 {
		days = 7
	}
	cutoff := time.Now().AddDate(0, 0, -days).Unix()

	const q = `
		SELECT
			a.id,
			a.name,
			CAST(COALESCE(SUM(s.duration_seconds), 0) / 60 AS INTEGER) AS minutes,
			COUNT(s.id) AS session_count
		FROM apps a
		JOIN sessions s ON s.app_id = a.id
		WHERE s.start_time >= ? AND s.duration_seconds IS NOT NULL
		GROUP BY a.id, a.name
		ORDER BY minutes DESC`

	rows, err := s.DB.Query(q, cutoff)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []AppUsage
	for rows.Next() {
		var r AppUsage
		if err := rows.Scan(&r.AppID, &r.Name, &r.Minutes, &r.Sessions); err != nil {
			return nil, err
		}
		results = append(results, r)
	}
	return results, rows.Err()
}

// Retrieve the number of context_switch events grouped by hour of day for the given date
func (s *Store) GetContextSwitchesByHour(dateISO string) ([]HourlyActivity, error) {
	loc := time.Local
	day, err := time.ParseInLocation(time.DateOnly, dateISO, loc)
	if err != nil {
		return nil, fmt.Errorf("GetContextSwitchesByHour: invalid date %q: %w", dateISO, err)
	}
	dayStart := day.Unix()
	dayEnd   := day.Add(24 * time.Hour).Unix()

	// Return all 24 hours (0–23) even if count is 0, so the bar chart always has a full x-axis
	// CTE generates the hour range whereas the LEFT JOIN fills in zeros for quiet hours
	const q = `
		WITH RECURSIVE hours(h) AS (
			SELECT 0
			UNION ALL
			SELECT h + 1 FROM hours WHERE h < 23
		)
		SELECT
			hours.h,
			COUNT(cs.id) AS cnt
		FROM hours
		LEFT JOIN context_switches cs
			ON  cs.start_time >= ?
			AND cs.start_time <  ?
			AND CAST(strftime('%H', datetime(cs.start_time, 'unixepoch', 'localtime')) AS INTEGER) = hours.h
		GROUP BY hours.h
		ORDER BY hours.h`

	rows, err := s.DB.Query(q, dayStart, dayEnd)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	var results []HourlyActivity
	for rows.Next() {
		var h, count int
		if err := rows.Scan(&h, &count); err != nil {
			return nil, err
		}
		results = append(results, HourlyActivity{
			Hour:  hourLabel(h),
			ContextSwitches: count,
		})
	}
	return results, rows.Err()
}

// Fetch one entry per ISO week for the given year, containing total session hours. No session weeks are included as zeros
func (s *Store) GetWeeklyTotals(year int) ([]WeeklyTotal, error) {
	// compute Unix boundaries for Jan 1 and Jan 1 of next year
	loc      := time.Local
	yearStart := time.Date(year,   1, 1, 0, 0, 0, 0, loc).Unix()
	yearEnd   := time.Date(year+1, 1, 1, 0, 0, 0, 0, loc).Unix()

	const q = `
		SELECT
			CAST(strftime('%W', datetime(start_time, 'unixepoch', 'localtime')) AS INTEGER) AS week_num,
			ROUND(SUM(COALESCE(duration_seconds, 0)) / 3600.0, 1) AS hours
		FROM sessions
		WHERE start_time >= ? AND start_time < ? AND duration_seconds IS NOT NULL
		GROUP BY week_num
		ORDER BY week_num`

	rows, err := s.DB.Query(q, yearStart, yearEnd)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	// map to fill mssing weeks with 0s
	byWeek := make(map[int]float64)
	maxWeek := 0
	for rows.Next() {
		var weekNum int
		var hours   float64
		if err := rows.Scan(&weekNum, &hours); err != nil {
			return nil, err
		}
		byWeek[weekNum] = hours
		if weekNum > maxWeek {
			maxWeek = weekNum
		}
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}

	// Emit W1…W52 (or up to the last week that has data, minimum 8 for the chart to look reasonable with little data)
	if maxWeek < 8 { maxWeek = 8 }

	results := make([]WeeklyTotal, 0, maxWeek)
	for w := 1; w <= maxWeek; w++ {
		results = append(results, WeeklyTotal{
			Week:  fmt.Sprintf("W%d", w),
			Hours: byWeek[w], // zero if not in map
		})
	}
	return results, nil
}

// Get the `limit` most recent context_log entries across all apps, newest first
func (s *Store) GetRecentLogs(limit int) ([]RecentLog, error) {
	if limit <= 0 {
		limit = 20
	}

	const q = `
		SELECT
			a.name,
			COALESCE(cl.description, '') AS description,
			cl.timestamp,
			cl.processing_status
		FROM context_logs cl
		JOIN sessions  s  ON s.id  = cl.session_id
		JOIN apps      a  ON a.id  = s.app_id
		GROUP BY description
		ORDER BY cl.timestamp DESC
		LIMIT ?`

	rows, err := s.DB.Query(q, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	now := time.Now()

	var results []RecentLog
	for rows.Next() {
		var (
			appName   string
			desc      string
			ts        int64
			status    string
		)
		if err := rows.Scan(&appName, &desc, &ts, &status); err != nil {
			return nil, err
		}

		// use a short human-readable relative time
		age := now.Sub(time.Unix(ts, 0))
		relTime := formatRelative(age)

		// genericc label fallback for unprocessed rows so the UI always has something to show
		if desc == "" {
			desc = "Screenshot captured"
		}

		results = append(results, RecentLog{
			App:    appName,
			Desc:   desc,
			Time:   relTime,
			Status: status,
		})
	}
	return results, rows.Err()
}

// ----- Helpers -----

// Convert an integer hour (0–23) to the compact label format the frontend'd expect: 0→"12a", 12→"12p", 13→"1p"
func hourLabel(h int) string {
	switch {
	case h == 0:
		return "12a"
	case h < 12:
		return fmt.Sprintf("%da", h)
	case h == 12:
		return "12p"
	default:
		return fmt.Sprintf("%dp", h-12)
	}
}

// Turn a duration into a short human string ("2min ago", "3h ago", "2d ago")
func formatRelative(d time.Duration) string {
	switch {
	case d < time.Minute:
		return "just now"
	case d < time.Hour:
		return fmt.Sprintf("%dmin ago", int(d.Minutes()))
	case d < 24*time.Hour:
		return fmt.Sprintf("%dh ago", int(d.Hours()))
	default:
		return fmt.Sprintf("%dd ago", int(d.Hours()/24))
	}
}

// get automatic video retention time limit or default to standard  limit
func (s *Store) GetVideoRetentionLimit(key string, defaultLimit int) int {
	var val int
	err := s.DB.QueryRow("SELECT CAST(value AS INTEGER) FROM user_preferences WHERE key = ?", key).Scan(&val)
	if err != nil {
		return defaultLimit
	}

	return val
}

// Find recordings past the cutoff date that are NOT marked to be kept forever
func (s *Store) GetExpiredRecordings(cutoffUnix int64) ([]ExpiredVideo, error) {
	rows, err := s.DB.Query(`
		SELECT id, file_path 
		FROM recordings 
		WHERE keep_forever = 0 AND created_at < ?
	`, cutoffUnix)

	if err != nil {
		return nil, err
	}

	defer rows.Close()

	var results []ExpiredVideo
	for rows.Next() {
		var v ExpiredVideo
		if err := rows.Scan(&v.ID, &v.Path); err == nil {
			results = append(results, v)
		}
	}

	return results, nil
}

func (s *Store) GetUserPreference(key string, defaultValue string) string {
    var value string
    err := s.DB.QueryRow("SELECT value FROM user_preferences WHERE key = ?", key).Scan(&value)
    if err != nil {
        return defaultValue
    }
    return value
}