//
//  ViewController.swift
//  darkfo
//
//  Created by Max Desiatov on 28/02/2019.
//  Copyright © 2019 Max Desiatov. DarkFO is licensed under the terms of the
//  Apache 2 license. See LICENSE.txt for the full license text.
//

import AppKit
import Foundation
import WebKit

final class ViewController: NSViewController {
  private let webView = WKWebView(frame: .zero)
  private var preferences: NSWindowController?

  private var urlParameter = "artemple"
  init() {
    super.init(nibName: nil, bundle: nil)
  }

  override func loadView() {
    view = NSView()
  }

  override func viewDidLoad() {
    webView.translatesAutoresizingMaskIntoConstraints = false

    view.addSubview(webView)

    NSLayoutConstraint.activate([
      view.widthAnchor.constraint(greaterThanOrEqualToConstant: 800),
      // for some reason 700 leaves empty pixels at the bottom
      view.heightAnchor.constraint(greaterThanOrEqualToConstant: 699),

      webView.topAnchor.constraint(equalTo: view.topAnchor),
      webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
    ])

    reload()
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  private func reload() {
    let req = URLRequest(url:
      URL(string: "http://localhost:8000/play.html?\(urlParameter)")!
    )
    webView.load(req)
  }

  @IBAction func preferencesPressed(_ sender: NSMenuItem) {
    defer { preferences?.window?.makeKey() }

    guard preferences == nil else {
      return
    }

    let window = NSWindow(contentViewController: PreferencesController(
      defaultValue: urlParameter
    ) { [weak self] in
      self?.urlParameter = $0
      self?.reload()
    })
    window.title = "Preferences"
    window.delegate = self

    preferences = NSWindowController(window: window)
    preferences?.showWindow(self)
  }
}

extension ViewController: NSWindowDelegate {
  func windowWillClose(_ notification: Notification) {
    preferences = nil
  }
}
