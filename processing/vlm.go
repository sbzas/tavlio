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
}

// VISUAL DIFF: checks if frame is different enough to process
func (v *VLMClient) ShouldProcess(img image.Image) (bool, string) {
	newHash, err := goimagehash.DifferenceHash(img)
	if err != nil {
		log.Printf("Error hashing image: %v", err)
		return true, "" // default to processing if hashing fails
	}

	hashStr := newHash.ToString()

	if v.LastHash != nil {
		distance, err := newHash.Distance(v.LastHash)
		if err != nil {
			return true, hashStr
		}

		// if distance < 10, images are nearly identical
		if distance < 10 {
			// keeping the old hash baseline prevents "drift" from slow, gradual screen changes.
			return false, hashStr
		}
	}
	
	// significant change detected, update baseline
	v.LastHash = newHash
	return true, hashStr
}

// BATCH PROCESSOR: runs periodically to process pending images
func (v *VLMClient) RunBatch() {
	// check if there's enough work
	pending, err := v.Store.GetPendingImages(6)
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
			if err := cmd.Process.Kill(); err != nil {
				log.Printf("Failed to kill VLM server: %v", err)
			} else {
				log.Println("VLM Batch Finished. Server stopped.")
			}
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

	for _, item := range pending {
		desc := v.callLlamaServer(item.Path)

        // testing purposes
        log.Printf("-> Saving to DB (ID %d): %q\n", item.ID, desc)

		v.Store.UpdateDescription(item.ID, desc)

		// screenshot was already sent to the VLM for processing
		// and there also exists a video that contains it, so it becomes unnecessary
		os.Remove(item.Path)

		fmt.Printf("Processed & Deleted ID %d\n", item.ID)
	}
}

// HTTP CLIENT: calls the running server
func (v *VLMClient) callLlamaServer(imagePath string) string {
	imgBytes, err := os.ReadFile(imagePath)
	if err != nil {
		log.Printf("VLM: Error reading file %s: %v", imagePath, err)
		return ""
	}

	base64Str := base64.StdEncoding.EncodeToString(imgBytes)
	dataURL := fmt.Sprintf("data:image/png;base64,%s", base64Str)

	// construct the payload & send the request
	prompt := "Briefly describe the main activity on this computer screen in one sentence."

	payload := ChatRequest{
		Model: "gemma-3-4b-it-qat-GGUF",
		Messages: []Message{
			{
				Role: "user",
				Content: []Content{
					{Type: "text", Text: prompt},
					{Type: "image_url", ImageURL: &ImageURL{URL: dataURL}},
				},
			},
		},
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