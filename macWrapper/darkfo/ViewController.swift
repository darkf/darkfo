//
//  ViewController.swift
//  darkfo
//
//  Created by Max Desiatov on 28/02/2019.
//  Copyright © 2019 Max Desiatov. All rights reserved.
//

import AppKit
import Foundation
import WebKit

final class ViewController: NSViewController {
  private let webView = WKWebView(frame: .zero)

  init() {
    super.init(nibName: nil, bundle: nil)
  }

  override func loadView() {
    view = NSView(frame: CGRect(x: 0, y: 0, width: 640, height: 480))
  }

  override func viewDidLoad() {
    webView.translatesAutoresizingMaskIntoConstraints = false

    view.addSubview(webView)

    NSLayoutConstraint.activate([
      view.widthAnchor.constraint(greaterThanOrEqualToConstant: 800),
      view.heightAnchor.constraint(greaterThanOrEqualToConstant: 700),

      webView.topAnchor.constraint(equalTo: view.topAnchor),
      webView.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      webView.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      webView.trailingAnchor.constraint(equalTo: view.trailingAnchor)
    ])

    let req = URLRequest(url: URL(string: "http://localhost:8000/play.html?artemple")!)
    webView.navigationDelegate = self
    webView.load(req)
  }
  
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }
}

extension ViewController: WKNavigationDelegate {
}
