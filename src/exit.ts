/**
 * The reviewed-exit decision, kept free of pi imports so it is unit-testable
 * with a stub review channel.
 *
 * The rules are dsh's: the tool is callable only in plan mode, the plan must be
 * non-empty markdown starting with a heading, approval is exactly one `Approve`
 * answer, a dismissed review is neither approval nor a failed review, and any
 * other answer keeps planning. A missing dialog channel fails the call closed;
 * `/plan off` remains the manual escape.
 *
 * On approval the state is cleared immediately. dsh instead records a silent
 * pending exit appended at the next in-turn pre-step, and suppresses narration
 * because the tool result reports the change. pi's section is frozen for the
 * whole run, so the next request in the same run would still carry the plan
 * guidance; that is why the caller also gets a `context` withdrawal notice.
 *
 * @module pi-dsh-plan/exit
 */

import { APPROVE_LABEL, KEEP_PLANNING_LABEL, firstHeading, reviewOutcome, validatePlan } from "./plan.ts";
import type { PlanEntryAppender, PlanState } from "./state.ts";

/** The model-facing exit tool's name, kept identical to dsh. */
export const EXIT_PLAN_MODE = "exit_plan_mode";

/** The dialog surface the review needs. */
export interface ReviewUI {
  /** Whether a dialog-capable channel exists (true in TUI and RPC). */
  hasUI: boolean;
  /** Present a list and return the chosen label, or `undefined` when dismissed. */
  select(title: string, options: string[]): Promise<string | undefined>;
}

/** Everything the exit decision needs. */
export interface ExitPlanModeDeps {
  /** Session plan state. */
  state: PlanState;
  /** The `pi` entry appender, for the approved exit. */
  pi: PlanEntryAppender;
  /** The review channel. */
  ui: ReviewUI;
}

/** The tool result for an approved plan. */
export interface ExitPlanModeResult {
  content: { type: "text"; text: string }[];
  details: undefined;
}

/**
 * Run the reviewed exit.
 *
 * @param deps State, appender, and review channel.
 * @param rawPlan The raw `plan` tool argument.
 * @returns The approval result.
 * @throws Outside plan mode, for an invalid plan, without a review channel,
 * when dismissed, and when the user keeps planning.
 */
export async function runExitPlanMode(
  deps: ExitPlanModeDeps,
  rawPlan: string,
): Promise<ExitPlanModeResult> {
  if (!deps.state.active()) {
    throw new Error(`${EXIT_PLAN_MODE} is only available in plan mode`);
  }
  const plan = validatePlan(rawPlan);

  if (!deps.ui.hasUI) {
    throw new Error(
      "no interactive review is available to approve the plan; leave plan mode with /plan off instead",
    );
  }

  const choice = await deps.ui.select(
    `Plan review: approve this plan and leave plan mode? (${firstHeading(plan) ?? "Plan"})`,
    [APPROVE_LABEL, KEEP_PLANNING_LABEL],
  );

  switch (reviewOutcome(choice)) {
    case "dismissed":
      throw new Error(
        "The user dismissed the plan review to speak instead; stay in plan mode, stop here, "
          + "and wait for their message.",
      );
    case "keep":
      throw new Error("The user chose to keep planning; revise the plan and present it again.");
    case "approve":
      break;
  }

  deps.state.set(deps.pi, false);
  return {
    content: [
      {
        type: "text",
        text: "Plan approved: plan mode exited; carry out the plan starting with your next step.",
      },
    ],
    details: undefined,
  };
}
