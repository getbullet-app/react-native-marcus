import InputHistory from "../web/InputHistory"

describe("InputHistory", () => {
  beforeEach(() => {
    jest.useFakeTimers()
  })

  afterEach(() => {
    jest.useRealTimers()
  })

  it("seeds itself with the starting text", () => {
    const history = new InputHistory(10, 150, "hello")

    expect(history.getCurrentItem()).toEqual({ text: "hello", cursorPosition: 5 })
  })

  it("moves to each added entry", () => {
    const history = new InputHistory(10, 150, "")

    history.add("a", 1)
    history.add("ab", 2)

    expect(history.getCurrentItem()).toEqual({ text: "ab", cursorPosition: 2 })
  })

  it("ignores an add that does not change the text", () => {
    const history = new InputHistory(10, 150, "a")

    history.add("a", 0)

    expect(history.items).toHaveLength(1)
  })

  it("drops the oldest entry past its depth", () => {
    const history = new InputHistory(3, 150, "0")

    history.add("1", 1)
    history.add("2", 1)
    history.add("3", 1)

    expect(history.items).toHaveLength(3)
    expect(history.items.map((item) => item.text)).toEqual(["1", "2", "3"])
  })

  describe("undo", () => {
    it("returns the previous entry", () => {
      const history = new InputHistory(10, 150, "")
      history.add("abc", 3)

      expect(history.undo()).toEqual({ text: "", cursorPosition: 0 })
    })

    it("moves the cursor back by the length that was removed", () => {
      const history = new InputHistory(10, 150, "abc")
      history.add("abcdef", 6)

      expect(history.undo()).toEqual({ text: "abc", cursorPosition: 3 })
    })

    it("clamps the cursor to the restored text", () => {
      const history = new InputHistory(10, 150, "abcdef")
      history.add("ab", 0)

      const item = history.undo()

      expect(item!.cursorPosition).toBeLessThanOrEqual(item!.text.length)
    })

    it("returns null at the start of history", () => {
      const history = new InputHistory(10, 150, "a")

      expect(history.undo()).toBeNull()
    })
  })

  describe("redo", () => {
    it("returns the entry undone last", () => {
      const history = new InputHistory(10, 150, "")
      history.add("abc", 3)
      history.undo()

      expect(history.redo()).toEqual({ text: "abc", cursorPosition: 3 })
    })

    it("returns null at the end of history", () => {
      const history = new InputHistory(10, 150, "")
      history.add("abc", 3)

      expect(history.redo()).toBeNull()
    })

    it("is unavailable after typing over an undo", () => {
      const history = new InputHistory(10, 150, "")
      history.add("abc", 3)
      history.undo()
      history.add("xyz", 3)

      expect(history.redo()).toBeNull()
      expect(history.items.map((item) => item.text)).toEqual(["", "xyz"])
    })
  })

  describe("throttledAdd", () => {
    it("coalesces keystrokes inside the debounce window", () => {
      const history = new InputHistory(10, 150, "")

      history.throttledAdd("a", 1)
      history.throttledAdd("ab", 2)
      history.throttledAdd("abc", 3)

      // One entry for the whole burst, holding the latest text.
      expect(history.items.map((item) => item.text)).toEqual(["", "abc"])
    })

    it("starts a new entry once the window lapses", () => {
      const history = new InputHistory(10, 150, "")

      history.throttledAdd("a", 1)
      jest.advanceTimersByTime(200)
      history.throttledAdd("ab", 2)

      expect(history.items.map((item) => item.text)).toEqual(["", "a", "ab"])
    })

    it("is ended by undo, so the next keystroke starts a fresh entry", () => {
      const history = new InputHistory(10, 150, "")

      history.throttledAdd("a", 1)
      history.undo()
      history.throttledAdd("ab", 2)

      expect(history.currentText).toBe("ab")
    })
  })

  it("stops the pending window on demand", () => {
    const history = new InputHistory(10, 150, "")

    history.throttledAdd("a", 1)
    history.stopTimeout()

    expect(history.timeout).toBeNull()
    expect(history.currentText).toBeNull()
  })

  it("has no current item after being cleared", () => {
    const history = new InputHistory(10, 150, "a")

    history.clear()

    expect(history.getCurrentItem()).toBeNull()
  })
})
