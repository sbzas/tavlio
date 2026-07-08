package main

import (
	"embed"
	_ "embed"
	"fmt"
	"log"
	"os"
	"sync"

	"github.com/wailsapp/wails/v3/pkg/application"

	"tavlio/ai"
	"tavlio/dbase"
	"tavlio/tracking"
	"tavlio/video"
)

//go:embed all:frontend/dist
var assets embed.FS

func init() {
}

func main() {
    os.MkdirAll("data/screenshots", 0755)
	os.MkdirAll("data/videos", 0755)

	needsSeeding := false
	if _, err := os.Stat("tracker.db"); os.IsNotExist(err) {
		needsSeeding = true
		fmt.Println(">> No existing database found. Preparing to seed...")
	}

    db, e := dbase.NewStore("tracker.db")
    if e != nil { panic(e) }

	if needsSeeding {
		seedDB(db)
	}

    cleanDB(db)

    // trigger an initial background sync of all user-configured calendars on startup
    go db.SyncAllCalendars()

    // start foreground app tracker + buffered channel so the callback doesn't block if slow
    appChangeChan := make(chan string, 5) 
    go tracking.StartForegroundTracker(appChangeChan)

    go trackNrecord(db, appChangeChan)

	app := application.New(application.Options{
		Name:        "Tavlio",
		Description: "A cross-platform, fully local desktop app for tracking and displaying users' digital habits",
		Services: []application.Service{
			application.NewService(db),
			application.NewService(ai.CreateHardwareService(db)),
		},
		OnShutdown: func() {
			performShutdown(db)
		},
		Assets: application.AssetOptions{
			Handler: video.AssetHandler(assets, db),
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
		BackgroundColour: application.NewRGB(228,221,208),
		URL:              "/",
	})

	err := app.Run()

	if err != nil {
		log.Fatal(err)
	}

	// fallback: on Windows the window-X path exits the message loop without
	// firing OnShutdown, so flush here too as performShutdown is idempotent
	performShutdown(db)
}

// ----- setup helpers ----
func seedDB(db *dbase.Store) {
	fmt.Println("Seeding database with mock data...")
	if err := db.SeedMockData(); err != nil {
		log.Fatalf("Failed to seed database: %v", err)
	}
	fmt.Println("Database seeded successfully!")
}

func cleanDB(db *dbase.Store) {
	db.MarkOrphansAsFailed()
	cleanOrphanedScreenshots() // Lives in orchestrator.go
}

// tear down the tracker, flush the final session data and close DB
// sync.Once used so OnShutdown and the post app.Run() fallback can both call it safely
var shutdownOnce sync.Once

func performShutdown(db *dbase.Store) {
	shutdownOnce.Do(func() {
		tracking.StopForegroundTracker()
		close(shutdownChan)
		<-doneChan
		db.DB.Close()
	})
}