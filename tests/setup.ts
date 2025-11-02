// Vitest setup: jsdom environment is configured via vite.config.js
// Optionally silence console warnings from web components or icon libs during tests.
import { beforeAll } from "vitest";

// No-op to keep the setup file present. Add global mocks here if needed later.
beforeAll(() => {
  // Example: mock ResizeObserver if components use it
  if (typeof window !== "undefined" && !("ResizeObserver" in window)) {
    // @ts-ignore
    window.ResizeObserver = class {
      observe() {}
      unobserve() {}
      disconnect() {}
    };
  }
});
