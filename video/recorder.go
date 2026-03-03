package video

import (
    "fmt"
    "os"
    "os/exec"
    "path/filepath"
)

// build an MP4 from a list of images using ffmpeg
func EncodeFromImages(imagePaths []string, outputPath string) error {
    if len(imagePaths) == 0 {
        return nil
    }

    // temp dir for inout images
    tempDir := filepath.Dir(imagePaths[0])
    listPath := filepath.Join(tempDir, fmt.Sprintf("list_%d.txt", len(imagePaths)))
    
    listFile, err := os.Create(listPath)
    if err != nil {
        return err
    }
    
    // ffmpeg 'concat' demuxer works best with absolute paths or relative (1FPS is assumed)
    for _, path := range imagePaths {
        // avoid nested relative path + Windows backslash escaping bugs in ffmpeg
        fileName := filepath.Base(path)

        // safe quoting for paths with spaces
        fmt.Fprintf(listFile, "file '%s'\n", fileName)
        fmt.Fprintf(listFile, "duration 1\n")
    }
    // repeat last frame to prevent FFmpeg cutting it short
    lastFileName := filepath.Base(imagePaths[len(imagePaths)-1])
    fmt.Fprintf(listFile, "file '%s'\n", lastFileName)
    listFile.Close()
    
    defer os.Remove(listPath) // Clean up list file immediately

    // ffmpeg for bundling the images into a video
    // -y: Overwrite output if exists
    // -safe 0: Allow absolute paths
    cmd := exec.Command("ffmpeg", "-y", "-f", "concat", "-safe", "0", 
        "-i", listPath, 
        "-r", "1", 
        "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "24", "-preset", "ultrafast", 
        outputPath,
    )

    // capture output for debugging if needed
    output, err := cmd.CombinedOutput()
    if err != nil {
        return fmt.Errorf("ffmpeg error: %v, output: %s", err, string(output))
    }

    return nil
}