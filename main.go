package main

import (
	"embed"
	_ "embed"
	//"flag"
	"fmt"
	"log"
	"os"

	"github.com/wailsapp/wails/v3/pkg/application"

	"tavlio/dbase"
	"tavlio/tracking"
	"tavlio/video"
)

// Wails uses Go's `embed` package to embed the frontend files into the binary.
// Any files in the frontend/dist folder will be embedded into the binary and
// made available to the frontend.
// See https://pkg.go.dev/embed for more information.

//go:embed all:frontend/dist
var assets embed.FS

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

    // start foreground app tracker + buffered channel so the callback doesn't block if slow
    appChangeChan := make(chan string, 5) 
    go tracking.StartForegroundTracker(appChangeChan)

    go trackNrecord(db, appChangeChan)

	app := application.New(application.Options{
		Name:        "Tavlio",
		Description: "A cross-platform, fully local desktop app for tracking and displaying users' digital habits",
		Services: []application.Service{
			application.NewService(db),
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