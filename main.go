package main

import (
	"embed"
	_ "embed"
	"fmt"
	"image/jpeg"
	"os"
	"path/filepath"
	"log"
	"time"

	"github.com/wailsapp/wails/v3/pkg/application"
	"github.com/kbinani/screenshot"

	"tavlio/dbase"
	"tavlio/processing"
	winTracking "tavlio/tracking/windows"
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

	go func() {
		for {
			now := time.Now().Format(time.RFC1123)
			app.Event.Emit("time", now)
			time.Sleep(time.Second)
		}
	}()

    db, e := dbase.NewStore("tracker.db")
    if e != nil { panic(e) }

    // clean up unneeded screenshots (both in db and local filesystem)
    db.MarkOrphansAsFailed()
    cleanOrphanedScreenshots()

    os.MkdirAll("data/screenshots", 0755)
    os.MkdirAll("data/videos", 0755)

	err := app.Run()

	if err != nil {
		log.Fatal(err)
	}
}

// orchestrate all app modules to properly track and record the user's actions
func trackNrecord(db *dbase.Store) {
    // start foreground app tracker + buffered channel so the callback doesn't block if slow
    appChangeChan := make(chan string, 5) 
    go winTracking.StartForegroundTracker(appChangeChan)

    vlm := &processing.VLMClient{Store: db}
    go trackNrecord(db)

    // Background VLM
    go func() {
        for range time.Tick(1 * time.Minute) {
            vlm.RunBatch()
        }
    }()

	// state Variables
    var (
        currentApp     = winTracking.GetCurrentActiveApp()
        sessionStart   = time.Now() 
        latestApp      = currentApp
        awaySince      time.Time
        distractStart  time.Time

        frameBuffer    []string    
        sessionChunks  []string
        graceBuffer      []PendingFrame
        vlmNeededFiles = make(map[string]bool) 
        sessionID      int64
    )

    sessionID, _ = db.LogSessionStart(currentApp)
    ticker := time.NewTicker(1 * time.Second)
	
	for {
        select {
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
            // ----- DEBOUNCE CHECK -----
            if !awaySince.IsZero() && time.Since(awaySince) >= 60*time.Second {
                fmt.Printf("\n[Session Switch] 60s elapsed. Committing switch to %s\n", latestApp)
                
                // flush the old session
                if len(frameBuffer) > 0 {
                    chunkPath := generateTempVideoPath()
                    createChunkAndCleanImages(frameBuffer, chunkPath, vlmNeededFiles)
                    sessionChunks = append(sessionChunks, chunkPath)
                }
                
                if len(sessionChunks) > 0 {
                    finalVideoPath := filepath.Join("data/videos", fmt.Sprintf("session_%d_%s.mp4", sessionID, time.Now().Format("20060102_150405")))
                    if err := video.ConcatVideos(sessionChunks, finalVideoPath); err == nil {
                        db.LogRecording(sessionID, finalVideoPath, sessionStart.Unix(), int(time.Since(sessionStart).Seconds()))
                        for _, chunk := range sessionChunks { os.Remove(chunk) }
                    }
                }
                
                db.EndSession(sessionID, sessionStart)

                // start NEW session and reset the timer
                currentApp = latestApp
                sessionStart = awaySince
                frameBuffer = []string{}
                sessionChunks = []string{}
                //vlmNeededFiles = make(map[string]bool)

                sessionID, _ = db.LogSessionStart(currentApp)

                // DUMP HOLDING PEN -> NEW SESSION
                for _, f := range graceBuffer {
                    frameBuffer = append(frameBuffer, f.Path)
                }
                graceBuffer = nil
                
                awaySince = time.Time{}
                distractStart = time.Time{}
            }

            // create an intermediate video chunk (every 5 mins), but KEEP session active
            if len(frameBuffer) >= MaxFramesPerChunk {
                chunkPath := generateTempVideoPath()
                createChunkAndCleanImages(frameBuffer, chunkPath, vlmNeededFiles)
                
                sessionChunks = append(sessionChunks, chunkPath)
                
                frameBuffer = []string{}
            }

            // capture frame
            bounds := screenshot.GetDisplayBounds(0)
            img, err := screenshot.CaptureRect(bounds)
            if err != nil { continue }

            // save + compute visual diff
            fileName := filepath.Join("data/screenshots", fmt.Sprintf("%d_%d.jpg", sessionID, time.Now().UnixNano()))
            file, _ := os.Create(fileName)
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