package dbase

import (
	"fmt"
	"math/rand"
	"time"
)

var mockApps = []string{
	"VS Code", "Firefox", "Google Chrome", "Safari", "Spotify",
	"Steam", "Discord", "Slack", "Terminal", "iTerm2",
	"Xcode", "IntelliJ IDEA", "Notion", "Obsidian", "Zoom",
	"Microsoft Teams", "Figma", "Mail", "Apple Music", "Postman",
}

var mockDescriptions = map[string][]string{
	"VS Code":       {"Writing Go code", "Debugging frontend", "Editing JSON config", "Reviewing pull request"},
	"Google Chrome": {"Browsing StackOverflow", "Reading documentation", "Checking GitHub", "Watching a tutorial"},
	"Figma":         {"Designing UI components", "Tweaking auto-layout", "Exporting SVG assets"},
	"Spotify":       {"Browsing playlists", "Playing 'Focus' mix"},
	"Slack":         {"Replying to team channel", "Reading announcements", "Direct messaging a coworker"},
}

// Fill the database with "daysAgo" days of realistic fake activity
func (s *Store) SeedMockData() error {
	// Prevent seeding if data already exists
	var count int
	err := s.DB.QueryRow("SELECT COUNT(*) FROM sessions").Scan(&count)
	if err != nil {
		return fmt.Errorf("failed to check existing sessions: %w", err)
	}
	if count > 0 {
		return fmt.Errorf("SeedMockData: database already contains %d sessions, aborting", count)
	}

	// Begin Transaction for fast bulk inserts
	tx, err := s.DB.Begin()
	if err != nil {
		return fmt.Errorf("failed to begin transaction: %w", err)
	}

	// Rollback if something fails (does nothing if Commit is successful)
	defer tx.Rollback()

	// seed db with app names
	appIDs := make(map[string]int)
	for _, appName := range mockApps {
		_, err := tx.Exec("INSERT OR IGNORE INTO apps (name) VALUES (?)", appName)
		if err != nil {
			return fmt.Errorf("failed to insert app %s: %w", appName, err)
		}
		
		// Get the ID (either newly inserted or existing)
		var id int
		err = tx.QueryRow("SELECT id FROM apps WHERE name = ?", appName).Scan(&id)
		if err != nil {
			return fmt.Errorf("failed to get app ID for %s: %w", appName, err)
		}
		appIDs[appName] = int(id)
	}

	// seed Sessions and associated data for the last "daysAgo" days
	rng := rand.New(rand.NewSource(time.Now().UnixNano()))
	now := time.Now()

	for daysAgo := 365; daysAgo >= 0; daysAgo-- {
		// Start day around 9:00 AM
		dayStart := now.AddDate(0, 0, -daysAgo).Truncate(24 * time.Hour).Add(9 * time.Hour)
		currentTime := dayStart.Unix()

		// 3 to 7 sessions per day
		numSessions := rng.Intn(5) + 3

		for range numSessions {
			app := mockApps[rng.Intn(len(mockApps))]
			appID := appIDs[app]

			// 15 mins to 3 hours per session
			durationSecs := rng.Intn(10800) + 900
			endTime := currentTime + int64(durationSecs)

			// inser session and recording
			res, err := tx.Exec(`
				INSERT INTO sessions (app_id, start_time, end_time, duration_seconds) 
				VALUES (?, ?, ?, ?)`,
				appID, currentTime, endTime, durationSecs,
			)
			if err != nil {
				return fmt.Errorf("failed to insert session: %w", err)
			}
			sessionID, _ := res.LastInsertId()

			filePath := "./test_data/videos/test_video.mp4"
			keepForever := 0
			if rng.Intn(2) == 1 { keepForever = 1 }
			
			_, err = tx.Exec(`
				INSERT INTO recordings (session_id, file_path, start_time, duration_seconds, keep_forever) 
				VALUES (?, ?, ?, ?, ?)`,
				sessionID, filePath, currentTime, durationSecs, keepForever,
			)
			if err != nil {
				return fmt.Errorf("failed to insert recording: %w", err)
			}

			// Insert Context Logs (Screenshots) - 1 every ~5 minutes
			for ts := currentTime + 300; ts < endTime; ts += int64(rng.Intn(300) + 150) {
				descList := mockDescriptions[app]
				desc := "Interacting with application"
				if len(descList) > 0 {
					desc = descList[rng.Intn(len(descList))]
				}

				imgPath := fmt.Sprintf("/screenshots/img_%d.jpg", ts)
				hash := fmt.Sprintf("hash_%d", rng.Intn(999999))

				_, err = tx.Exec(`
					INSERT INTO context_logs (session_id, timestamp, image_path, description, processing_status, perceptual_hash) 
					VALUES (?, ?, ?, ?, ?, ?)`,
					sessionID, ts, imgPath, desc, "processed", hash,
				)
				if err != nil {
					return fmt.Errorf("failed to insert context log: %w", err)
				}

				// 20% chance to have a quick context switch
				if rng.Intn(100) < 20 {
					switchApp := "Slack"
					if app == "Slack" { switchApp = "Spotify" }
					switchDuration := rng.Intn(60) + 10

					_, err = tx.Exec(`
						INSERT INTO context_switches (session_id, app_name, start_time, duration_seconds) 
						VALUES (?, ?, ?, ?)`,
						sessionID, switchApp, ts, switchDuration,
					)
					if err != nil {
						return fmt.Errorf("failed to insert context switch: %w", err)
					}
				}
			}

			// Advance time to the next session (10 mins to 1 hour break)
			currentTime = endTime + int64(rng.Intn(3600)+600)
		}
	}

	return tx.Commit()
}
