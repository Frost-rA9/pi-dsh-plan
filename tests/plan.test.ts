/**
 * Plan artifact validation and review classification.
 *
 * @module pi-dsh-plan/tests/plan.test
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { APPROVE_LABEL, KEEP_PLANNING_LABEL, PLAN_PREVIEW_LINES, firstHeading, planExcerpt, reviewOutcome, validatePlan } from "../src/plan.ts";

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

test("planExcerpt shows the body after the heading and counts the rest", () => {
  const plan = "# Plan\n\n1. one\n2. two\n3. three";
  assert.deepEqual(planExcerpt(plan, 2), { lines: ["1. one", "2. two"], remaining: 1 });
  assert.deepEqual(planExcerpt(plan), { lines: ["1. one", "2. two", "3. three"], remaining: 0 });
  assert.deepEqual(planExcerpt("  \n "), { lines: [], remaining: 0 });
  assert.deepEqual(planExcerpt("no heading\nline two", 1), { lines: ["no heading"], remaining: 1 });
  assert.deepEqual(planExcerpt(plan, 0), { lines: [], remaining: 3 });
  const long = `# Long\n\n${Array.from({ length: 20 }, (_, index) => `- step ${index + 1}`).join("\n")}`;
  assert.equal(planExcerpt(long).lines.length, PLAN_PREVIEW_LINES);
});
