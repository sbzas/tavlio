package tracking

import (
	"fmt"
	"path/filepath"
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
            pid, exePath := getProcessInfo(hwnd)
            className := getClassName(hwnd)

            // Extract just the filename (e.g., "chrome.exe") in case the description is empty
            exeName := filepath.Base(exePath) 

            // filter noise
            if exeName == "explorer.exe" || exeName == "Explorer.EXE" {
                if className != "CabinetWClass" {
                    return 0
                }
                exeName = "File Explorer"
            }

            if className == "TaskSwitcherWnd" || className == "MultitaskingViewFrame" {
                return 0
            }

            // testing purposes
            fmt.Printf("\n[Focus] App: %-20s | PID: %d\n", exeName, pid)

            // non-blocking send to channel to prevent blocking Windows callback
            go func(name string) {
                appChangeChan <- name
            }(exeName)
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