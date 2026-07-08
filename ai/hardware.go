package ai

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os/exec"
	"regexp"
	"sort"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/jaypipes/ghw/pkg/gpu"
	"github.com/jaypipes/ghw/pkg/memory"

	"tavlio/dbase"
)

// HAND-MAINTAINED slice of HF repos publishing quantized .gguf files; first entry is the default ref prior to user-run checks
var CandidateRepos = []string{
	"ggml-org/gemma-4-E4B-it-GGUF",
	"unsloth/Qwen3-VL-4B-Instruct-FP8",
	"unsloth/Qwen3-VL-8B-Instruct-FP8",
	"unsloth/Qwen3-VL-30B-A3B-Instruct-FP8",
}

// Headroom over the on-disk GGUF size for KV cache + runtime overhead
const memoryHeadroom = 1.15

type Verdict string

const (
	VerdictRecommended Verdict = "recommended" // fits dedicated GPU VRAM
	VerdictUsable      Verdict = "usable"      // fits system RAM (CPU / shared)
	VerdictTooHeavy    Verdict = "too_heavy"   // fits nowhere
)

// ref model used when the user has never run a check
func DefaultModelRef() string {
	if len(CandidateRepos) == 0 {
		return ""
	}
	return CandidateRepos[0]
}

// ----- Frontend-facing types -----

type HardwareInfo struct {
	TotalRAMGB  float64 `json:"total_ram_gb"`
	TotalVRAMGB float64 `json:"total_vram_gb"` // 0 when no measurable dedicated VRAM
	HasGPU      bool    `json:"has_gpu"`
	GPUVendor   string  `json:"gpu_vendor"`
	GPUName     string  `json:"gpu_name"`
}

type ModelVerdict struct {
	Repo     string  `json:"repo"`
	Filename string  `json:"filename"`
	SizeGB   float64 `json:"size_gb"`
	Verdict  Verdict `json:"verdict"`
	Note     string  `json:"note"`
}

type HardwareReport struct {
	Hardware       HardwareInfo   `json:"hardware"`
	Verdicts       []ModelVerdict `json:"verdicts"`
	Recommendation string         `json:"recommendation"` // "repo:filename" or ""
	CheckedAt      time.Time      `json:"checked_at"`
	Error          string         `json:"error,omitempty"`
}

// Wails' service binding struct; here to prevent cycled deps (ai<->dbase) 
type HardwareService struct {
	Store        *dbase.Store
	fileCache    map[string][]ModelFile
	fileCacheAt  map[string]time.Time
	fileCacheMu  sync.Mutex
}

func CreateHardwareService(store *dbase.Store) *HardwareService {
	return &HardwareService{
		Store:       store,
		fileCache:   make(map[string][]ModelFile),
		fileCacheAt: make(map[string]time.Time),
	}
}

// ----- Hardware probing -----

func ProbeHardware() (HardwareInfo, error) {
	hw := HardwareInfo{}

	mem, err := memory.New()
	if err != nil {
		return hw, fmt.Errorf("probe memory: %w", err)
	}
	hw.TotalRAMGB = bytesToGB(mem.TotalUsableBytes)

	// GPU probe is best-effort; failure just means RAM-only budgeting
	if g, err := gpu.New(); err == nil {
		for _, card := range g.GraphicsCards {
			if card.DeviceInfo == nil || card.DeviceInfo.Vendor == nil {
				continue
			}
			vendor := card.DeviceInfo.Vendor.Name
			name := vendor
			if card.DeviceInfo.Product != nil && card.DeviceInfo.Product.Name != "" {
				name = card.DeviceInfo.Product.Name
			}
			if v, ok := classifyGPU(vendor); ok && hw.GPUVendor == "" {
				hw.HasGPU = true
				hw.GPUVendor = v
				hw.GPUName = name
			} else if !hw.HasGPU {
				hw.HasGPU = true
				hw.GPUVendor = vendor
				hw.GPUName = name
			}
		}
	}

	// VRAM not reported by ghw; run nvidia-smi for NVIDIA (the common discrete
	// case) and for AMD/Intel iGPUs, since VRAM is shared system RAM, let the latter govern
	if vram, ok := probeNVIDIAVRAM(); ok {
		hw.TotalVRAMGB = vram
	}
	return hw, nil
}


