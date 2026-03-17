package main

import (
	"embed"
	_ "embed"
	"fmt"
	"image/jpeg"
	"log"
	"maps"
	"os"
	"os/signal"
	"path/filepath"
	"syscall"
	"time"

	"github.com/kbinani/screenshot"
	"github.com/wailsapp/wails/v3/pkg/application"

	"tavlio/dbase"
	"tavlio/processing"
	"tavlio/tracking"
	"tavlio/video"
)

// Wails uses Go's `embed` package to embed the frontend files into the binary.
// Any files in the frontend/dist folder will be embedded into the binary and
// made available to the frontend.
// See https://pkg.go.dev/embed for more information.

//go:embed all:frontend/dist
var assets embed.FS

const MaxFramesPerChunk = 300 // 5 minutes at 1 FPS

type PendingFrame struct {
    Path   string
    Hash   string
    Status string
}

func init() {
	// Register a custom event whose associated data type is string.
	// This is not required, but the binding generator will pick up registered events
	// and provide a strongly typed JS/TS API for them.
	application.RegisterEvent[string]("time")
}

// main function serves as the application's entry point. It initializes the application, creates a window,
// and starts a goroutine that emits a time-based event every second. It subsequently runs the application and
// logs any error that might occur.
func main() {
	app := application.New(application.Options{
		Name:        "tavlio",
		Description: "A cross-platform, fully local desktop app for tracking and displaying users' digital habits",
		Services: []application.Service{
			//application.NewService(),
		},
		Assets: application.AssetOptions{
			Handler: application.AssetFileServerFS(assets),
		},
		Mac: application.MacOptions{
			ApplicationShouldTerminateAfterLastWindowClosed: true,
		},
	})

	app.Window.NewWithOptions(application.WebviewWindowOptions{
		Title: "Tavlio",
		Mac: application.MacWindow{
			InvisibleTitleBarHeight: 50,
			Backdrop:                application.MacBackdropTranslucent,
			TitleBar:                application.MacTitleBarHiddenInset,
		},
		BackgroundColour: application.NewRGB(27, 38, 54),
		URL:              "/",
	})

	err := app.Run()

	if err != nil {
		log.Fatal(err)
	}

    /*
    db, err := dbase.NewStore("tracker.db")
    if err != nil { panic(err) }

    // clean up unneeded screenshots (both in db and local filesystem)
    db.MarkOrphansAsFailed()
    cleanOrphanedScreenshots()

    os.MkdirAll("data/screenshots", 0755)
    os.MkdirAll("data/videos", 0755)

    go trackNrecord(db)
    
    select{}
    */
}

