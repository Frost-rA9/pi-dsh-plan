/**
 * The `exit_plan_mode` tool-row preview.
 *
 * dsh presents a submitted plan as a review decision: a card whose title is the
 * plan's first heading, with the document openable in a viewer. pi has no
 * sidebar or document pane, but a registered tool's row is a markdown-capable
 * surface that both the TUI transcript and the HTML export draw, so that is
 * where the preview lives. Collapsed, it shows the body's first
 * `PLAN_PREVIEW_LINES` raw lines plus an expand hint; expanded, it renders the
 * whole plan as markdown. The row's result region is already wrapped in a click
 * region by pi, so `app.tools.expand` (ctrl+O by default) and a left click in
 * fullscreen both toggle it, and the selector that runs the review forwards
 * `app.tools.expand`, so the plan can be expanded while the review is open.
 *
 * The renderer is display-only: the plan stays in the tool-call arguments and
 * never enters model context a second time. It is TUI-only, though; RPC, print,
 * and JSON clients still read the plan from the `tool_execution_start` payload.
 *
 * @module pi-dsh-plan/preview
 */

import { getMarkdownTheme, keyHint, keyText } from "@earendil-works/pi-coding-agent";
import type { Theme } from "@earendil-works/pi-coding-agent";
import { Container, Markdown, Text } from "@earendil-works/pi-tui";
import { EXIT_PLAN_MODE } from "./exit.ts";
import { firstHeading, planExcerpt } from "./plan.ts";

/** The tool-row title: the tool name plus the plan's first heading. */
function titleLine(plan: string, theme: Theme): string {
  const heading = firstHeading(plan);
  return (
    theme.fg("toolTitle", theme.bold(`${EXIT_PLAN_MODE} `)) + theme.fg("accent", heading ?? "Plan")
  );
}

/** The collapsed body: the excerpt lines and, when lines remain, the expand hint. */
function collapsedBody(lines: readonly string[], remaining: number, theme: Theme): string {
  let text = lines.map((line) => theme.fg("dim", line)).join("\n");
  if (remaining > 0) {
    // `keyHint` names the configured keybinding and colors it. No keybindings are
    // registered outside the interactive process (the HTML export parses the same
    // renderer), where it would render an empty key, so the hint falls back to the
    // bare action then.
    const hint = keyText("app.tools.expand") === ""
      ? theme.fg("muted", "to expand")
      : keyHint("app.tools.expand", "to expand");
    text += `\n${theme.fg("muted", `... (${remaining} more lines, `)}${hint}${theme.fg("muted", ")")}`;
  }
  return text;
}

/**
 * Build the preview component for one `exit_plan_mode` row.
 *
 * @param plan The `plan` tool argument; unknown while arguments stream.
 * @param theme The active theme.
 * @param expanded Whether the tool output is expanded.
 */
export function renderPlanPreview(plan: unknown, theme: Theme, expanded: boolean): Container {
  const text = typeof plan === "string" ? plan.trim() : "";
  const container = new Container();
  container.addChild(new Text(titleLine(text, theme), 0, 0));
  if (text === "") return container;

  if (expanded) {
    container.addChild(new Markdown(text, 0, 1, getMarkdownTheme()));
    return container;
  }

  const { lines, remaining } = planExcerpt(text);
  container.addChild(new Text(collapsedBody(lines, remaining, theme), 0, 0));
  return container;
}
