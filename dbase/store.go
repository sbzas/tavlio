package dbase

import (
	"database/sql"
	"fmt"
	"time"

	_ "modernc.org/sqlite"
)

type Store struct {
    DB *sql.DB
}

// hold the data needed by the VLM Batch Processor
type PendingImage struct {
    ID        int
    SessionID int
    Path      string
}

func NewStore(dbPath string) (*Store, error) {
    db, err := sql.Open("sqlite", dbPath+"?_pragma=journal_mode=WAL&_pragma=busy_timeout=5000")
    if err != nil {
        return nil, err
    }

    s := &Store{DB: db}
    if err := s.createSchema(); err != nil {
        return nil, err
    }
    
    return s, nil
}

func (s *Store) createSchema() error {
    const schema = `
    CREATE TABLE IF NOT EXISTS apps (
        id INTEGER PRIMARY KEY,
        name TEXT NOT NULL UNIQUE
    );
    CREATE TABLE IF NOT EXISTS sessions (
        id INTEGER PRIMARY KEY,
        app_id INTEGER NOT NULL,
        start_time INTEGER NOT NULL,
        end_time INTEGER,
        duration_seconds INTEGER,
        FOREIGN KEY(app_id) REFERENCES apps(id)
    );
    CREATE TABLE IF NOT EXISTS context_logs (
        id INTEGER PRIMARY KEY,
        session_id INTEGER NOT NULL,
        timestamp INTEGER NOT NULL,
        image_path TEXT NOT NULL,
        description TEXT,
        processing_status TEXT DEFAULT 'pending',
        perceptual_hash TEXT,
        FOREIGN KEY(session_id) REFERENCES sessions(id)
    );
    CREATE TABLE IF NOT EXISTS context_switches (
        id INTEGER PRIMARY KEY,
        session_id INTEGER NOT NULL,
        app_name TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        duration_seconds INTEGER NOT NULL,
        FOREIGN KEY(session_id) REFERENCES sessions(id)
    );
    CREATE TABLE IF NOT EXISTS recordings (
        id INTEGER PRIMARY KEY,
        session_id INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        duration_seconds INTEGER,
        keep_forever BOOLEAN DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE TABLE IF NOT EXISTS user_preferences (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS context_search USING fts5(
        description, 
        content='context_logs', 
        content_rowid='id'
    );
    CREATE TRIGGER IF NOT EXISTS context_logs_ai AFTER INSERT ON context_logs BEGIN
        INSERT INTO context_search(rowid, description) VALUES (new.id, new.description);
    END;
    CREATE TRIGGER IF NOT EXISTS context_logs_ai_update AFTER UPDATE OF description ON context_logs 
    BEGIN
        INSERT INTO context_search(context_search, rowid, description) VALUES ('delete', old.id, old.description);
        INSERT INTO context_search(rowid, description) VALUES (new.id, new.description);
    END;
    `
    _, err := s.DB.Exec(schema)

    return err
}

func (s *Store) LogSessionStart(appName string) (int64, error) {
    _, err := s.DB.Exec("INSERT OR IGNORE INTO apps (name) VALUES (?)", appName)
    if err != nil { return 0, err }

    var appId int
    err = s.DB.QueryRow("SELECT id FROM apps WHERE name = ?", appName).Scan(&appId)
    if err != nil { return 0, err }

    res, err := s.DB.Exec("INSERT INTO sessions (app_id, start_time) VALUES (?, ?)", appId, time.Now().Unix())
    if err != nil { return 0, err }
    
    return res.LastInsertId()
}

func (s *Store) LogScreenshot(sessionID int64, path string, hash string, status string) error {
    _, err := s.DB.Exec(`
        INSERT INTO context_logs (session_id, timestamp, image_path, perceptual_hash, processing_status)
        VALUES (?, ?, ?, ?, ?)`, 
        sessionID, time.Now().Unix(), path, hash, status)

    return err
}

// record a brief distraction that occurred during a main session
func (s *Store) LogContextSwitch(sessionID int64, appName string, startTime int64, durationSec int) error {
    _, err := s.DB.Exec(`
        INSERT INTO context_switches (session_id, app_name, start_time, duration_seconds)
        VALUES (?, ?, ?, ?)`,
        sessionID, appName, startTime, durationSec)
    return err
}

