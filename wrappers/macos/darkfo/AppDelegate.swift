//
//  AppDelegate.swift
//  darkfo
//
//  Created by Max Desiatov on 28/02/2019.
//  Copyright © 2019 Max Desiatov. DarkFO is licensed under the terms of the
//  Apache 2 license. See LICENSE.txt for the full license text.
//

import Cocoa

@NSApplicationMain
class AppDelegate: NSObject, NSApplicationDelegate {
  @IBOutlet weak var window: NSWindow!


  func applicationDidFinishLaunching(_ aNotification: Notification) {
    window.contentViewController = ViewController()
    window.makeKeyAndOrderFront(self)
    window.setFrameOrigin(CGPoint(x: 100, y: 1000))
  }

  func applicationWillTerminate(_ aNotification: Notification) {
      // Insert code here to tear down your application
  }
}
