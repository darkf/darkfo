//
//  AppDelegate.swift
//  darkfo
//
//  Created by Max Desiatov on 28/02/2019.
//  Copyright © 2019 Max Desiatov. All rights reserved.
//

import Cocoa

@NSApplicationMain
class AppDelegate: NSObject, NSApplicationDelegate {
  @IBOutlet weak var window: NSWindow!


  func applicationDidFinishLaunching(_ aNotification: Notification) {
    window.contentViewController = ViewController()
  }

  func applicationWillTerminate(_ aNotification: Notification) {
      // Insert code here to tear down your application
  }
}