func (s *Store) LogRecording(sessionID int64, filePath string, startTime int64, duration int) error {
    _, err := s.DB.Exec(`
        INSERT INTO recordings (session_id, file_path, start_time, duration_seconds)
        VALUES (?, ?, ?, ?)`,
        sessionID, filePath, startTime, duration)

    return err
}

// retrieve images and their associated session ID
func (s *Store) GetPendingImages(limit int, maxTimestamp int64) ([]PendingImage, error) {
    rows, err := s.DB.Query(`SELECT id, session_id, image_path 
                            FROM context_logs 
                            WHERE processing_status = 'pending' AND timestamp <= ? 
                            LIMIT ?`, maxTimestamp, limit)
    if err != nil { return nil, err }
    defer rows.Close()

    var results []PendingImage
    for rows.Next() {
        var r PendingImage
        if err := rows.Scan(&r.ID, &r.SessionID, &r.Path); err != nil {
            fmt.Printf("DB Scan Error: %v\n", err)
            continue
        }
        results = append(results, r)

    }
    return results, nil
}

func (s *Store) UpdateDescription(id int, description string) error {
    _, err := s.DB.Exec("UPDATE context_logs SET description = ?, processing_status = 'processed' WHERE id = ?", description, id)

    return err
}

// safely extend the current session and recording durations
func (s *Store) UpdateSessionHeartbeat(sessionID int64, startTime time.Time, currentTime time.Time) error {
    durationSec := int(currentTime.Sub(startTime).Seconds())

    // update the session's running duration
    _, err := s.DB.Exec(`
        UPDATE sessions 
        SET end_time = ?, duration_seconds = ? 
        WHERE id = ?`, 
        currentTime.Unix(), durationSec, sessionID)
        
    if err != nil { return err }
    
    // update the main video's duration (if it has been logged yet)
    _, err = s.DB.Exec(`
        UPDATE recordings 
        SET duration_seconds = ? 
        WHERE session_id = ?`, 
        durationSec, sessionID)
        
    return err
}


// update the session ID for a screenshot (for when grace period commits to a new session)
func (s *Store) UpdateScreenshotSession(imagePath string, newSessionID int64) error {
    _, err := s.DB.Exec(`
        UPDATE context_logs 
        SET session_id = ? 
        WHERE image_path = ?`, 
        newSessionID, imagePath)
        
    return err
}

// Find any 'pending' rows older than 24 hours and mark them as failed for the VLM to ignore
func (s *Store) MarkOrphansAsFailed() error {
    cutoff := time.Now().Add(-24 * time.Hour).Unix()
    
    _, err := s.DB.Exec(`
        UPDATE context_logs 
        SET processing_status = 'failed', description = 'VLM Processing Timeout' 
        WHERE processing_status = 'pending' AND timestamp < ?`, 
        cutoff)
        
    return err
}

// Update the keep_forever flag for a specific session's recording, allowing for both keeping and releasing said control flag
func (s *Store) SetRecordingKeepStatus(sessionID int64, keep bool) error {
	// sqlite booleans are 0 or 1
	keepVal := 0
	if keep {
		keepVal = 1
	}

	query := `UPDATE recordings SET keep_forever = ? WHERE session_id = ?`
	
	result, err := s.DB.Exec(query, keepVal, sessionID)
	if err != nil {
		return fmt.Errorf("failed to update keep status for session %d: %w", sessionID, err)
	}

	// verify that a row was actually updated
	rowsAffected, _ := result.RowsAffected()
	if rowsAffected == 0 {
		return fmt.Errorf("no recording found for session %d", sessionID)
	}

	return nil
}

func (s *Store) SaveDashboardState(stateJSON string) error {
    _, err := s.DB.Exec(`
        INSERT INTO user_preferences (key, value) 
        VALUES ('dashboard_state', ?) 
        ON CONFLICT(key) DO UPDATE SET value = ?
    `, stateJSON, stateJSON)
    return err
}

func (s *Store) SetVideoRetentionLimit(key string, value string) error {
	_, err := s.DB.Exec(`
        INSERT INTO user_preferences (key, value) 
        VALUES (?, ?) 
        ON CONFLICT(key) DO UPDATE SET value = ?
    `, key, value, value)

	return err
}

func (s *Store) DeleteRecording(id int) error {
	_, err := s.DB.Exec(`DELETE FROM recordings WHERE id = ?`, id)

	return err
}