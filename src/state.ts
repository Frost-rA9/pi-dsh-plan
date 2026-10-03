/**
 * Session-scoped plan state.
 *
 * dsh keeps one log-only whole-value event (`plan/mode`) that a projection
 * folds, so resume and fork recover the last value. pi has no log-only session
 * event and no projection registry; the equivalent is one `pi.appendEntry`
 * custom entry restored from the active branch at session start. One entry per
 * decision, last value wins, which keeps the same "whole-value replace" reading.
 *
 * The skeleton commits a selection immediately (`committed` / `noop`). dsh
 * instead queues a selection made during an open turn until the next accepted
 * in-turn pre-step; pi's extension commands already run immediately, even
 * during streaming, and pi assembles one provider request per assistant turn,
 * so immediate commit is observably equivalent for entering and leaving. The
 * `queued` / `cancelled` outcomes are reserved for the reviewed exit.
 *
 * @module pi-dsh-plan/state
 */

/** Custom entry type carrying one plan-mode decision. */
export const MODE_ENTRY = "dsh-plan-mode";

/** Footer status key. */
export const STATUS_KEY = "dsh-plan";

/** What happened to a requested selection. */
export type SetOutcome = "committed" | "queued" | "cancelled" | "noop";

/** The subset of a session entry this module folds. */
export interface PlanBranchEntry {
  type: string;
  customType?: string;
  data?: unknown;
}

/** The only `pi` capability the state needs, so tests can pass a stub. */
export interface PlanEntryAppender {
  appendEntry<T = unknown>(customType: string, data?: T): void;
}

/** One session's plan state. */
export class PlanState {
  /** Logged plan mode. */
  private activeFlag = false;

  /** Whether plan mode is in force. */
  active(): boolean {
    return this.activeFlag;
  }

  /** Reset per-session state before restoring it from the branch. */
  beginSession(_ctx: unknown): void {
    this.activeFlag = false;
  }

  /**
   * Fold the active branch: the last `MODE_ENTRY` wins, and a branch with none
   * stays inactive.
   */
  restore(branch: readonly PlanBranchEntry[]): void {
    for (const entry of branch) {
      if (entry.type !== "custom" || entry.customType !== MODE_ENTRY) continue;
      const active = (entry.data as { active?: unknown } | undefined)?.active;
      if (typeof active === "boolean") this.activeFlag = active;
    }
  }

  /**
   * Select whether plan mode is active. The switch is its entry, so a resume
   * replays it. Selecting the current state is a no-op.
   *
   * @param pi The entry appender (`pi.appendEntry`).
   * @param active The requested state.
   */
  set(pi: PlanEntryAppender, active: boolean): SetOutcome {
    if (active === this.activeFlag) return "noop";
    this.activeFlag = active;
    pi.appendEntry(MODE_ENTRY, { active });
    return "committed";
  }
}
