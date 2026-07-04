import "@testing-library/jest-dom"

// jsdom (29.x) ships pointer events but not the capture API surface that
// some pointer-aware libraries (sonner, radix-ui drag handlers) call
// during `pointerdown`. Polyfill no-op stubs so handlers don't throw.
if (typeof Element !== "undefined") {
  if (typeof Element.prototype.setPointerCapture === "undefined") {
    Element.prototype.setPointerCapture = () => {}
  }
  if (typeof Element.prototype.releasePointerCapture === "undefined") {
    Element.prototype.releasePointerCapture = () => {}
  }
  if (typeof Element.prototype.hasPointerCapture === "undefined") {
    Element.prototype.hasPointerCapture = () => false
  }
  // jsdom doesn't implement `scrollIntoView`; radix-ui's Select calls it on
  // option mount + arrow-key nav. No-op stub keeps tests happy.
  if (typeof Element.prototype.scrollIntoView === "undefined") {
    Element.prototype.scrollIntoView = () => {}
  }
}
