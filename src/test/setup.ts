import "@testing-library/jest-dom";

if (typeof window === "undefined") {
  // Node-environment tests (e.g. e2e) don't need browser polyfills.
} else {
Object.defineProperty(window, "matchMedia", {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => {},
  }),
});
}