func classifyGPU(vendor string) (string, bool) {
	lv := strings.ToLower(vendor)
	switch {
	case strings.Contains(lv, "nvidia"), strings.Contains(lv, "geforce"), strings.Contains(lv, "quadro"):
		return "NVIDIA", true
	case strings.Contains(lv, "amd"), strings.Contains(lv, "radeon"), strings.Contains(lv, "advanced micro"):
		return "AMD", true
	case strings.Contains(lv, "intel"):
		return "Intel", true
	}
	return "", false
}

func probeNVIDIAVRAM() (float64, bool) {
	if _, err := exec.LookPath("nvidia-smi"); err != nil {
		return 0, false
	}
	out, err := exec.Command("nvidia-smi",
		"--query-gpu=memory.total", "--format=csv,noheader,nounits").Output()
	if err != nil {
		return 0, false
	}
	var totalMB float64
	for _, line := range strings.Split(strings.TrimSpace(string(out)), "\n") {
		if mb, err := strconv.ParseFloat(strings.TrimSpace(line), 64); err == nil {
			totalMB += mb
		}
	}
	if totalMB <= 0 {
		return 0, false
	}
	return totalMB / 1024.0, true // MiB -> GiB
}

// ----- HuggingFace file listing -----

type ModelFile struct {
	Repo      string
	Filename  string
	SizeBytes int64
}

type hfModelResponse struct {
	Siblings []struct {
		Rfilename string `json:"rfilename"`
		Size      int64  `json:"size"`
	} `json:"siblings"`
}

var ggufRe = regexp.MustCompile(`\.gguf$`)

