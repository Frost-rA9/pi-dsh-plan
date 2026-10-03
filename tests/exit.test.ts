/**
 * Reviewed-exit decisions, driven through a stub review channel.
 *
 * @module pi-dsh-plan/tests/exit.test
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { APPROVE_LABEL, KEEP_PLANNING_LABEL } from "../src/plan.ts";
import { runExitPlanMode, type ReviewUI } from "../src/exit.ts";
import { MODE_ENTRY, PlanState, type PlanEntryAppender } from "../src/state.ts";

const PLAN = "# Refactor plan\n\n1. Step one";

interface Bench {
  state: PlanState;
  entries: { customType: string; data?: unknown }[];
  ui: ReviewUI;
  appender: PlanEntryAppender;
}

/** A bench with plan mode already active and a configurable review answer. */
function bench(answer: string | undefined, hasUI = true): Bench {
  const entries: { customType: string; data?: unknown }[] = [];
  const appender: PlanEntryAppender = {
    appendEntry: (customType, data) => entries.push({ customType, data }),
  };
  const state = new PlanState();
  state.set(appender, true);
  entries.length = 0;
  return {
    state,
    entries,
    appender,
    ui: { hasUI, select: async () => answer },
  };
}

test("the exit fails outside plan mode", async () => {
  const state = new PlanState();
  await assert.rejects(
    runExitPlanMode(
      { state, pi: { appendEntry: () => {} }, ui: { hasUI: true, select: async () => APPROVE_LABEL } },
      PLAN,
    ),
    /only available in plan mode/,
  );
});

test("a plan without a leading heading is refused before the review", async () => {
  const b = bench(APPROVE_LABEL);
  await assert.rejects(
    runExitPlanMode({ state: b.state, pi: b.appender, ui: b.ui }, "no heading"),
    /starting with a # heading/,
  );
  assert.equal(b.state.active(), true);
  assert.deepEqual(b.entries, []);
});

test("a missing dialog channel fails closed", async () => {
  const b = bench(APPROVE_LABEL, false);
  await assert.rejects(
    runExitPlanMode({ state: b.state, pi: b.appender, ui: b.ui }, PLAN),
    /no interactive review is available/,
  );
  assert.equal(b.state.active(), true);
});

test("a dismissed review stays in plan mode", async () => {
  const b = bench(undefined);
  await assert.rejects(
    runExitPlanMode({ state: b.state, pi: b.appender, ui: b.ui }, PLAN),
    /dismissed the plan review/,
  );
  assert.equal(b.state.active(), true);
  assert.deepEqual(b.entries, []);
});

test("keep planning stays in plan mode", async () => {
  const b = bench(KEEP_PLANNING_LABEL);
  await assert.rejects(
    runExitPlanMode({ state: b.state, pi: b.appender, ui: b.ui }, PLAN),
    /keep planning/,
  );
  assert.equal(b.state.active(), true);
  assert.deepEqual(b.entries, []);
});

test("approval clears the state exactly once", async () => {
  const b = bench(APPROVE_LABEL);
  const result = await runExitPlanMode({ state: b.state, pi: b.appender, ui: b.ui }, PLAN);
  assert.match(result.content[0]!.text, /Plan approved/);
  assert.equal(result.details, undefined);
  assert.equal(b.state.active(), false);
  assert.deepEqual(b.entries, [{ customType: MODE_ENTRY, data: { active: false } }]);
});