// orchestrate all app modules to properly track and record the user's actions
func trackNrecord(db *dbase.Store) {
    // start foreground app tracker + buffered channel so the callback doesn't block if slow
    appChangeChan := make(chan string, 5) 
    go tracking.StartForegroundTracker(appChangeChan)

    vlm := &processing.VLMClient{Store: db}

	// state Variables
    var (
        currentApp     = tracking.GetCurrentActiveApp()
        sessionStart   = time.Now() 
        latestApp      = currentApp
        awaySince      time.Time
        distractStart  time.Time

        frameBuffer    []string    
        graceBuffer      []PendingFrame
        vlmNeededFiles = make(map[string]bool) 
        sessionID      int64

        heartbeatCounter  = 0
        mainVideoPath     string
        isRecordingLogged bool
    )

    sessionID, _ = db.LogSessionStart(currentApp)
    mainVideoPath = filepath.Join("data/videos", fmt.Sprintf("session_%d_%s.mp4", sessionID, time.Now().Format("20060102_150405")))

    ticker := time.NewTicker(1 * time.Second)

    sigChan := make(chan os.Signal, 1)
    signal.Notify(sigChan, os.Interrupt, syscall.SIGTERM)
	
	for {
        select {
        // ----- GRACEFUL SHUTDOWN -----
        case <-sigChan:
            fmt.Println("\n[Shutdown] Saving final session data...")

            // dump anything in the holding pen back to the main buffer (removed duplicate DB logging here)
            for _, f := range graceBuffer {
                frameBuffer = append(frameBuffer, f.Path)
            }

            // flush the final frames to the main video synchronously to ensure it finishes before exit
            if len(frameBuffer) > 0 {
                chunkPath := generateTempVideoPath()
                createChunkAndCleanImages(frameBuffer, chunkPath, vlmNeededFiles)
                video.AppendToMainVideo(mainVideoPath, chunkPath)

                if !isRecordingLogged {
                    db.LogRecording(sessionID, mainVideoPath, sessionStart.Unix(), int(time.Since(sessionStart).Seconds()))
                }
            }

            // final DB heartbeat to close out the session duration
            db.UpdateSessionHeartbeat(sessionID, sessionStart, time.Now())

            fmt.Println("[Shutdown] Complete. Exiting safely.")
            os.Exit(0)

        // ----- CASE A: user switched apps -----
        case newAppName := <-appChangeChan:
            if !awaySince.IsZero() && latestApp != currentApp {
                distractionDuration := int(time.Since(distractStart).Seconds())
                if distractionDuration > 0 {
                    // Log the micro-session to the database!
                    db.LogContextSwitch(sessionID, latestApp, distractStart.Unix(), distractionDuration)
                    fmt.Printf("\n[Distraction Logged] %s for %ds\n", latestApp, distractionDuration)
                }
            }

            latestApp = newAppName
            distractStart = time.Now()

            if latestApp != currentApp && awaySince.IsZero() {
                awaySince = time.Now()
                fmt.Printf("\n[Grace Period Started] Alt-tabbed to %s...\n", latestApp)
            }
            
            // if alt-tabbed BACK to the main app's session before the timer expired, cancel it
            if latestApp == currentApp && !awaySince.IsZero() {
                fmt.Println("\n[Grace Period Cancelled] User returned to", currentApp)
                
                // DUMP HOLDING PEN -> OLD SESSION (& reset control variables)
                for _, f := range graceBuffer {
                    frameBuffer = append(frameBuffer, f.Path)
                }

                graceBuffer = nil
                awaySince = time.Time{}
                distractStart = time.Time{}
            }

        // ----- CASE B: 1s ticks (for screenshots) -----
        case <-ticker.C:
            heartbeatCounter++
            if heartbeatCounter >= 60 {
                db.UpdateSessionHeartbeat(sessionID, sessionStart, time.Now())
                heartbeatCounter = 0
            }

            // ----- DEBOUNCE CHECK -----
            if !awaySince.IsZero() && time.Since(awaySince) >= 60*time.Second {
                fmt.Printf("\n[Session Switch] 60s elapsed. Committing switch to %s\n", latestApp)
                
                // flush the old session
                if len(frameBuffer) > 0 {
                    chunkPath := generateTempVideoPath()
                    createChunkAndCleanImages(frameBuffer, chunkPath, vlmNeededFiles)
                    video.AppendToMainVideo(mainVideoPath, chunkPath)

                    if !isRecordingLogged {
                        db.LogRecording(sessionID, mainVideoPath, sessionStart.Unix(), int(awaySince.Sub(sessionStart).Seconds()))
                    }
                }

                chunkEndTime := awaySince.Unix()
                go vlm.RunBatch(chunkEndTime)
                
                // final DB update for current session
                db.UpdateSessionHeartbeat(sessionID, sessionStart, awaySince)

                // start NEW session and reset the timer
                currentApp = latestApp
                sessionStart = awaySince
                frameBuffer = []string{}
                vlmNeededFiles = make(map[string]bool)

                sessionID, _ = db.LogSessionStart(currentApp)

                heartbeatCounter = 0
                mainVideoPath = filepath.Join("data/videos", fmt.Sprintf("session_%d_%s.mp4", sessionID, time.Now().Format("20060102_150405")))
                isRecordingLogged = false

                // DUMP HOLDING PEN -> NEW SESSION
                for _, f := range graceBuffer {
                    frameBuffer = append(frameBuffer, f.Path)

                    db.UpdateScreenshotSession(f.Path, sessionID) 
                }
                graceBuffer = nil
                
                awaySince = time.Time{}
                distractStart = time.Time{}
            }

            // create an intermediate video chunk (every 5 mins), but KEEP session active
            if len(frameBuffer) >= MaxFramesPerChunk {
                // use copies of frame slices to  later prevent main loop execution from being temporarily blocked
                framesCopy := make([]string, len(frameBuffer))
                copy(framesCopy, frameBuffer)

                keepMapCopy := make(map[string]bool)
                maps.Copy(keepMapCopy, vlmNeededFiles)

                chunkPath := generateTempVideoPath()
                currentMainVideoPath := mainVideoPath
                currentSessionID := sessionID
                currentSessionStart := sessionStart
                logFirstChunk := !isRecordingLogged

                //VLM will only handle frames from already bundled videos
                chunkEndTime := time.Now().Unix() - 1

                // offload encoding to a goroutine to prevent blocking the event loop
                go func(frames []string, keepMap map[string]bool, cPath, mPath string, sID int64, sStart time.Time, logRec bool, maxTs int64) {
                    createChunkAndCleanImages(frames, cPath, keepMap)
                    err := video.AppendToMainVideo(mPath, cPath)

                    if err == nil && logRec {
                        db.LogRecording(sID, mPath, sStart.Unix(), int(time.Since(sStart).Seconds()))
                    }

                    vlm.RunBatch(maxTs)
                }(framesCopy, keepMapCopy, chunkPath, currentMainVideoPath, currentSessionID, currentSessionStart, logFirstChunk, chunkEndTime)

                isRecordingLogged = true
                frameBuffer = []string{}
                vlmNeededFiles = make(map[string]bool)
            }

            // capture frame
            bounds := screenshot.GetDisplayBounds(0)
            img, err := screenshot.CaptureRect(bounds)
            if err != nil { continue }

            // save + compute visual diff
            fileName := filepath.Join("data/screenshots", fmt.Sprintf("%d_%d.jpg", sessionID, time.Now().UnixNano()))
            file, err := os.Create(fileName)
            if err != nil {
                fmt.Printf("\nError creating screenshot file: %v\n", err)
                continue 
            }
            jpeg.Encode(file, img, &jpeg.Options{Quality: 80})
            file.Close()

            shouldProcess, hash := vlm.ShouldProcess(img)
            if shouldProcess {
                // ONLY create a database row if the screen changed significantly
                db.LogScreenshot(sessionID, fileName, hash, "pending")
                
                // mark as "survivor" so the file isn't deleted during video encoding
                vlmNeededFiles[fileName] = true
            }
            
            // --- ROUTE THE FRAME ---
            if !awaySince.IsZero() {
                // in grace period, so frame is sent to Holding Pen
                graceBuffer = append(graceBuffer, PendingFrame{Path: fileName, Hash: hash, Status: "pending"})
            } else {
                frameBuffer = append(frameBuffer, fileName)
            }

            // testing purposes
            if !awaySince.IsZero() {
                fmt.Printf("\r[%s] Buffer: %d | Away: %ds/60s", currentApp, len(frameBuffer), int(time.Since(awaySince).Seconds()))
            } else {
                fmt.Printf("\r[%s] Buffer: %d/%d | VLM Pending: %v", currentApp, len(frameBuffer), MaxFramesPerChunk, shouldProcess)
            }
        }
    }
}

// build the MP4 and execute cleanup of "survivor" frames
func createChunkAndCleanImages(frames []string, outputPath string, keepMap map[string]bool) {
    if len(frames) == 0 { return }
    
    err := video.EncodeFromImages(frames, outputPath)
    if err == nil {
        for _, path := range frames {
            if !keepMap[path] { os.Remove(path) }
        }
    } else {
        fmt.Printf("\nError encoding chunk: %v\n", err)
    }
}

func cleanOrphanedScreenshots() {
    files, err := os.ReadDir("data/screenshots")
    if err != nil { return }

    cutoff := time.Now().Add(-24 * time.Hour)

    for _, file := range files {
        if filepath.Ext(file.Name()) == ".jpg" {
            info, err := file.Info()
            if err == nil && info.ModTime().Before(cutoff) {
                fullPath := filepath.Join("data/screenshots", file.Name())
                os.Remove(fullPath)
            }
        }
    }
}

func generateTempVideoPath() string {
    return filepath.Join("data/videos", fmt.Sprintf("chunk_%d.mp4", time.Now().UnixNano()))
}