// Lits the .gguf files in a HF repo with their sizes, cached in-process for 1h
func (s *HardwareService) fetchModelFiles(repo string) ([]ModelFile, error) {
	s.fileCacheMu.Lock()
	if files, ok := s.fileCache[repo]; ok && time.Since(s.fileCacheAt[repo]) < time.Hour {
		s.fileCacheMu.Unlock()
		return files, nil
	}
	s.fileCacheMu.Unlock()

	resp, err := (&http.Client{Timeout: 20 * time.Second}).Get("https://huggingface.co/api/models/" + repo)
	if err != nil {
		return nil, fmt.Errorf("query HF for %s: %w", repo, err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != 200 {
		return nil, fmt.Errorf("HF returned %d for %s", resp.StatusCode, repo)
	}

	var parsed hfModelResponse
	if err := json.NewDecoder(resp.Body).Decode(&parsed); err != nil {
		return nil, fmt.Errorf("parse HF response for %s: %w", repo, err)
	}

	var files []ModelFile
	for _, sib := range parsed.Siblings {
		if ggufRe.MatchString(sib.Rfilename) {
			files = append(files, ModelFile{Repo: repo, Filename: sib.Rfilename, SizeBytes: sib.Size})
		}
	}

	s.fileCacheMu.Lock()
	s.fileCache[repo] = files
	s.fileCacheAt[repo] = time.Now()
	s.fileCacheMu.Unlock()
	return files, nil
}

// ----- Evaluation -----

// Builds per-file verdicts and auto-selects the largest file that fits either VRAM, RAM, or neither
func (s *HardwareService) EvaluateModels(hw HardwareInfo) HardwareReport {
	report := HardwareReport{Hardware: hw, CheckedAt: time.Now()}
	ramBytes := int64(hw.TotalRAMGB * 1e9)
	vramBytes := int64(hw.TotalVRAMGB * 1e9)

	var recommended, usable []ModelVerdict

	for _, repo := range CandidateRepos {
		files, err := s.fetchModelFiles(repo)
		if err != nil || len(files) == 0 {
			note := "no .gguf files found in repo"
			if err != nil {
				note = "could not fetch file list: " + err.Error()
			}
			report.Verdicts = append(report.Verdicts, ModelVerdict{Repo: repo, Verdict: VerdictTooHeavy, Note: note})
			continue
		}

		for _, f := range files {
			required := int64(float64(f.SizeBytes) * memoryHeadroom)
			mv := ModelVerdict{Repo: f.Repo, Filename: f.Filename, SizeGB: bytesToGB(f.SizeBytes)}
			switch {
			case hw.TotalVRAMGB > 0 && required <= vramBytes:
				mv.Verdict = VerdictRecommended
				mv.Note = "fits in GPU VRAM"
				recommended = append(recommended, mv)
			case required <= ramBytes:
				mv.Verdict = VerdictUsable
				if hw.TotalVRAMGB > 0 {
					mv.Note = "too large for VRAM; will run on CPU (slower)"
				} else {
					mv.Note = "no dedicated VRAM; will run on CPU / shared memory"
				}
				usable = append(usable, mv)
			default:
				mv.Verdict = VerdictTooHeavy
				mv.Note = "does not fit in RAM or VRAM"
			}
			report.Verdicts = append(report.Verdicts, mv)
		}
	}

	// Largest file ≈ highest quant within the budget -> best quality that fits
	pick := func(pool []ModelVerdict) ModelVerdict {
		sort.SliceStable(pool, func(i, j int) bool { return pool[i].SizeGB > pool[j].SizeGB })
		return pool[0]
	}
	switch {
	case len(recommended) > 0:
		best := pick(recommended)
		report.Recommendation = best.Repo + ":" + best.Filename
	case len(usable) > 0:
		best := pick(usable)
		report.Recommendation = best.Repo + ":" + best.Filename
	}
	return report
}

// ----- Bindings -----

// Run a fresh probe + evaluation, caches it, and selects recommended model for the user (if none was chosen before)
func (s *HardwareService) CheckHardware() HardwareReport {
	hw, err := ProbeHardware()
	if err != nil {
		rep := HardwareReport{CheckedAt: time.Now(), Error: err.Error()}
		s.cacheReport(rep)
		return rep
	}
	report := s.EvaluateModels(hw)
	s.cacheReport(report)
	if report.Recommendation != "" && s.Store.GetUserPreference("vlm_model", "") == "" {
		s.Store.SetUserPreference("vlm_model", report.Recommendation)
	}
	return report
}

// Return the last cached report without re-scanning
func (s *HardwareService) GetHardwareReport() HardwareReport {
	raw := s.Store.GetUserPreference("vlm_hardware_report", "")
	var rep HardwareReport
	if raw == "" || json.Unmarshal([]byte(raw), &rep) != nil {
		return HardwareReport{}
	}
	return rep
}

func (s *HardwareService) GetSelectedModel() string {
	return s.Store.GetUserPreference("vlm_model", DefaultModelRef())
}

//  Overrides the auto-pick with a "repo:filename" (or bare repo)
func (s *HardwareService) SelectModel(ref string) error {
	if ref == "" {
		return fmt.Errorf("empty model reference")
	}
	return s.Store.SetUserPreference("vlm_model", ref)
}

func (s *HardwareService) cacheReport(rep HardwareReport) {
	raw, err := json.Marshal(rep)
	if err != nil {
		log.Printf("hardware: marshal report: %v", err)
		return
	}
	if err := s.Store.SetUserPreference("vlm_hardware_report", string(raw)); err != nil {
		log.Printf("hardware: cache report: %v", err)
	}
}

func bytesToGB(b int64) float64 {
	if b <= 0 {
		return 0
	}
	return float64(b) / 1e9
}