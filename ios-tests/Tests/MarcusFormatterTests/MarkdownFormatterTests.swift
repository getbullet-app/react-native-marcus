import UIKit
import XCTest

@testable import MarcusFormatter

/// The iOS render model, driven by the same corpus every other layer uses.
///
/// Ranges come from `ranges.json`, produced by the JS parser, so this suite
/// needs neither a JS runtime nor the app.
final class MarkdownFormatterTests: XCTestCase {

  private let style = RCTMarcusStyle()
  private let fonts = TestFonts()

  private var defaultAttributes: [NSAttributedString.Key: Any] {
    [.font: UIFont(name: "Helvetica", size: 16) ?? UIFont.systemFont(ofSize: 16)]
  }

  func testFormatsEveryFixtureIntoTheSharedRenderModel() throws {
    let cases = try load([Case].self, from: "cases")
    let ranges = try load([String: [Range]].self, from: "ranges")

    var dump = ""

    for testCase in cases {
      let attributed = NSMutableAttributedString(string: testCase.markdown)

      MarkdownFormatter.format(
        attributed,
        defaultTextAttributes: defaultAttributes,
        ranges: (ranges[testCase.id] ?? []).map(\.asMarcusRange),
        style: style,
        fonts: fonts
      )

      dump += testCase.id + "\n"
      dump += RenderModel.dump(attributed, defaults: defaultAttributes)
        .split(separator: "\n", omittingEmptySubsequences: false)
        .map { "  " + $0 }
        .joined(separator: "\n")
      dump += "\n"
    }

    try compareAgainstBaseline(dump, named: "render-model.txt")
  }

  func testAppliesBoldAcrossTheWholeEmphasisSpan() {
    let attributed = NSMutableAttributedString(string: "**bold**")

    MarkdownFormatter.format(
      attributed,
      defaultTextAttributes: defaultAttributes,
      ranges: [
        MarcusRange(type: "bold", range: NSRange(location: 0, length: 8), depth: 0),
        MarcusRange(type: "syntax", range: NSRange(location: 0, length: 2), depth: 0),
        MarcusRange(type: "syntax", range: NSRange(location: 6, length: 2), depth: 0),
      ],
      style: style,
      fonts: fonts
    )

    let model = RenderModel.dump(attributed, defaults: defaultAttributes)

    XCTAssertTrue(model.contains("bold"), model)
    XCTAssertTrue(model.contains("color(#808080)"), model)
  }

  func testLeavesPlainTextUnstyled() {
    let attributed = NSMutableAttributedString(string: "no markdown here")

    MarkdownFormatter.format(
      attributed,
      defaultTextAttributes: defaultAttributes,
      ranges: [],
      style: style,
      fonts: fonts
    )

    let model = RenderModel.dump(attributed, defaults: defaultAttributes)

    XCTAssertFalse(model.contains("bold"), model)
    XCTAssertFalse(model.contains("color("), model)
  }

  // MARK: - Support

  /// Predictable font resolution, so the baseline records what the formatter
  /// asked for rather than what a device happened to have installed.
  private struct TestFonts: MarkdownFontProviding {
    func update(_ font: UIFont?, weight: String) -> UIFont? {
      let base = font ?? UIFont.systemFont(ofSize: 16)
      return apply(.traitBold, to: base)
    }

    func update(_ font: UIFont?, style: String) -> UIFont? {
      let base = font ?? UIFont.systemFont(ofSize: 16)
      return apply(.traitItalic, to: base)
    }

    func update(_ font: UIFont?, family: String?, size: CGFloat, weight: String?) -> UIFont? {
      let resolved = family.flatMap { UIFont(name: $0, size: size) }
        ?? UIFont(name: "Helvetica", size: size)
        ?? UIFont.systemFont(ofSize: size)

      return weight == "bold" ? apply(.traitBold, to: resolved) : resolved
    }

    private func apply(_ trait: UIFontDescriptor.SymbolicTraits, to font: UIFont) -> UIFont {
      let traits = font.fontDescriptor.symbolicTraits.union(trait)
      guard let descriptor = font.fontDescriptor.withSymbolicTraits(traits) else { return font }
      return UIFont(descriptor: descriptor, size: font.pointSize)
    }
  }

  private struct Case: Decodable {
    let id: String
    let markdown: String
  }

  private struct Range: Decodable {
    let type: String
    let start: Int
    let length: Int
    let depth: Int?

    var asMarcusRange: MarcusRange {
      MarcusRange(
        type: type,
        range: NSRange(location: start, length: length),
        depth: UInt(depth ?? 0)
      )
    }
  }

  private func load<T: Decodable>(_ type: T.Type, from name: String) throws -> T {
    let url = try XCTUnwrap(
      Bundle.module.url(forResource: name, withExtension: "json", subdirectory: "fixtures"),
      "\(name).json is not in the test bundle -- is the fixtures symlink intact?"
    )

    return try JSONDecoder().decode(type, from: Data(contentsOf: url))
  }

  /// Baselines live beside the sources rather than in the bundle, so updating
  /// one is a normal edit to a committed file. Delete it to regenerate.
  private func compareAgainstBaseline(_ actual: String, named name: String) throws {
    let baseline = URL(fileURLWithPath: #filePath)
      .deletingLastPathComponent()
      .appendingPathComponent("__baselines__/\(name)")

    guard FileManager.default.fileExists(atPath: baseline.path) else {
      try FileManager.default.createDirectory(
        at: baseline.deletingLastPathComponent(),
        withIntermediateDirectories: true
      )
      try actual.write(to: baseline, atomically: true, encoding: .utf8)
      print("Wrote baseline to \(baseline.path)")
      return
    }

    XCTAssertEqual(try String(contentsOf: baseline, encoding: .utf8), actual)
  }
}
