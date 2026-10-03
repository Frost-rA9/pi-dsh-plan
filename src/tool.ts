/**
 * `exit_plan_mode`: the registered form of the reviewed exit.
 *
 * The tool stays registered while plan mode is inactive, exactly as in dsh, so
 * entering or leaving changes only the prompt section and never the request
 * tool catalog. Calling it outside plan mode fails at execution. The decision
 * itself lives in `src/exit.ts`; this module only adapts the pi tool surface.
 *
 * The submitted plan is visible to the user through the tool call itself, in
 * both the TUI transcript and the RPC `tool_execution_start` payload, so the
 * `select` only asks for the decision. After approval, `onApproved` emits the
 * visible switch notice. The description is adapted from dsh
 * `@deepseek-ai/dsh-plan-mode`; see THIRD-PARTY-NOTICES.md.
 *
 * @module pi-dsh-plan/tool
 */

import { Type } from "typebox";
import { defineTool, type ExtensionAPI } from "@earendil-works/pi-coding-agent";
import { EXIT_PLAN_MODE, runExitPlanMode, type ExitPlanModeDeps } from "./exit.ts";

export { EXIT_PLAN_MODE };

const EXIT_DESCRIPTION =
  "Use only in plan mode. Present your plan for the user's review and, on approval, leave plan mode. " +
  "The user may approve (carry out the plan from your next step) or keep planning; " +
  "revise and present the plan again when they choose to keep planning.";

/** Registration dependencies, plus the post-approval notice hook. */
export interface RegisterExitPlanModeDeps extends Omit<ExitPlanModeDeps, "ui"> {
  /** Called after an approved exit clears the state, to emit the visible notice. */
  onApproved: () => void;
}

/** Register the always-present exit tool. */
export function registerExitPlanMode(pi: ExtensionAPI, deps: RegisterExitPlanModeDeps): void {
  const { onApproved, ...exitDeps } = deps;
  pi.registerTool(
    defineTool({
      name: EXIT_PLAN_MODE,
      label: "Exit plan mode",
      description: EXIT_DESCRIPTION,
      parameters: Type.Object({
        plan: Type.String({
          description: "The complete plan, as markdown, starting with a # heading that names it.",
        }),
      }),

      async execute(_toolCallId, params, _signal, _onUpdate, ctx) {
        const result = await runExitPlanMode(
          { ...exitDeps, ui: { hasUI: ctx.hasUI, select: (title, options) => ctx.ui.select(title, options) } },
          params.plan,
        );
        onApproved();
        return result;
      },
    }),
  );
}
