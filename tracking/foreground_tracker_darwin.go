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
    stopChan            = make(chan struct{})
    stopOnce            sync.Once
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

// register an NSWorkspace observer that fires onForegroundAppChanged 
// Wails drives the loop run so blocking execution until the observer is stopped is enough
func StartForegroundTracker(appChangeChan chan<- string) {
	appChangeChanMu.Lock()
	appChangeChanGlobal = appChangeChan
	appChangeChanMu.Unlock()

	C.startObserver()

	<-stopChan

	C.stopObserver()

	appChangeChanMu.Lock()
	appChangeChanGlobal = nil
	appChangeChanMu.Unlock()
}

// signal StartForegroundTracker to unregister the observer and return (to be called from Wails' OnShutdown)
func StopForegroundTracker() {
	stopOnce.Do(func() { close(stopChan) })
}

func GetCurrentActiveApp() string {
	cStr := C.getCurrentActiveApp()
	if cStr == nil {
		return "Desktop"
	}
	defer C.free(unsafe.Pointer(cStr))
	return C.GoString(cStr)
}