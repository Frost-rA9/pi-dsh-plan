/**
 * Plan artifact validation and review classification.
 *
 * @module pi-dsh-plan/tests/plan.test
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { APPROVE_LABEL, KEEP_PLANNING_LABEL, firstHeading, reviewOutcome, validatePlan } from "../src/plan.ts";

test("a plan must start with a heading", () => {
  assert.equal(validatePlan("  # Refactor plan\n\n1. Step one"), "# Refactor plan\n\n1. Step one");
  assert.throws(() => validatePlan(""), /starting with a # heading/);
  assert.throws(() => validatePlan("no heading here"), /starting with a # heading/);
  assert.throws(() => validatePlan("#\n"), /starting with a # heading/);
});

test("firstHeading finds any heading level", () => {
  assert.equal(firstHeading("## Two\n# One"), "Two");
  assert.equal(firstHeading("text\n### Deep heading  "), "Deep heading");
  assert.equal(firstHeading("no heading"), undefined);
});

test("review answers classify as approve, keep, or dismissed", () => {
  assert.equal(reviewOutcome(APPROVE_LABEL), "approve");
  assert.equal(reviewOutcome(KEEP_PLANNING_LABEL), "keep");
  assert.equal(reviewOutcome("something else"), "keep");
  assert.equal(reviewOutcome(undefined), "dismissed");
});
