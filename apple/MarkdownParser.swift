import CxxStdlib
import Foundation
import MarkdownCxx

/// Caches markdown ranges and keeps the parser off the main thread.
///
/// Running the worklet waits on the markdown runtime. Waiting for it on the main
/// thread during a Yoga measure could outlast the watchdog, so callers on the
/// main thread use `cachedRanges(forText:withParserId:)` and fall back to
/// `warmCacheAsync(forText:withParserId:completion:)`.
@objc public final class MarkdownParser: NSObject {

  /// One shared instance, so the view layer and the shadow node's measure pass
  /// hit the same cache. With an instance each, every keystroke was parsed
  /// twice: once when the text view reformatted, and again when the shadow node
  /// measured and found its own cache empty.
  @objc public static let sharedParser = MarkdownParser()

  private struct CacheEntry {
    let text: String
    let parserId: Int
    let ranges: [MarcusRange]
  }

  /// One entry is not enough once the main thread is restricted to cached
  /// ranges: two texts alternating (typing then undoing, or an input echoing
  /// older text back) evict each other and the main thread never finds what it
  /// needs. The cache is also shared by every markdown input on screen, so it
  /// needs room for a few distinct texts -- still short enough to scan linearly,
  /// and entries only hold range objects.
  private static let cacheCapacity = 8

  /// Serial on purpose: the markdown runtime runs one parse at a time anyway,
  /// and serialising here avoids doing the same work twice.
  private static let warmupQueue = DispatchQueue(
    label: "app.getbullet.marcus.parser-cache-warmup",
    qos: .userInitiated
  )

  /// Guards everything below, and is never held across a parse. Holding a lock
  /// while waiting on the markdown runtime is what let a background parse block
  /// the main thread until iOS killed the app.
  private let lock = NSLock()

  /// Newest entry first.
  private var cache: [CacheEntry] = []

  private var pendingText: String?
  private var pendingParserId: NSNumber?
  private var pendingCompletion: (() -> Void)?
  private var warmupScheduled = false

  // MARK: - Cache

  /// Returns the ranges for (text, parserId) only if they are already cached.
  /// Never runs the parser, so it is safe on the main thread.
  @objc public func cachedRanges(
    forText text: String,
    withParserId parserId: NSNumber
  ) -> [MarcusRange]? {
    lock.lock()
    defer { lock.unlock() }

    guard
      let index = cache.firstIndex(where: {
        $0.parserId == parserId.intValue && $0.text == text
      })
    else { return nil }

    guard index != 0 else { return cache[0].ranges }

    // Promote, so text asked for repeatedly is not the next evicted.
    let entry = cache.remove(at: index)
    cache.insert(entry, at: 0)
    return entry.ranges
  }

  private func store(
    _ ranges: [MarcusRange],
    forText text: String,
    parserId: NSNumber
  ) {
    lock.lock()
    defer { lock.unlock() }

    cache.removeAll { $0.parserId == parserId.intValue && $0.text == text }
    cache.insert(
      CacheEntry(text: text, parserId: parserId.intValue, ranges: ranges),
      at: 0
    )
    if cache.count > Self.cacheCapacity {
      cache.removeLast(cache.count - Self.cacheCapacity)
    }
  }

  // MARK: - Parsing

  /// Returns cached ranges when there are any, otherwise parses and caches.
  /// Never call this from the main thread on a layout path.
  @objc public func parse(_ text: String, withParserId parserId: NSNumber)
    -> [MarcusRange]
  {
    if let cached = cachedRanges(forText: text, withParserId: parserId) {
      return cached
    }

    // Deliberately parsed with no lock held. Two threads may parse the same text
    // concurrently, which is harmless -- they produce the same result.
    let ranges = parseUncached(text, parserId: parserId)
    store(ranges, forText: text, parserId: parserId)
    return ranges
  }

  private func parseUncached(_ text: String, parserId: NSNumber)
    -> [MarcusRange]
  {
    // `utf16.count` is the unit the worklet reports range offsets in.
    let result = bulletpoint.marcus.parseMarkdown(
      std.string(text),
      text.utf16.count,
      Int32(parserId.intValue)
    )

    let schemaError = String(result.schemaError)
    if !schemaError.isEmpty {
      markdownLogWarn(
        "[react-native-marcus] Incorrect schema of worklet parser output: \(schemaError)"
      )
    }

    return result.ranges.map { range in
      MarcusRange(
        type: String(range.type),
        range: NSRange(location: Int(range.start), length: Int(range.length)),
        depth: UInt(range.depth)
      )
    }
  }

  // MARK: - Background warm-up

  /// Parses on a background queue and caches the result, so the caller never
  /// waits on the markdown runtime.
  ///
  /// Only the newest request survives: a later call replaces one that is still
  /// queued. A parse already in flight cannot be cancelled, but the newest text
  /// is picked up as soon as it finishes.
  ///
  /// `completion` runs on the background queue once the ranges are cached, and
  /// is skipped when a newer request replaced this one -- that request reports
  /// instead.
  @objc public func warmCacheAsync(
    forText text: String,
    withParserId parserId: NSNumber,
    completion: (() -> Void)?
  ) {
    lock.lock()
    // Keep only the newest request, so stale text can never win over newer text.
    // The replaced completion goes with it; the newer request reports instead.
    pendingText = text
    pendingParserId = parserId
    pendingCompletion = completion
    let alreadyScheduled = warmupScheduled
    warmupScheduled = true
    lock.unlock()

    // A drain loop is already running and will pick this up.
    guard !alreadyScheduled else { return }

    Self.warmupQueue.async { [weak self] in
      self?.drainPendingWarmups()
    }
  }

  private func drainPendingWarmups() {
    while true {
      lock.lock()
      guard let text = pendingText, let parserId = pendingParserId else {
        warmupScheduled = false
        lock.unlock()
        return
      }
      let completion = pendingCompletion
      pendingText = nil
      pendingParserId = nil
      pendingCompletion = nil
      lock.unlock()

      _ = parse(text, withParserId: parserId)

      lock.lock()
      let superseded = pendingText != nil
      lock.unlock()

      if !superseded {
        completion?()
      }
    }
  }
}
