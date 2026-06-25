// Polyfill Element.scrollIntoView for jsdom
if (typeof window !== "undefined") {
  Element.prototype.scrollIntoView = jest.fn();
}

// Polyfill crypto.randomUUID for jsdom
if (typeof crypto !== "undefined" && !crypto.randomUUID) {
  let counter = 0;
  Object.defineProperty(crypto, "randomUUID", {
    value: () => `test-uuid-${++counter}`,
  });
}
