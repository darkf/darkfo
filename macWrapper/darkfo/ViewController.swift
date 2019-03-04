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
  let wv = WKWebView(frame: .zero)

  let center = NSTextView(frame: .zero)

  init() {
    super.init(nibName: nil, bundle: nil)
  }

  override func loadView() {
    view = NSView(frame: CGRect(x: 0, y: 0, width: 640, height: 480))
  }

  override func viewDidLoad() {
    wv.translatesAutoresizingMaskIntoConstraints = false
    center.string = "blah"
    center.translatesAutoresizingMaskIntoConstraints = false

    view.addSubview(wv)

    NSLayoutConstraint.activate([
      view.widthAnchor.constraint(greaterThanOrEqualToConstant: 800),
      view.heightAnchor.constraint(greaterThanOrEqualToConstant: 700),

      wv.topAnchor.constraint(equalTo: view.topAnchor),
      wv.bottomAnchor.constraint(equalTo: view.bottomAnchor),
      wv.leadingAnchor.constraint(equalTo: view.leadingAnchor),
      wv.trailingAnchor.constraint(equalTo: view.trailingAnchor)
    ])

    let req = URLRequest(url: URL(string: "http://localhost:8000/play.html?artemple")!)
    wv.navigationDelegate = self
    wv.load(req)
  }
  
  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }
}

extension ViewController: WKNavigationDelegate {
}
