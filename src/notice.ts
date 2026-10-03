/**
 * Mode-change notices.
 *
 * dsh appends a plugin-sourced user message when a user-driven switch changes
 * what the model sees, and stays silent for the approved exit because its tool
 * result already reports the change. pi has no projection to land that notice at
 * a step boundary, so this package emits one visible custom message per real
 * change instead. A custom message is displayed in the transcript and converted
 * to a user message in model context, which is dsh's notice in pi terms: the
 * user sees the switch copy, and so does the model.
 *
 * Entering plan mode while a run is open also carries the guidance text,
 * because pi assembles the `plan_policy` section once per user prompt and
 * freezes it for the whole run. Without the text the model would not learn the
 * guidance until the next prompt. At a prompt boundary the section carries the
 * guidance, so the notice stays the short switch sentence.
 *
 * @module pi-dsh-plan/notice
 */

/** Custom message type for the switch notice. */
export const PLAN_NOTICE_TYPE = "dsh-plan-notice";

/**
 * The switch sentence, matching dsh's wording.
 *
 * @param active Whether plan mode is now in force.
 */
export function switchNotice(active: boolean): string {
  return active
    ? "The user switched this session to plan mode."
    : "The user switched this session back to the default mode.";
}

/**
 * The complete notice text for one change.
 *
 * @param active Whether plan mode is now in force.
 * @param section The deployment-owned guidance text.
 * @param midRun Whether a run is open, so the frozen section cannot carry the
 * guidance yet.
 */
export function planNoticeText(active: boolean, section: string, midRun: boolean): string {
  const base = switchNotice(active);
  if (!active || !midRun || section.trim() === "") return base;
  return `${base}\n\nFollow this guidance:\n\n${section}`;
}
