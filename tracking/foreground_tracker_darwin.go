//go:build darwin

package tracking

/*
#cgo CFLAGS: -x objective-c
#cgo LDFLAGS: -framework Cocoa -framework AppKit

#import <Cocoa/Cocoa.h>
#include <stdlib.h>

// ONLY declarations (!)
extern void startObserver();
extern void stopObserver();
extern void runLoop();
extern char* getCurrentActiveApp();
*/
import "C"
import (
    "fmt"
    "sync"
    "unsafe"
)

var (
    appChangeChanMu     sync.Mutex
    appChangeChanGlobal chan<- string
)

//export onForegroundAppChanged
func onForegroundAppChanged(appName *C.char) {
    name := C.GoString(appName)

    fmt.Printf("\n[Focus] App: %-20s\n", name)

    appChangeChanMu.Lock()
    ch := appChangeChanGlobal
    appChangeChanMu.Unlock()

    if ch == nil {
        return
    }

    go func(n string) {
        ch <- n
    }(name)
}

// observe NSWorkspace notifications to detect app switches
//
// CRITICAL FOR STANDALONE USAGE: macOS requires Cocoa to run on the OS thread 
// that initialized it. If testing this without Wails, runtime.LockOSThread() MUST be called
// at the very beginning of main before calling this, otherwise the Go scheduler will move goroutines and crash
func StartForegroundTracker(appChangeChan chan<- string) {
	appChangeChanMu.Lock()
	appChangeChanGlobal = appChangeChan
	appChangeChanMu.Unlock()

	C.startObserver()
    
	// If running inside Wails, Wails handles the run loop. 
	// For standalone testing, you need this to block and process events.
	C.runLoop() 
	
	C.stopObserver()

	appChangeChanMu.Lock()
	appChangeChanGlobal = nil
	appChangeChanMu.Unlock()
}

func GetCurrentActiveApp() string {
	cStr := C.getCurrentActiveApp()
	if cStr == nil {
		return "Desktop"
	}
	defer C.free(unsafe.Pointer(cStr))
	return C.GoString(cStr)
}