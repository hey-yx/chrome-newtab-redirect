import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const REDIRECT = require.resolve("../redirect.js");

function loadRedirect(chrome) {
  delete require.cache[REDIRECT];
  globalThis.chrome = chrome;
  globalThis.location = { replace(url) { this.replaced = url; } };
  require(REDIRECT);
  return { replaced: globalThis.location.replaced };
}

function storageChrome(items, tabs) {
  const writes = [];
  globalThis.location = null;
  const chrome = {
    runtime: { getURL: (path) => `chrome-extension://test/${path}` },
    storage: {
      local: { get: (defaults, callback) => callback({ ...defaults, ...items }) }
    }
  };
  if (tabs !== "missing") {
    chrome.tabs = {
      getCurrent: tabs?.getCurrent ?? ((callback) => callback({ id: 42 })),
      update: (id, properties, callback) => {
        writes.push({ id, ...properties });
        callback?.({ id });
      }
    };
  }
  return { chrome, writes };
}

test("enabled address-bar focus updates this new tab without activating it", () => {
  const { chrome, writes } = storageChrome({ targetUrl: "example.com", focusAddressBar: true });
  const { replaced } = loadRedirect(chrome);
  assert.deepEqual(writes, [{ id: 42, url: "https://example.com/" }]);
  assert.equal(replaced, undefined);
});

test("keeps the in-page redirect when the option is off", () => {
  const { chrome, writes } = storageChrome({ targetUrl: "example.com", focusAddressBar: false });
  const { replaced } = loadRedirect(chrome);
  assert.equal(replaced, "https://example.com/");
  assert.deepEqual(writes, []);
});

test("treats a missing option as off", () => {
  const { chrome, writes } = storageChrome({ targetUrl: "example.com" });
  const { replaced } = loadRedirect(chrome);
  assert.equal(replaced, "https://example.com/");
  assert.deepEqual(writes, []);
});

test("falls back to the in-page redirect when the tabs API is missing", () => {
  const { chrome, writes } = storageChrome(
    { targetUrl: "example.com", focusAddressBar: true },
    "missing"
  );
  const { replaced } = loadRedirect(chrome);
  assert.equal(replaced, "https://example.com/");
  assert.deepEqual(writes, []);
});

test("falls back to the in-page redirect when the tab id is unknown", () => {
  const { chrome, writes } = storageChrome(
    { targetUrl: "example.com", focusAddressBar: true },
    { getCurrent: (callback) => callback(undefined) }
  );
  const { replaced } = loadRedirect(chrome);
  assert.equal(replaced, "https://example.com/");
  assert.deepEqual(writes, []);
});

test("opens settings when no address is saved, even with the option on", () => {
  const { chrome, writes } = storageChrome({ focusAddressBar: true });
  const { replaced } = loadRedirect(chrome);
  assert.equal(replaced, "chrome-extension://test/options.html");
  assert.deepEqual(writes, []);
});

test("rejects a script address and opens settings", () => {
  const { chrome, writes } = storageChrome({ targetUrl: "javascript:alert(1)" });
  const { replaced } = loadRedirect(chrome);
  assert.equal(replaced, "chrome-extension://test/options.html");
  assert.deepEqual(writes, []);
});

test("accepts host:port without a protocol", () => {
  const { chrome } = storageChrome({ targetUrl: "localhost:3000" });
  const { replaced } = loadRedirect(chrome);
  assert.equal(replaced, "https://localhost:3000/");
});

test("opens settings when the saved address cannot be parsed", () => {
  const { chrome } = storageChrome({ targetUrl: "http://" });
  const { replaced } = loadRedirect(chrome);
  assert.equal(replaced, "chrome-extension://test/options.html");
});

test("opens settings when storage itself is unavailable", () => {
  globalThis.chrome = { runtime: { getURL: (path) => `chrome-extension://test/${path}` } };
  globalThis.location = { replace(url) { this.replaced = url; } };
  delete require.cache[REDIRECT];
  require(REDIRECT);
  assert.equal(globalThis.location.replaced, "chrome-extension://test/options.html");
});
