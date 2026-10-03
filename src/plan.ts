/**
 * Plan artifact validation and review outcome, kept free of pi imports so the
 * rules are unit-testable without a host installation.
 *
 * The rules are dsh's: the plan is a markdown document whose first heading
 * names it, the review offers exactly `Approve` and `Keep planning`, and a
 * dismissed review is neither approval nor a failed review. pi's `select` has
 * no free-text field, so `Keep planning` returns no feedback text; the model is
 * told to revise and present again.
 *
 * @module pi-dsh-plan/plan
 */

/** The review's approve option label. */
export const APPROVE_LABEL = "Approve";

/** The review's keep-planning option label. */
export const KEEP_PLANNING_LABEL = "Keep planning";

/** What the user's review answer means. */
export type ReviewOutcome = "approve" | "keep" | "dismissed";

/** The plan's first markdown heading (any level), or `undefined` when it has none. */
export function firstHeading(plan: string): string | undefined {
  for (const line of plan.split("\n")) {
    const match = /^#{1,6}\s+(.+?)\s*$/.exec(line);
    if (match) return match[1];
  }
  return undefined;
}

/**
 * Require a complete plan: non-empty markdown that starts with a heading.
 *
 * @param plan The raw tool argument.
 * @returns The trimmed plan.
 * @throws When the plan has no leading `#` heading.
 */
export function validatePlan(plan: string): string {
  const trimmed = plan.trim();
  if (!/^#\s+\S/.test(trimmed)) {
    throw new Error("exit_plan_mode requires a non-empty markdown plan starting with a # heading");
  }
  return trimmed;
}

/**
 * Classify one `ctx.ui.select` answer.
 *
 * @param choice The selected label, or `undefined` when the dialog was
 * dismissed and the user took the turn back to speak instead.
 */
export function reviewOutcome(choice: string | undefined): ReviewOutcome {
  if (choice === undefined) return "dismissed";
  return choice === APPROVE_LABEL ? "approve" : "keep";
}
