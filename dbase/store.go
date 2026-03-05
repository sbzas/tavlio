package dbase

import (
    "database/sql"
    "time"
    "fmt"

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
    CREATE TABLE IF NOT EXISTS recordings (
        id INTEGER PRIMARY KEY,
        session_id INTEGER NOT NULL,
        file_path TEXT NOT NULL,
        start_time INTEGER NOT NULL,
        duration_seconds INTEGER,
        keep_forever BOOLEAN DEFAULT 0,
        created_at INTEGER DEFAULT (unixepoch())
    );
    CREATE VIRTUAL TABLE IF NOT EXISTS context_search USING fts5(
        description, 
        content='context_logs', 
        content_rowid='id'
    );
    CREATE TRIGGER IF NOT EXISTS context_logs_ai AFTER INSERT ON context_logs BEGIN
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

func (s *Store) LogRecording(sessionID int64, filePath string, startTime int64, duration int) error {
    _, err := s.DB.Exec(`
        INSERT INTO recordings (session_id, file_path, start_time, duration_seconds)
        VALUES (?, ?, ?, ?)`,
        sessionID, filePath, startTime, duration)

    return err
}

// retrieve images and their associated session ID
func (s *Store) GetPendingImages(limit int) ([]PendingImage, error) {
    rows, err := s.DB.Query("SELECT id, session_id, image_path FROM context_logs WHERE processing_status = 'pending' LIMIT ?", limit)
    if err != nil { return nil, err }
    defer rows.Close()

    var results []PendingImage
    for rows.Next() {
        var r PendingImage
        if err := rows.Scan(&r.ID, r.SessionID, &r.Path); err != nil {
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

// Update the finish time and duration of a session
func (s *Store) EndSession(sessionID int64, startTime time.Time) error {
    now := time.Now()
    endTimeUnix := now.Unix()
    durationSeconds := int(now.Sub(startTime).Seconds())

    res, err := s.DB.Exec(`
        UPDATE sessions 
        SET end_time = ?, duration_seconds = ? 
        WHERE id = ?`, 
        endTimeUnix, durationSeconds, sessionID)
        
    if err != nil {
        fmt.Printf("\n[DB Error] Failed to end session %d: %v\n", sessionID, err)
        return err
    }
    
    rowsAffected, _ := res.RowsAffected()
    if rowsAffected == 0 {
        fmt.Printf("\n[DB Warning] Tried to end session %d, but it was not found in DB!\n", sessionID)
    }
    
    return nil
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