import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { test } from "node:test";

const require = createRequire(import.meta.url);
const OPTIONS = require.resolve("../options.js");
const html = readFileSync(new URL("../options.html", import.meta.url), "utf8");

function element(dataset = {}) {
  const listeners = {};
  return {
    dataset,
    value: "",
    checked: false,
    textContent: "",
    className: "",
    attributes: {},
    classList: {
      toggled: {},
      toggle(name, enabled) { this.toggled[name] = enabled; }
    },
    setAttribute(name, value) { this.attributes[name] = value; },
    addEventListener(name, callback) { (listeners[name] ??= []).push(callback); },
    focus() { this.focused = true; },
    fire(name) {
      for (const callback of listeners[name] ?? []) {
        if (name === "submit") {
          callback({ preventDefault() {} });
        } else {
          callback({});
        }
      }
    }
  };
}

function loadOptions(items = {}, { storage = true, dark = false } = {}) {
  const nodes = new Map();
  for (const match of html.matchAll(/id="([^"]+)"/g)) nodes.set(match[1], element());

  const translated = [...html.matchAll(/data-i18n="([^"]+)"/g)].map((match) => element({ i18n: match[1] }));
  const aria = [...html.matchAll(/data-i18n-aria-label="([^"]+)"/g)].map((match) =>
    element({ i18nAriaLabel: match[1] })
  );
  const buttons = [...html.matchAll(/class="lang-button"[^>]*data-lang="([^"]+)"/g)].map((match) =>
    element({ lang: match[1] })
  );

  const writes = [];
  const media = { matches: dark, addEventListener(name, callback) { this[name] = callback; } };
  globalThis.document = {
    documentElement: {},
    title: "",
    getElementById: (id) => nodes.get(id) ?? null,
    querySelector: () => aria[0] ?? null,
    querySelectorAll: (selector) =>
      selector === ".lang-button"
        ? buttons
        : selector === "[data-i18n]"
          ? translated
          : selector === "[data-i18n-aria-label]"
            ? aria
            : []
  };
  globalThis.window = { matchMedia: () => media };
  delete globalThis.chrome;
  if (storage) {
    globalThis.chrome = {
      storage: {
        local: {
          get: (defaults, callback) => callback({ ...defaults, ...items }),
          set: (values) => writes.push(JSON.parse(JSON.stringify(values)))
        }
      }
    };
  }

  delete require.cache[OPTIONS];
  require(OPTIONS);
  return { nodes, writes, buttons, translated, aria, media };
}

test("address-bar option loads enabled, saves disabled, and survives clear", () => {
  const { nodes, writes } = loadOptions({ targetUrl: "example.com", focusAddressBar: true });
  const checkbox = nodes.get("focus-address-bar");
  assert.ok(checkbox, "settings must offer an address-bar focus checkbox");
  assert.equal(checkbox.checked, true);
  checkbox.checked = false;
  checkbox.fire("change");
  nodes.get("settings-form").fire("submit");
  assert.deepEqual(writes.at(-1), { targetUrl: "https://example.com/", focusAddressBar: false });
  checkbox.checked = true;
  nodes.get("clear-button").fire("click");
  assert.deepEqual(writes.at(-1), { targetUrl: "", focusAddressBar: true });
});

test("address-bar option starts unchecked on a fresh install", () => {
  const { nodes, writes } = loadOptions({});
  assert.equal(nodes.get("focus-address-bar").checked, false);
  assert.deepEqual(writes, []);
  assert.equal(nodes.get("current-value").textContent, "Not configured");
});

test("toggling the option clears the last save message until saved", () => {
  const { nodes } = loadOptions({ targetUrl: "example.com", focusAddressBar: false });
  nodes.get("settings-form").fire("submit");
  assert.match(nodes.get("status").textContent, /Saved/);
  nodes.get("focus-address-bar").fire("change");
  assert.equal(nodes.get("status").textContent, "");
});

test("an invalid address keeps the option untouched and reports the error", () => {
  const { nodes, writes } = loadOptions({ focusAddressBar: true });
  const input = nodes.get("target-url");
  input.value = "javascript:alert(1)";
  nodes.get("settings-form").fire("submit");
  assert.deepEqual(writes, []);
  assert.equal(nodes.get("url-help").dataset.state, "error");
  assert.equal(input.attributes["aria-invalid"], "true");
  assert.equal(input.focused, true);
  input.value = "example.com";
  input.fire("input");
  assert.equal(nodes.get("url-help").dataset.state, "hint");
});

test("submitting an empty field clears the address but keeps the option", () => {
  const { nodes, writes } = loadOptions({ targetUrl: "example.com", focusAddressBar: true });
  nodes.get("target-url").value = "   ";
  nodes.get("settings-form").fire("submit");
  assert.deepEqual(writes.at(-1), { targetUrl: "", focusAddressBar: true });
  assert.equal(nodes.get("focus-address-bar").checked, true);
});

test("switching language re-renders text and persists the choice", () => {
  const { nodes, writes, buttons, translated } = loadOptions({ uiLanguage: "en" });
  const title = translated.find((node) => node.dataset.i18n === "title");
  const lede = translated.find((node) => node.dataset.i18n === "lede");
  const focusLabel = translated.find((node) => node.dataset.i18n === "focusLabel");
  assert.equal(title.textContent, "New tab settings");
  buttons[1].fire("click");
  assert.deepEqual(writes.at(-1), { uiLanguage: "zh" });
  assert.equal(document.documentElement.lang, "zh-CN");
  assert.equal(title.textContent, "新标签页设置");
  assert.equal(focusLabel.textContent, "打开新标签页后保留地址栏焦点");
  assert.match(lede.textContent, /设置每次打开新标签页/);
  assert.equal(buttons[1].attributes["aria-pressed"], "true");
  assert.equal(buttons[0].attributes["aria-pressed"], "false");
  buttons[0].fire("click");
  assert.deepEqual(writes.at(-1), { uiLanguage: "en" });
  assert.equal(nodes.get("scheme-status").textContent, "System theme: light · first frame white");
});

test("an unparseable address reports the error and saves nothing", () => {
  const { nodes, writes } = loadOptions({ targetUrl: "example.com" });
  nodes.get("target-url").value = "http://";
  nodes.get("settings-form").fire("submit");
  assert.deepEqual(writes, []);
  assert.equal(nodes.get("url-help").dataset.state, "error");
});

test("typing after a save clears the status line", () => {
  const { nodes } = loadOptions({ targetUrl: "example.com" });
  nodes.get("settings-form").fire("submit");
  assert.match(nodes.get("status").textContent, /Saved/);
  nodes.get("target-url").fire("input");
  assert.equal(nodes.get("status").textContent, "");
});

test("theme changes update the scheme line", () => {
  const { nodes, media } = loadOptions({});
  assert.match(nodes.get("scheme-status").textContent, /light/);
  media.change({ matches: true });
  assert.match(nodes.get("scheme-status").textContent, /dark/);
});

test("the page still renders without the storage API", () => {
  const { nodes } = loadOptions({}, { storage: false });
  assert.equal(nodes.get("current-value").textContent, "Not configured");
  nodes.get("target-url").value = "example.com";
  nodes.get("settings-form").fire("submit");
  assert.equal(nodes.get("status").textContent.startsWith("Saved"), true);
});
