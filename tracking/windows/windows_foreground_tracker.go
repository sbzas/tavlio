package tracking

import (
	"fmt"
	"path/filepath"
	"strings"
	"syscall"
	"unsafe"

	"golang.org/x/sys/windows"
)

var (
    user32                        = windows.NewLazySystemDLL("user32.dll")
    kernel32                      = windows.NewLazySystemDLL("kernel32.dll")
    procSetWinEventHook           = user32.NewProc("SetWinEventHook")
    procUnhookWinEvent            = user32.NewProc("UnhookWinEvent")
    procGetMessage                = user32.NewProc("GetMessageW")
    procDispatchMessage           = user32.NewProc("DispatchMessageW")
    procGetWindowThreadProcessId  = user32.NewProc("GetWindowThreadProcessId")
    procOpenProcess               = kernel32.NewProc("OpenProcess")
    procQueryFullProcessImageName = kernel32.NewProc("QueryFullProcessImageNameW")
    procGetClassName              = user32.NewProc("GetClassNameW")

    procGetForegroundWindow = user32.NewProc("GetForegroundWindow")

    // necessary for grabbing human-friendly app names
	version                    = windows.NewLazySystemDLL("version.dll")
	procGetFileVersionInfoSize = version.NewProc("GetFileVersionInfoSizeW")
	procGetFileVersionInfo     = version.NewProc("GetFileVersionInfoW")
	procVerQueryValue          = version.NewProc("VerQueryValueW")
)

const (
    EVENT_SYSTEM_FOREGROUND           = 0x0003
    WINEVENT_OUTOFCONTEXT             = 0x0000
    PROCESS_QUERY_LIMITED_INFORMATION = 0x1000
)

// Run a foreground app tracker that sends app names back to main thread
func StartForegroundTracker(appChangeChan chan<- string) {
    callback := syscall.NewCallback(func(hWinEventHook, event, hwnd, idObject, idChild, dwEventThread, dwmsEventTime uintptr) uintptr {
        if event == EVENT_SYSTEM_FOREGROUND {
            friendlyName, isValid := getAppDetailsFromHWND(hwnd)
        
            // if helper function flagged this as noise, escape the callback
            if !isValid {
                return 0
            }

            // testing purposes
            fmt.Printf("\n[Focus] App: %-20s\n", friendlyName)

            // non-blocking send to channel to prevent blocking Windows callback
            go func(name string) {
                appChangeChan <- name
            }(friendlyName)
        }

        return 0
    })

    hook, _, _ := procSetWinEventHook.Call(
        EVENT_SYSTEM_FOREGROUND,
        EVENT_SYSTEM_FOREGROUND,
        0,
        callback,
        0,
        0,
        WINEVENT_OUTOFCONTEXT,
    )

    if hook == 0 {
        return
    }
    defer procUnhookWinEvent.Call(hook)

    // msg loop
    var msg struct {
        hwnd    uintptr
        message uint32
        wParam  uintptr
        lParam  uintptr
        time    uint32
        pt      struct{ x, y int32 }
    }

    for {
        ret, _, _ := procGetMessage.Call(uintptr(unsafe.Pointer(&msg)), 0, 0, 0)
        if ret == 0 {
            break
        }
        procDispatchMessage.Call(uintptr(unsafe.Pointer(&msg)))
    }
}

// Get PID and exe name from window handle
func getProcessInfo(hwnd uintptr) (uint32, string) {
    var pid uint32
    procGetWindowThreadProcessId.Call(hwnd, uintptr(unsafe.Pointer(&pid)))

    hProcess, _, _ := procOpenProcess.Call(PROCESS_QUERY_LIMITED_INFORMATION, 0, uintptr(pid))
    if hProcess == 0 {
        return pid, "Unknown"
    }
    defer windows.CloseHandle(windows.Handle(hProcess))

    buf := make([]uint16, 1024)
    size := uint32(len(buf))
    ret, _, _ := procQueryFullProcessImageName.Call(hProcess, 0, uintptr(unsafe.Pointer(&buf[0])), uintptr(unsafe.Pointer(&size)))

    if ret == 0 {
        return pid, "Unknown"
    }
    return pid, syscall.UTF16ToString(buf[:size])
}

