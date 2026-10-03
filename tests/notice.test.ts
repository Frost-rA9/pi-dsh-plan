/**
 * Mode-change notice text.
 *
 * @module pi-dsh-plan/tests/notice.test
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { planNoticeText, switchNotice } from "../src/notice.ts";

test("the switch sentence matches dsh's wording", () => {
  assert.equal(switchNotice(true), "The user switched this session to plan mode.");
  assert.equal(switchNotice(false), "The user switched this session back to the default mode.");
});

test("entering mid-run carries the guidance text", () => {
  assert.match(planNoticeText(true, "Explore before executing.", true), /Explore before executing\./);
});

test("entering at a prompt boundary stays the short switch sentence", () => {
  assert.equal(planNoticeText(true, "Explore before executing.", false), switchNotice(true));
});

test("entering without guidance stays the short switch sentence", () => {
  assert.equal(planNoticeText(true, "   ", true), switchNotice(true));
});

test("leaving is always the short switch sentence", () => {
  assert.equal(planNoticeText(false, "Explore.", true), switchNotice(false));
  assert.equal(planNoticeText(false, "Explore.", false), switchNotice(false));
});
