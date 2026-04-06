package video

import (
    "fmt"
    "os"
    "os/exec"
    "path/filepath"
    "time"
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
        "-movflags", "+faststart",
        outputPath,
    )

    // capture output for debugging if needed
    output, err := cmd.CombinedOutput()
    if err != nil {
        return fmt.Errorf("ffmpeg error: %v, output: %s", err, string(output))
    }

    return nil
}

// merge multiple mp4 chunks into a single mp4 instantly without re-encoding
func ConcatVideos(chunkPaths []string, outputPath string) error {
    if len(chunkPaths) == 0 {
        return nil
    }
    
    // if there's only one chunk (session was < 5 mins), just rename it to the final path
    if len(chunkPaths) == 1 {
        return os.Rename(chunkPaths[0], outputPath)
    }

    //create a list file for FFmpeg in the same directory as the chunks
    tempDir := filepath.Dir(chunkPaths[0])
    listPath := filepath.Join(tempDir, fmt.Sprintf("concat_list_%d.txt", time.Now().UnixNano()))
    
    listFile, err := os.Create(listPath)
    if err != nil {
        return err
    }

    // write the chunks' filenames
    for _, path := range chunkPaths {
        fileName := filepath.Base(path)
        fmt.Fprintf(listFile, "file '%s'\n", fileName)
    }
    listFile.Close()
    defer os.Remove(listPath) // Clean up list

    // run FFmpeg with "-c copy" (instantly copies streams, no quality loss or heavy CPU usage)
    cmd := exec.Command("ffmpeg", "-y", "-f", "concat", "-safe", "0", 
        "-i", listPath, 
        "-c", "copy", 
        outputPath,
    )

    output, err := cmd.CombinedOutput()
    if err != nil {
        return fmt.Errorf("ffmpeg concat error: %v\nOutput: %s", err, string(output))
    }

    return nil
}

// attach a new chunk to the main session video on disk
func AppendToMainVideo(mainPath, chunkPath string) error {
    if _, err := os.Stat(mainPath); os.IsNotExist(err) {
        return os.Rename(chunkPath, mainPath)
    }

    tempPath := mainPath + ".tmp.mp4"
    err := ConcatVideos([]string{mainPath, chunkPath}, tempPath)
    if err != nil {
        return err
    }

    // replace old "main" with the newly merged version, and clean up
    os.Remove(mainPath)
    os.Rename(tempPath, mainPath)
    os.Remove(chunkPath)
    
    return nil
}