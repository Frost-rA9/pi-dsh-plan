/**
 * pi-dsh-plan: dsh-style plan mode for pi.
 *
 * Plan mode is soft guidance, not enforcement. While active, the deployment's
 * guidance text is contributed as the `plan_policy` system-prompt section, and
 * every tool stays available. Confinement is pi-dsh-sandbox's job; the two
 * extensions do not read each other's state, matching dsh's separation.
 *
 * dsh's plan mode is `plan/mode`, a log-only whole-value event folded by a
 * projection, plus a `plan:policy` prompt section, an always-registered
 * `exit_plan_mode` tool, and `/plan [off|message]`. pi has no log-only session
 * event and no projection registry, so this package appends one custom entry
 * per decision and folds the active branch itself.
 *
 * Construction status (all implemented; the interactive review and the
 * model-level turn remain manual checks):
 *   1. skeleton: package, manifest, `/plan`, `plan_policy` section, state seam.
 *   2. state: appendEntry, `session_start` restore, footer status.
 *   3. exit: `exit_plan_mode`, review, approved exit.
 *   4. mid-run correction: a visible switch notice for the rest of a run.
 *   5. flag and details: `--plan`, restoration precedence.
 *   6. docs: bilingual README and the DeepSeek MIT notice.
 *
 * @module pi-dsh-plan
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ExtensionAPI, ExtensionContext } from "@earendil-works/pi-coding-agent";
import { CONFIG_DIR_NAME, getAgentDir } from "@earendil-works/pi-coding-agent";
import { parsePlanArgs } from "./src/command.ts";
import { parseConfig, type PlanConfig } from "./src/config.ts";
import { applyPolicySection } from "./src/guidance.ts";
import { PLAN_NOTICE_TYPE, planNoticeText } from "./src/notice.ts";
import { MODE_ENTRY, PlanState, STATUS_KEY } from "./src/state.ts";
import { EXIT_PLAN_MODE, registerExitPlanMode } from "./src/tool.ts";

/** Global config file name under `<agentDir>/extensions/`. */
const GLOBAL_CONFIG_FILE = "pi-dsh-plan.json";

/** Project config file name under `<cwd>/.pi/`. */
const PROJECT_CONFIG_FILE = "dsh-plan.json";

/** Read one JSON config file. A missing file is fine; a broken one is reported. */
function readConfigFile(path: string, errors: string[]): Record<string, unknown> | undefined {
  if (!existsSync(path)) return undefined;
  try {
    const parsed: unknown = JSON.parse(readFileSync(path, "utf-8"));
    if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
      errors.push(`${path}: expected a JSON object`);
      return undefined;
    }
    return parsed as Record<string, unknown>;
  } catch (error: unknown) {
    errors.push(`${path}: ${error instanceof Error ? error.message : String(error)}`);
    return undefined;
  }
}

/** Merge the global and project config files, project taking precedence. */
function loadRawConfig(cwd: string): { raw: unknown; errors: string[] } {
  const errors: string[] = [];
  const globalConfig = readConfigFile(join(getAgentDir(), "extensions", GLOBAL_CONFIG_FILE), errors);
  const projectConfig = readConfigFile(join(cwd, CONFIG_DIR_NAME, PROJECT_CONFIG_FILE), errors);
  return { raw: { ...globalConfig, ...projectConfig }, errors };
}

/** The multi-line state report used when no dialog channel exists. */
function statusReport(state: PlanState, missingSection: boolean): string {
  return [
    `Plan mode: ${state.active() ? "on" : "off"}`,
    `guidance: ${missingSection ? "not configured" : "configured"}`,
    "Use /plan on, /plan off, or /plan <message>.",
  ].join("\n");
}

/**
 * Render the footer status: `[plan mode::on]` / `[plan mode::off]`.
 *
 * Colors align with pi-dsh-sandbox's tiers: `on` is the no-execution state and
 * uses `read-only`'s `success`; `off` is the normal working state and uses
 * `workspace-write`'s `accent`.
 */
function updateStatus(state: PlanState, ctx: ExtensionContext): void {
  const active = state.active();
  ctx.ui.setStatus(
    STATUS_KEY,
    ctx.ui.theme.fg(active ? "success" : "accent", `[plan mode::${active ? "on" : "off"}]`),
  );
}

