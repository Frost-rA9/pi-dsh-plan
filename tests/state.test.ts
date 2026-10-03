/**
 * Plan state: fold the active branch, last entry wins, one entry per decision.
 *
 * @module pi-dsh-plan/tests/state.test
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { MODE_ENTRY, PlanState, type PlanEntryAppender } from "../src/state.ts";

/** A throwaway entry appender that records what was written. */
function recordingPi(): { pi: PlanEntryAppender; entries: { customType: string; data?: unknown }[] } {
  const entries: { customType: string; data?: unknown }[] = [];
  return {
    entries,
    pi: {
      appendEntry: (customType: string, data?: unknown) => {
        entries.push({ customType, data });
      },
    },
  };
}

test("a fresh session is inactive", () => {
  assert.equal(new PlanState().active(), false);
});

test("entering commits one entry and flipping back commits another", () => {
  const state = new PlanState();
  const { pi, entries } = recordingPi();
  assert.equal(state.set(pi, true), "committed");
  assert.equal(state.active(), true);
  assert.equal(state.set(pi, false), "committed");
  assert.equal(state.active(), false);
  assert.deepEqual(entries, [
    { customType: MODE_ENTRY, data: { active: true } },
    { customType: MODE_ENTRY, data: { active: false } },
  ]);
});

test("selecting the current state is a no-op and writes nothing", () => {
  const state = new PlanState();
  const { pi, entries } = recordingPi();
  assert.equal(state.set(pi, false), "noop");
  state.set(pi, true);
  assert.equal(state.set(pi, true), "noop");
  assert.deepEqual(entries, [{ customType: MODE_ENTRY, data: { active: true } }]);
});

test("restore folds the last plan entry and ignores other entries", () => {
  const state = new PlanState();
  state.restore([
    { type: "message" },
    { type: "custom", customType: "something-else", data: { active: false } },
    { type: "custom", customType: MODE_ENTRY, data: { active: true } },
    { type: "custom", customType: MODE_ENTRY, data: { active: false } },
  ]);
  assert.equal(state.active(), false);
});

test("restore ignores malformed entry data and stays inactive", () => {
  const state = new PlanState();
  state.restore([
    { type: "custom", customType: MODE_ENTRY, data: { active: "yes" } },
    { type: "custom", customType: MODE_ENTRY },
  ]);
  assert.equal(state.active(), false);
});

test("beginSession clears state before restore", () => {
  const state = new PlanState();
  const { pi } = recordingPi();
  state.set(pi, true);
  state.beginSession(undefined);
  assert.equal(state.active(), false);
});
