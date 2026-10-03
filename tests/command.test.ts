/**
 * `/plan` argument parsing.
 *
 * @module pi-dsh-plan/tests/command.test
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { parsePlanArgs } from "../src/command.ts";

test("bare /plan opens the picker", () => {
  assert.deepEqual(parsePlanArgs(""), { kind: "picker" });
  assert.deepEqual(parsePlanArgs("   "), { kind: "picker" });
});

test("the exact argument on enters with no message", () => {
  assert.deepEqual(parsePlanArgs("on"), { kind: "on", message: "" });
  assert.deepEqual(parsePlanArgs("  on  "), { kind: "on", message: "" });
});

test("the exact argument off leaves", () => {
  assert.deepEqual(parsePlanArgs("off"), { kind: "off" });
  assert.deepEqual(parsePlanArgs("  off  "), { kind: "off" });
});

test("any other argument enters and carries a trimmed message", () => {
  assert.deepEqual(parsePlanArgs("sketch the refactor first"), {
    kind: "on",
    message: "sketch the refactor first",
  });
  assert.deepEqual(parsePlanArgs("  offline  "), { kind: "on", message: "offline" });
});