// Get window class name
func getClassName(hwnd uintptr) string {
    buf := make([]uint16, 256)
    ret, _, _ := procGetClassName.Call(
        hwnd,
        uintptr(unsafe.Pointer(&buf[0])),
        uintptr(len(buf)),
    )
    if ret == 0 {
        return ""
    }
    return syscall.UTF16ToString(buf)
}

// read the embedded "human-friendly" name from an exe file
func getFileDescription(exePath string) string {
	pathPtr, err := syscall.UTF16PtrFromString(exePath)
	if err != nil {
		return ""
	}

	// get the size of the version info block
	size, _, _ := procGetFileVersionInfoSize.Call(uintptr(unsafe.Pointer(pathPtr)), 0)
	if size == 0 {
		return ""
	}

	// allocate memory and retrieve the version info block
	info := make([]byte, size)
	ret, _, _ := procGetFileVersionInfo.Call(
		uintptr(unsafe.Pointer(pathPtr)),
		0,
		size,
		uintptr(unsafe.Pointer(&info[0])),
	)
	if ret == 0 {
		return ""
	}

    // query the Translation table to find the language/codepage
	var transPtr unsafe.Pointer 
	var transLen uint32

	transStrPtr, _ := syscall.UTF16PtrFromString(`\VarFileInfo\Translation`)

	ret, _, _ = procVerQueryValue.Call(
		uintptr(unsafe.Pointer(&info[0])),
		uintptr(unsafe.Pointer(transStrPtr)),
		uintptr(unsafe.Pointer(&transPtr)),
		uintptr(unsafe.Pointer(&transLen)),
	)

	if ret == 0 || transLen < 4 {
		return ""
	}

	// extract Language ID and Codepage from the pointer
	lang := *(*uint16)(transPtr)
	
	// use unsafe.Add for safe pointer arithmetic preventing go linter warnings for potential invalid memory pointers
	codepage := *(*uint16)(unsafe.Add(transPtr, 2))

	// build the query string for the FileDescription
	subBlock := fmt.Sprintf(`\StringFileInfo\%04x%04x\FileDescription`, lang, codepage)

    // query the actual FileDescription string
	var descPtr *uint16 
	var descLen uint32

	subBlockPtr, _ := syscall.UTF16PtrFromString(subBlock)

	ret, _, _ = procVerQueryValue.Call(
		uintptr(unsafe.Pointer(&info[0])),
		uintptr(unsafe.Pointer(subBlockPtr)),
		uintptr(unsafe.Pointer(&descPtr)), // Windows writes the *uint16 address directly here
		uintptr(unsafe.Pointer(&descLen)),
	)

	if ret == 0 || descLen == 0 {
		return ""
	}

	return windows.UTF16PtrToString(descPtr)
}

// evaluate a window handle to return its human-friendly name or "false" if app is considered system noise
func getAppDetailsFromHWND(hwnd uintptr) (string, bool) {
    if hwnd == 0 {
        return "", false
    }

    _, exePath := getProcessInfo(hwnd)
    className := getClassName(hwnd)

    // Extract just the filename (e.g., "chrome.exe") in case the description is empty
    exeName := filepath.Base(exePath) 

    // filter noise
    if exeName == "explorer.exe" || exeName == "Explorer.EXE" {
        if className != "CabinetWClass" {
            return "", false
        }
        exeName = "File Explorer"
    }

    // ignore alt + tab overlays
    if className == "TaskSwitcherWnd" || className == "MultitaskingViewFrame" {
        return "", false
    }

    friendlyName := getFileDescription(exePath)

    // Fallback to the .exe name if the developer didn't include a FileDescription
    if friendlyName == "" {
        friendlyName = strings.TrimSuffix(exeName, filepath.Ext(exeName)) 
    } 

    return friendlyName, true
}

// gets the current window's (in focus) app name on app startup
func GetCurrentActiveApp() string {
    hwnd, _, _ := procGetForegroundWindow.Call()
    
    friendlyName, isValid := getAppDetailsFromHWND(hwnd)
    
    // If the app starts while the user is focused on the desktop or taskbar
    if !isValid || friendlyName == "" {
        return "Desktop"
    }

    return friendlyName
}