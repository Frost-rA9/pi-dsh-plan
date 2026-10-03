/**
 * `/plan` argument parsing.
 *
 * Bare `/plan` opens the select picker. The exact argument `on` enters, the
 * exact argument `off` leaves, and any other non-empty argument enters and is
 * submitted as the next ordinary user message under plan guidance. This mirrors
 * the `/sandbox` picker shape: the picker is the no-argument form, and the
 * explicit forms are what a client or script uses.
 *
 * @module pi-dsh-plan/command
 */

/** Parsed `/plan` arguments. */
export type PlanCommandArgs =
  | { kind: "picker" }
  | { kind: "on"; message: string }
  | { kind: "off" };

/**
 * Parse the raw argument string after `/plan`.
 *
 * @param raw Everything after the command name, untrimmed.
 */
export function parsePlanArgs(raw: string): PlanCommandArgs {
  const trimmed = raw.trim();
  if (trimmed === "") return { kind: "picker" };
  if (trimmed === "off") return { kind: "off" };
  if (trimmed === "on") return { kind: "on", message: "" };
  return { kind: "on", message: trimmed };
}
