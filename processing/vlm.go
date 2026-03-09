package processing

import (
	"bytes"
	"encoding/base64"
	"encoding/json"
	"fmt"
	"image"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"time"

	"github.com/corona10/goimagehash"
	"tavlio/dbase"
)

// OpenAI-compatible API structs
type ChatRequest struct {
	Model    string    `json:"model"` // required by OpenAI spec
	Messages []Message `json:"messages"`
}

type Message struct {
	Role    string    `json:"role"`
	Content []Content `json:"content"`
}

type Content struct {
	Type     string    `json:"type"`
	Text     string    `json:"text,omitempty"`
	ImageURL *ImageURL `json:"image_url,omitempty"`
}

type ImageURL struct {
	URL string `json:"url"`
}

type ChatResponse struct {
	Choices []struct {
		Message struct {
			Content string `json:"content"`
		} `json:"message"`
	} `json:"choices"`
}

type VLMClient struct {
	Store    *dbase.Store
	LastHash *goimagehash.ImageHash
	LastProcessTime time.Time 
}

// VISUAL DIFF: checks if frame is different enough to process (ft. a cooldown)
func (v *VLMClient) ShouldProcess(img image.Image) (bool, string) {
	newHash, err := goimagehash.DifferenceHash(img)
	if err != nil {
		log.Printf("Error hashing image: %v", err)
		return true, "" // default to processing if hashing fails
	}

	hashStr := newHash.ToString()
	now := time.Now()

	if !v.LastProcessTime.IsZero() && now.Sub(v.LastProcessTime) < 15*time.Second {
		return false, hashStr
    }

	if v.LastHash != nil {
		distance, err := newHash.Distance(v.LastHash)
        if err == nil && distance < 10 {
            return false, hashStr // screen is static
        }
	}
	
	// significant change detected AND the cooldown is finished
	v.LastHash = newHash
	v.LastProcessTime = now
	return true, hashStr
}

// BATCH PROCESSOR: runs periodically to process pending images
func (v *VLMClient) RunBatch(maxTimestamp int64) {
	// check if there's enough work
	pending, err := v.Store.GetPendingImages(18, maxTimestamp)
	if err != nil {
		log.Printf("Error fetching pending images: %v", err)
		return
	}

	if len(pending) == 0 {
		return
	}

	log.Println("Starting VLM Batch...")

	// start llama-server
	cmd := exec.Command("llama-server",
		"-hf", "ggml-org/gemma-3-4b-it-qat-GGUF",
		"--port", "8080")

	// redirect stdout/stderr to see if the server crashes
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		log.Println("Error starting VLM server:", err)
		return
	}

	// kill the server when this function exits
	defer func() {
		if cmd.Process != nil {
			cmd.Process.Kill()
			cmd.Wait()
			log.Println("VLM Batch Finished. Server stopped.")
		}
	}()

	// wait for server to warm up by polling the /health endpoint
	log.Println("Waiting for server to become ready...")
	serverReady := false
	for range 30 {
		resp, err := http.Get("http://127.0.0.1:8080/health")
		if err == nil && resp.StatusCode == 200 {
			resp.Body.Close()
			serverReady = true
			break
		}
		if err == nil {
			resp.Body.Close()
		}
		time.Sleep(1 * time.Second)
	}

	if !serverReady {
		log.Println("Server failed to start in time. Aborting batch.")
		return
	}

	log.Println("Server ready! Processing images...")

	// group images by SessionID
    sessionGroups := make(map[int][]dbase.PendingImage)
    for _, item := range pending {
        sessionGroups[item.SessionID] = append(sessionGroups[item.SessionID], item)
    }

    // process each session group as a single prompt
    for sessionID, items := range sessionGroups {
        var paths []string
        for _, item := range items {
            paths = append(paths, item.Path)
        }

        summaryDesc := v.callLlamaServer(paths)
        log.Printf("-> Session %d Summary: %q\n", sessionID, summaryDesc)

        // apply the summary to all DB rows in this chunk and delete the files
        for _, item := range items {
            v.Store.UpdateDescription(item.ID, summaryDesc)
            os.Remove(item.Path)
            fmt.Printf("Processed & Deleted ID %d\n", item.ID)
        }
    }
}

// HTTP CLIENT: calls the running server
func (v *VLMClient) callLlamaServer(imagePaths []string) string {
	if len(imagePaths) == 0 { return "" }

	// cap the number of images per prompt to avoid overloading context window
    maxImages := 6 
    if len(imagePaths) > maxImages {
        imagePaths = imagePaths[:maxImages] 
    }

	// construct the payload & send the request
    prompt := "These are sequential screenshots from a user's computer session. Summarize the overall activity and workflow progression in 1 or 2 clear sentences."
    content := []Content{{Type: "text", Text: prompt}}

	// append each image to the payload
    for _, path := range imagePaths {
        imgBytes, err := os.ReadFile(path)
        if err != nil { continue }
        
        base64Str := base64.StdEncoding.EncodeToString(imgBytes)
        dataURL := fmt.Sprintf("data:image/jpeg;base64,%s", base64Str)
        
        content = append(content, Content{
            Type: "image_url", 
            ImageURL: &ImageURL{URL: dataURL},
        })
    }

	payload := ChatRequest{
		Model: "gemma-3-4b-it-qat-GGUF",
		Messages: []Message{{
				Role: "user",
				Content: content,
			}},
	}

	jsonData, err := json.Marshal(payload)
	if err != nil {
		log.Printf("VLM: Error marshalling JSON: %v", err)
		return ""
	}

	resp, err := http.Post("http://127.0.0.1:8080/v1/chat/completions", "application/json", bytes.NewBuffer(jsonData))
	if err != nil {
		log.Printf("VLM: Server unreachable: %v", err)
		return ""
	}
	defer resp.Body.Close()

	// parse response
	body, err := io.ReadAll(resp.Body)
	if err != nil {
		log.Printf("VLM: Error reading response body: %v", err)
		return ""
	}

	if resp.StatusCode != 200 {
		log.Printf("VLM: API Error %d: %s", resp.StatusCode, string(body))
		return ""
	}

	var chatResp ChatResponse
	if err := json.Unmarshal(body, &chatResp); err != nil {
		log.Printf("VLM: Error unmarshalling response: %v", err)
		return ""
	}

	if len(chatResp.Choices) > 0 {
		return chatResp.Choices[0].Message.Content
	}

	return ""
}