export default function dshPlan(pi: ExtensionAPI): void {
  pi.registerFlag("plan", {
    description: "Start in plan mode",
    type: "boolean",
    default: false,
  });

  const state = new PlanState();
  let section = "";
  let configError: string | undefined;
  let missingSection = true;
  let warnedMissingSection = false;

  // A missing section is a valid deployment state (plan mode runs silently), so
  // it is reported only when plan mode is actually in force or entered, once
  // per session. A real config error is reported at session start instead.
  const notifyMissingSection = (ctx: ExtensionContext): void => {
    if (warnedMissingSection) return;
    warnedMissingSection = true;
    ctx.ui.notify(
      "pi-dsh-plan: no guidance section is configured; plan mode contributes no guidance. "
        + "Set `section` in pi-dsh-plan.json to give the model its planning instructions.",
      "info",
    );
  };

  // One visible custom message per real change. A custom message is displayed
  // in the transcript and sent to the model as a user message, which is dsh's
  // notice in pi terms. Mid-run entering also carries the guidance text,
  // because the frozen `plan_policy` section cannot change until the next
  // prompt. `sendMessage` appends when idle and steers while a run is open.
  const announce = (active: boolean, midRun: boolean): void => {
    pi.sendMessage(
      {
        customType: PLAN_NOTICE_TYPE,
        content: planNoticeText(active, section, midRun),
        display: true,
        details: undefined,
      },
      midRun ? { deliverAs: "steer" } : undefined,
    );
  };

  pi.on("session_start", async (_event, ctx) => {
    state.beginSession(ctx);

    const { raw, errors } = loadRawConfig(ctx.cwd);
    for (const error of errors) ctx.ui.notify(`pi-dsh-plan: ${error}`, "error");
    try {
      const config: PlanConfig = parseConfig(raw);
      section = config.section;
      missingSection = section.trim() === "";
      configError = undefined;
    } catch (error: unknown) {
      configError = error instanceof Error ? error.message : String(error);
      section = "";
      missingSection = true;
    }

    state.restore(ctx.sessionManager.getBranch());

    // A `--plan` start enters plan mode; the flag outranks the restored value,
    // but only when set, so a plain resume keeps the logged state.
    if (pi.getFlag("plan") === true) state.set(pi, true);

    warnedMissingSection = false;
    if (configError !== undefined) ctx.ui.notify(`pi-dsh-plan: ${configError}`, "error");
    if (state.active() && missingSection) notifyMissingSection(ctx);
    updateStatus(state, ctx);
  });

  pi.on("before_agent_start", (event) => {
    applyPolicySection(event.systemPromptOptions.sections, section, state.active());
  });

  registerExitPlanMode(pi, {
    state,
    pi,
    // A tool call always runs inside a turn, so the exit notice is mid-run.
    onApproved: () => announce(false, true),
  });

  pi.registerCommand("plan", {
    description: "Plan mode: picker, /plan on, /plan off, or /plan <message>",
    handler: async (args, ctx) => {
      const parsed = parsePlanArgs(args);

      const apply = (active: boolean): void => {
        const outcome = state.set(pi, active);
        updateStatus(state, ctx);
        if (active && missingSection) notifyMissingSection(ctx);
        if (outcome === "committed") announce(active, !ctx.isIdle());
        ctx.ui.notify(
          active
            ? outcome === "noop"
              ? "Plan mode is already active."
              : "Plan mode on. Use /plan off to leave."
            : outcome === "noop"
              ? "Plan mode is already inactive."
              : "Plan mode off.",
          "info",
        );
      };

      if (parsed.kind === "picker") {
        // Bare `/plan` is the picker wherever a dialog channel exists (pi
        // implements `select` for TUI and RPC alike); print and JSON sessions
        // must still learn the state.
        if (!ctx.hasUI) {
          ctx.ui.notify(statusReport(state, missingSection), "info");
          return;
        }
        const active = state.active();
        const options = [
          { label: active ? "on \u00b7 current" : "on", value: true },
          { label: active ? "off" : "off \u00b7 current", value: false },
        ];
        const choice = await ctx.ui.select(
          `Plan mode (current: ${active ? "on" : "off"})`,
          options.map((option) => option.label),
        );
        const picked = options.find((option) => option.label === choice);
        if (picked === undefined) {
          ctx.ui.notify("Plan mode unchanged.", "info");
          return;
        }
        apply(picked.value);
        return;
      }

      if (parsed.kind === "off") {
        apply(false);
        return;
      }

      apply(true);
      if (parsed.message !== "") {
        // dsh steers the message as the next ordinary user message under plan
        // guidance. Steer while a run is open; otherwise the message starts the
        // turn, which is what makes the new section apply.
        pi.sendUserMessage(parsed.message, ctx.isIdle() ? undefined : { deliverAs: "steer" });
      }
    },
  });
}

// Re-exported for tests.
export { EXIT_PLAN_MODE, MODE_ENTRY, STATUS_KEY };
