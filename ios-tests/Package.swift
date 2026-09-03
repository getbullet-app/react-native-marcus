// swift-tools-version:5.9
import PackageDescription

/// Compiles the React-free half of the formatter so it can be tested without
/// the pod graph.
///
/// The Swift sources are symlinks to `apple/`, not copies -- a copy would rot
/// the first time someone edited the real file. What is *not* symlinked is the
/// three small Objective-C value types the formatter takes as parameters
/// (`MarcusRange`, `RCTMarcusStyle`, and the attribute keys): SwiftPM cannot mix
/// Objective-C and Swift in one target, and splitting them into two would need a
/// module import that production has no reason to carry. `Stubs.swift` defines
/// them in Swift instead. They hold and return values and nothing else, so the
/// formatter under test is the real one; if the real declarations ever gain a
/// property, this package stops compiling, which is the failure you want.
let package = Package(
  name: "MarcusFormatter",
  platforms: [.iOS(.v16)],
  targets: [
    .target(name: "MarcusFormatter", path: "Sources/MarcusFormatter"),
    .testTarget(
      name: "MarcusFormatterTests",
      dependencies: ["MarcusFormatter"],
      path: "Tests/MarcusFormatterTests",
      resources: [.copy("fixtures")]
    ),
  ]
)
