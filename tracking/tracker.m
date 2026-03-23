// +build darwin

#import <Cocoa/Cocoa.h>
#import <AppKit/AppKit.h>
#include <stdlib.h>

// includes the Go functions exported with //export
#include "_cgo_export.h"

@interface AppFocusObserver : NSObject
@end

@implementation AppFocusObserver
- (void)activeAppDidChange:(NSNotification *)notification {
    NSDictionary *userInfo = notification.userInfo;
    NSRunningApplication *app = userInfo[NSWorkspaceApplicationKey];

    if (app == nil) return;

    if (app.activationPolicy != NSApplicationActivationPolicyRegular) {
        return;
    }

    NSString *name = app.localizedName;
    if (name == nil || name.length == 0) {
        name = app.bundleIdentifier;
    }
    if (name == nil || name.length == 0) {
        name = @"Unknown";
    }

    const char *cName = [name UTF8String];
    
    // call the Go function!
    onForegroundAppChanged((char*)cName);
}
@end

static AppFocusObserver *globalObserver = nil;

void startObserver() {
    dispatch_async(dispatch_get_main_queue(), ^{
        if (globalObserver != nil) return; 

        globalObserver = [[AppFocusObserver alloc] init];

        [[[NSWorkspace sharedWorkspace] notificationCenter]
            addObserver:globalObserver
               selector:@selector(activeAppDidChange:)
                   name:NSWorkspaceDidActivateApplicationNotification
                 object:nil];
    });
}

void stopObserver() {
    dispatch_async(dispatch_get_main_queue(), ^{
        if (globalObserver != nil) {
            [[[NSWorkspace sharedWorkspace] notificationCenter]
                removeObserver:globalObserver];
            globalObserver = nil;
        }
    });
}

void runLoop() {
    [[NSRunLoop currentRunLoop] runUntilDate:[NSDate distantFuture]];
}

char* getCurrentActiveApp() {
    @autoreleasepool {
        NSRunningApplication *app = [[NSWorkspace sharedWorkspace] frontmostApplication];

        NSString *name = app ? app.localizedName : nil;
        if (name == nil || name.length == 0) {
            name = app ? app.bundleIdentifier : @"Desktop";
        }
        if (name == nil || name.length == 0) {
            name = @"Desktop";
        }

        return strdup([name UTF8String]);
    }
}