/**
 * Deployment-owned plan guidance, read from JSON config files at session start.
 *
 * dsh validates `{ section }` at plugin load and refuses to start on a missing,
 * blank, or unknown-keyed section. pi cannot call action methods during
 * extension loading, so this package loads the same shape from configuration
 * files during `session_start` instead. A missing section still leaves `/plan`
 * and `exit_plan_mode` working, but contributes no guidance; the session says so
 * once when plan mode is in force or entered, not at every startup. Unknown keys
 * and non-string sections are refused and reported at session start.
 *
 * @module pi-dsh-plan/config
 */

/** Validated plan-mode configuration. */
export interface PlanConfig {
  /**
   * Guidance rendered as the `plan_policy` prompt section while plan mode is
   * active. Empty means "not configured": plan mode stays silent.
   */
  section: string;
}

/** The unconfigured value, used when no config file exists. */
export const DEFAULT_CONFIG: PlanConfig = { section: "" };

/**
 * Validate raw configuration.
 *
 * @param raw The merged JSON object, or `undefined` when no file exists.
 * @returns A detached validated config.
 * @throws When a key other than `section` is present or `section` is not a string.
 */
export function parseConfig(raw: unknown): PlanConfig {
  if (raw === undefined || raw === null) return { ...DEFAULT_CONFIG };
  if (typeof raw !== "object" || Array.isArray(raw)) {
    throw new Error("expected a JSON object with a `section` string");
  }
  const record = raw as Record<string, unknown>;
  const unknown = Object.keys(record).filter((key) => key !== "section");
  if (unknown.length > 0) {
    throw new Error(`unknown key(s) ${unknown.join(", ")}: config is { section }`);
  }
  const section = record.section;
  if (section === undefined) return { ...DEFAULT_CONFIG };
  if (typeof section !== "string") throw new Error("`section` must be a string");
  return { section };
}
