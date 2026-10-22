/**
 * The registered `exit_plan_mode` tool, driven through its definition so the
 * post-approval notice cannot fire for a dismissed review.
 *
 * @module pi-dsh-plan/tests/tool.test
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { APPROVE_LABEL } from "../src/plan.ts";
import { MODE_ENTRY, PlanState, type PlanEntryAppender } from "../src/state.ts";
import { registerExitPlanMode } from "../src/tool.ts";

const PLAN = "# Refactor plan\n\n1. Step one";

interface Bench {
  state: PlanState;
  entries: { customType: string; data?: unknown }[];
  /** How many times the post-approval notice fired. */
  approved: number;
  execute: (answer: string | undefined) => Promise<{ approved: boolean; terminate?: boolean }>;
}

/** Register the tool against a stub pi, then run it with a stub review answer. */
function bench(): Bench {
  const entries: { customType: string; data?: unknown }[] = [];
  const appender: PlanEntryAppender = {
    appendEntry: (customType, data) => entries.push({ customType, data }),
  };
  const state = new PlanState();
  state.set(appender, true);
  entries.length = 0;

  const benchValue: Bench = {
    state,
    entries,
    approved: 0,
    execute: async () => { throw new Error("tool not registered"); },
  };

  let definition: { execute: (...args: unknown[]) => Promise<{ approved: boolean; terminate?: boolean }> } | undefined;
  registerExitPlanMode(
    { registerTool: (tool: unknown) => { definition = tool as typeof definition; } } as never,
    {
      state,
      pi: appender,
      onApproved: () => { benchValue.approved += 1; },
    },
  );
  assert.ok(definition !== undefined);

  benchValue.execute = (answer) => definition!.execute(
    "call-1",
    { plan: PLAN },
    undefined,
    undefined,
    { hasUI: true, ui: { select: async () => answer } },
  );
  return benchValue;
}

test("an approved exit emits the switch notice", async () => {
  const b = bench();
  const result = await b.execute(APPROVE_LABEL);

  assert.equal(result.approved, true);
  assert.equal(b.approved, 1);
  assert.equal(b.state.active(), false);
  assert.deepEqual(b.entries, [{ customType: MODE_ENTRY, data: { active: false } }]);
});

test("a dismissed review ends the turn without the switch notice", async () => {
  const b = bench();
  const result = await b.execute(undefined);

  assert.equal(result.approved, false);
  assert.equal(result.terminate, true);
  assert.equal(b.approved, 0);
  assert.equal(b.state.active(), true);
  assert.deepEqual(b.entries, []);
});
