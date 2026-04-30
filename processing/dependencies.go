package processing

import (
	"archive/tar"
	"archive/zip"
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"time"
)

type GitHubRelease struct {
	Assets []struct {
		Name               string `json:"name"`
		BrowserDownloadURL string `json:"browser_download_url"`
	} `json:"assets"`
}

var httpClient = &http.Client{Timeout: 30 * time.Minute}

func makeBinDir() (string, error) {
	configDir, err := os.UserConfigDir()
	if err != nil { 
		return "", fmt.Errorf("could not find user config dir: %w", err) 
	}

	binDir := filepath.Join(configDir, "Tavlio", "bin")
	if err := os.MkdirAll(binDir, 0755); err != nil {
		return "", fmt.Errorf("could not create bin directory: %w", err) 
	}

	return binDir, nil
}

// Helper for simplifying the dependency check process
func ensureDependency(name, errPrefix string, getURL func() (string, error)) error {
	binDir, err := makeBinDir()
	if err != nil {
		return err
	}

	if runtime.GOOS == "windows" {
		name += ".exe"
	}

	binPath := filepath.Join(binDir, name)
	if _, err := os.Stat(binPath); os.IsNotExist(err) {
		fmt.Printf("[Setup] Downloading dependency (%s) from trusted sources...", name)
		
		url, err := getURL()
		if err != nil {
			return fmt.Errorf("failed to fetch %s download URL: %w", errPrefix, err)
		}

		if err := downloadAndExtractDependency(url, binDir, name); err != nil {
			return fmt.Errorf("failed to setup %s: %w", errPrefix, err)
		}

		applyOSPermissions(binPath)
	}
	return nil
}

func EnsureLlama() error {
	return ensureDependency("llama-server", "llama.cpp", getLlamaDownloadURL)
}

func EnsureFFmpeg() error {
	return ensureDependency("ffmpeg", "ffmpeg", getFFmpegDownloadURL)
}

// Returns the path to tavlio's private, isolated binaries
func GetBinPath(binaryName string) string {
	if runtime.GOOS == "windows" && !strings.HasSuffix(binaryName, ".exe") {
		binaryName += ".exe"
	}

	configDir, _ := os.UserConfigDir()
	return filepath.Join(configDir, "Tavlio", "bin", binaryName)
}

func getLlamaDownloadURL() (string, error) {
	// fetch the latest release data dynamically from the official repo
	resp, err := httpClient.Get("https://api.github.com/repos/ggerganov/llama.cpp/releases/latest")
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return "", fmt.Errorf("github API returned status: %d", resp.StatusCode)
	}

	var release GitHubRelease
	if err := json.NewDecoder(resp.Body).Decode(&release); err != nil {
		return "", err
	}

	var targetSuffix string
	switch runtime.GOOS {
	case "windows":
		targetSuffix = "bin-win-vulkan-x64.zip"
	case "darwin":
		if runtime.GOARCH == "arm64" {
			targetSuffix = "bin-macos-arm64.tar.gz" // apple silicon
		} else {
			targetSuffix = "bin-macos-x64.tar.gz"   // intel
		}
	default:
		return "", fmt.Errorf("unsupported OS for llama.cpp: %s", runtime.GOOS)
	}

	// scan the official release assets for the matching zip file
	for _, asset := range release.Assets {
		if strings.HasSuffix(asset.Name, targetSuffix) {
			return asset.BrowserDownloadURL, nil // Return the direct official download link
		}
	}

	return "", fmt.Errorf("no matching llama.cpp asset found for %s", targetSuffix)
}

func getFFmpegDownloadURL() (string, error) {
	switch runtime.GOOS {
	case "windows":
		// oficially endorsed Windows build by gyan.dev
		return "https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip", nil
	case "darwin":
		if runtime.GOARCH == "arm64" {
			// Martin Riedl's natively compiled, signed Apple Silicon release
			return "https://ffmpeg.martin-riedl.de/redirect/latest/macos/arm64/release/ffmpeg.zip", nil
		}
		// Martin Riedl's signed intel mac release
		return "https://ffmpeg.martin-riedl.de/redirect/latest/macos/amd64/release/ffmpeg.zip", nil
	default:
		return "", fmt.Errorf("unsupported OS: %s", runtime.GOOS)
	}
}

// Handles the download and delegates to the right extractor
func downloadAndExtractDependency(url, destDir, targetBinary string) error {
	resp, err := httpClient.Get(url)
	if err != nil {
		return err
	}
	defer resp.Body.Close()

	if resp.StatusCode != 200 {
		return fmt.Errorf("bad HTTP status: %s", resp.Status)
	}

	if strings.HasSuffix(url, ".zip") {
		return extractZip(resp.Body, destDir, targetBinary)
	} else if strings.HasSuffix(url, ".tar.gz") || strings.HasSuffix(url, ".tgz") {
		return extractTarGz(resp.Body, destDir, targetBinary)
	}

	return fmt.Errorf("unsupported archive format for URL: %s", url)
}

// atomic writes for properly managing finished downloads' executables
func saveFileAtomically(src io.Reader, destDir, targetBinary string) error {
	destPath := filepath.Join(destDir, targetBinary)
	tempPath := destPath + ".tmp"

	destFile, err := os.OpenFile(tempPath, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, 0755)
	if err != nil {
		return err
	}

	_, err = io.Copy(destFile, src)
	destFile.Close()

	if err != nil {
		os.Remove(tempPath) // Clean up partial file
		return err
	}

	return os.Rename(tempPath, destPath) // Commit to disk
}

// extractors
func extractTarGz(r io.Reader, destDir, targetBinary string) error {
	gzr, err := gzip.NewReader(r)
	if err != nil {
		return err
	}
	defer gzr.Close()

	tr := tar.NewReader(gzr)
	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		if header.Typeflag == tar.TypeReg && strings.HasSuffix(header.Name, targetBinary) {
			return saveFileAtomically(tr, destDir, targetBinary)
		}
	}
	return fmt.Errorf("binary %s not found inside tar.gz", targetBinary)
}

func extractZip(r io.Reader, destDir, targetBinary string) error {
	// zip still requires downloading to a temp file first because it needs io.ReaderAt
	tempZip := filepath.Join(os.TempDir(), "tavlio_download.zip")
	defer os.Remove(tempZip)

	out, err := os.Create(tempZip)
	if err != nil {
		return err
	}
	_, err = io.Copy(out, r)
	out.Close()
	if err != nil {
		return err
	}

	archive, err := zip.OpenReader(tempZip)
	if err != nil {
		return err
	}
	defer archive.Close()

	for _, f := range archive.File {
		if strings.HasSuffix(f.Name, targetBinary) {
			srcFile, err := f.Open()
			if err != nil {
				return err
			}
			defer srcFile.Close()
			return saveFileAtomically(srcFile, destDir, targetBinary)
		}
	}
	return fmt.Errorf("binary %s not found inside zip", targetBinary)
}

func applyOSPermissions(filePath string) {
	if runtime.GOOS == "windows" {
		return
	}

	// allow executing on unix-like systems
	if err := os.Chmod(filePath, 0755); err != nil {
		fmt.Printf("Warning: Failed to make %s executable: %v\n", filePath, err)
	}

	// remove macOS Gatekeeper quarantine flag so it doesn't get blocked
	if runtime.GOOS == "darwin" {
		cmd := exec.Command("xattr", "-d", "com.apple.quarantine", filePath)
		if err := cmd.Run(); err != nil {
			// This often fails silently if the flag isn't present, which is expected
			fmt.Printf("Note: xattr check for %s finished.\n", filePath)
		}
	}
}