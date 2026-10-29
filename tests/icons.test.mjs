import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";

const manifest = JSON.parse(readFileSync(new URL("../manifest.json", import.meta.url), "utf8"));
const sizes = [16, 32, 48, 128];

test("extension icons include all four native PNG sizes", () => {
  assert.deepEqual(Object.keys(manifest.icons), sizes.map(String));
  for (const size of sizes) {
    const png = readFileSync(new URL(`../${manifest.icons[size]}`, import.meta.url));
    assert.equal(png.subarray(0, 8).toString("hex"), "89504e470d0a1a0a");
    assert.equal(png.subarray(12, 16).toString("ascii"), "IHDR");
    assert.equal(png.readUInt32BE(16), size);
    assert.equal(png.readUInt32BE(20), size);
    assert.equal(png[25], 6, "icons retain RGBA transparency");
  }
});

test("toolbar icons reuse the extension artwork", () => {
  assert.deepEqual(manifest.action.default_icon, manifest.icons);
});

test("settings favicon uses the shipped 32px PNG", () => {
  const html = readFileSync(new URL("../options.html", import.meta.url), "utf8");
  assert.ok(html.includes(`<link rel="icon" type="image/png" sizes="32x32" href="${manifest.icons[32]}">`));
});
