//
//  PreferencesController.swift
//  darkfo
//
//  Created by Max Desiatov on 05/03/2019.
//  Copyright © 2019 Max Desiatov. All rights reserved.
//

import AppKit
import Foundation

final class PreferencesController: NSViewController {
  private let stack = NSStackView()
  private let label = NSTextView()
  private let field = NSTextField()
  private let button = NSButton()

  private let defaultValue: String
  private let onReload: (String) -> ()

  init(defaultValue: String, onReload: @escaping (String) -> ()) {
    self.defaultValue = defaultValue
    self.onReload = onReload

    super.init(nibName: nil, bundle: nil)
  }

  required init?(coder: NSCoder) {
    fatalError("init(coder:) has not been implemented")
  }

  override func loadView() {
    view = NSView()
  }

  override func viewDidLoad() {
    stack.distribution = .fillProportionally
    stack.orientation = .vertical

    view.addSubview(stack)
    stack.translatesAutoresizingMaskIntoConstraints = false

    label.string = "URL parameters:"
    label.backgroundColor = .clear
    label.isEditable = false

    field.stringValue = defaultValue

    button.title = "Reload"
    button.bezelStyle = .rounded
    button.target = self
    button.action = #selector(onButtonPress)

    stack.addArrangedSubview(label)
    stack.addArrangedSubview(field)
    stack.addArrangedSubview(button)

    NSLayoutConstraint.activate([
      view.widthAnchor.constraint(equalToConstant: 320),
      view.heightAnchor.constraint(equalToConstant: 150),
      label.heightAnchor.constraint(equalToConstant: 30),
      stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
      stack.centerXAnchor.constraint(equalTo: view.centerXAnchor),
      stack.widthAnchor.constraint(equalToConstant: 200)
    ])

    field.becomeFirstResponder()
  }

  @objc func onButtonPress() {
    onReload(field.stringValue)
  }
}
