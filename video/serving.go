package video 

import (
	"embed"
	"net/http"
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
			sessionID, err := strconv.ParseInt(idStr, 10, 64)
			if err != nil {
				http.NotFound(w, r)
				return
			}

			video, err := db.GetRecordingForSession(int(sessionID))
			if err != nil || video.FilePath == "" {
				http.NotFound(w, r)
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