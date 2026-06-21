package video 

import (
	"embed"
	"fmt"
	"net/http"
	"os"
	"os/exec"
	"strconv"
	"strings"

	"github.com/wailsapp/wails/v3/pkg/application"
	"tavlio/dbase"
)

//  Wrap the Wails file server to intercept and stream local videos
func AssetHandler(assets embed.FS, db *dbase.Store) http.Handler {
	defaultHandler := application.AssetFileServerFS(assets)

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		// Intercept requests like <video src="/recording/123">
		if idStr, ok := strings.CutPrefix(r.URL.Path, "/recording/"); ok {
			// /recording/{id}: stream the recording
			// /recording/{id}/thumb: serve (generating+caching) a first-frame JPG
			parts := strings.SplitN(idStr, "/", 2)
			sessionID, err := strconv.ParseInt(parts[0], 10, 64)
			if err != nil {
				http.NotFound(w, r)
				return
			}

			video, err := db.GetRecordingForSession(int(sessionID))
			if err != nil || video.FilePath == "" {
				http.NotFound(w, r)
				return
			}

			if len(parts) == 2 && parts[1] == "thumb" {
				serveThumbnail(w, r, video.FilePath, video.DurationSeconds)
				return
			}

			// stream the file with Range request (206 Partial Content) support
			http.ServeFile(w, r, video.FilePath)
			return
		}

		// Fallback for standard frontend assets
		defaultHandler.ServeHTTP(w, r)
	})
}

// return a small, downscaled JPG of a representative frame of the given recording, 
// and cache it next to the source video, so subsequent requests are just a static file read. 
// This keeps the webview's media stack completely dormant (image instead of video, initially)
//
// seek to ~10% of the duration rather than frame 0 for thumbnail image to prevent black fade-in frames
func serveThumbnail(w http.ResponseWriter, r *http.Request, videoPath string, durationSeconds int) {
	thumbPath := videoPath + ".thumb.jpg"

	if _, err := os.Stat(thumbPath); err != nil {
		// fallback to the start for zero/unknown-duration recordings
		seek := "0"
		if durationSeconds > 0 {
			offset := min(max(durationSeconds / 10, 1), durationSeconds)
			seek = strconv.Itoa(offset)
		}

		// Extract and downscale thumbnail frame; recordings are faststart MP4s so seeking is ~instant
		cmd := exec.Command("ffmpeg", "-y", "-ss", seek, "-i", videoPath,
			"-frames:v", "1", "-vf", "scale=320:-1", "-q:v", "4", thumbPath)
		if out, err := cmd.CombinedOutput(); err != nil {
			fmt.Printf("thumbnail generation failed for %s: %v\n%s\n", videoPath, err, string(out))
			http.NotFound(w, r)
			return
		}
	}

	w.Header().Set("Cache-Control", "public, max-age=86400")
	http.ServeFile(w, r, thumbPath)
}