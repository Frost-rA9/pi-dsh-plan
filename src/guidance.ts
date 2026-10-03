/**
 * The `plan_policy` system-prompt section.
 *
 * pi exposes prompt sections through `before_agent_start`; a section is a
 * `Record<string, string>` whose keys become XML tag names in the rendered
 * prompt. While plan mode is active the deployment's guidance text is present,
 * and leaving plan mode removes the key so the section disappears from the
 * next assembled prompt. Inactive mode contributes nothing.
 *
 * Note the granularity: sections are assembled from the options captured when
 * the user prompt starts, so a mode change during an open run cannot affect the
 * section until the next user prompt. The `context` correction added in a later
 * construction step covers the remainder of the open run.
 *
 * @module pi-dsh-plan/guidance
 */

/** Section key, and therefore the XML tag the model sees. */
export const PLAN_POLICY_SECTION = "plan_policy";

/**
 * Set or clear the plan policy section for one prompt assembly.
 *
 * @param sections The mutable `systemPromptOptions.sections` record.
 * @param section The deployment-owned guidance text.
 * @param active Whether plan mode is in force.
 */
export function applyPolicySection(
  sections: Record<string, string>,
  section: string,
  active: boolean,
): void {
  if (active && section.trim() !== "") sections[PLAN_POLICY_SECTION] = section;
  else delete sections[PLAN_POLICY_SECTION];
}
