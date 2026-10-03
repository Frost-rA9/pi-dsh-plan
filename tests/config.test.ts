/**
 * Config validation: `{ section }` only, unknown keys and wrong types refused.
 *
 * @module pi-dsh-plan/tests/config.test
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { DEFAULT_CONFIG, parseConfig } from "../src/config.ts";

test("no config file yields the unconfigured default", () => {
  assert.deepEqual(parseConfig(undefined), DEFAULT_CONFIG);
  assert.deepEqual(parseConfig(null), DEFAULT_CONFIG);
});

test("a string section is accepted and detached from the input", () => {
  const raw = { section: "Explore before executing." };
  const config = parseConfig(raw);
  assert.deepEqual(config, { section: "Explore before executing." });
  assert.notEqual(config, raw);
});

test("an omitted section is unconfigured, not an error", () => {
  assert.deepEqual(parseConfig({}), DEFAULT_CONFIG);
});

test("a non-object config is refused", () => {
  assert.throws(() => parseConfig("nope"), /expected a JSON object/);
  assert.throws(() => parseConfig([{ section: "x" }]), /expected a JSON object/);
});

test("an unknown key is refused", () => {
  assert.throws(() => parseConfig({ section: "x", mode: "y" }), /unknown key\(s\) mode/);
});

test("a non-string section is refused", () => {
  assert.throws(() => parseConfig({ section: 3 }), /`section` must be a string/);
});
