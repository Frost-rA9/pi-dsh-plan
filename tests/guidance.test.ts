/**
 * The `plan_policy` section: present only while active and configured.
 *
 * @module pi-dsh-plan/tests/guidance.test
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { applyPolicySection, PLAN_POLICY_SECTION } from "../src/guidance.ts";

test("active and configured contributes the section", () => {
  const sections: Record<string, string> = {};
  applyPolicySection(sections, "Explore before executing.", true);
  assert.deepEqual(sections, { [PLAN_POLICY_SECTION]: "Explore before executing." });
});

test("inactive removes the section", () => {
  const sections: Record<string, string> = { [PLAN_POLICY_SECTION]: "stale" };
  applyPolicySection(sections, "Explore before executing.", false);
  assert.deepEqual(sections, {});
});

test("active but unconfigured contributes nothing", () => {
  const sections: Record<string, string> = {};
  applyPolicySection(sections, "   ", true);
  assert.deepEqual(sections, {});
});

test("an unrelated section is left alone", () => {
  const sections: Record<string, string> = { preamble: "keep me" };
  applyPolicySection(sections, "Explore.", true);
  applyPolicySection(sections, "Explore.", false);
  assert.deepEqual(sections, { preamble: "keep me" });
});
