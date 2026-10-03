# Design: pi-dsh-plan

**Plan mode for pi: deployment-owned guidance, a reviewed exit, and state folded from the session branch, ported from dsh with substitutes for the channels pi does not provide.**

|                |                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------- |
| **Status**     | Implemented; open for comments                                                           |
| **Owner**      | Frost-rA9                                                                                |
| **Scope**      | The design points of `pi-dsh-plan` and the dsh anchor and port result for each ported behavior. Excludes the implementation walkthrough (the source headers own it), the operational procedures (`README.md` owns them), and dsh features left out on purpose (one row each in chapter 5). |
| **Related**    | [`README.md`](../README.md); [`THIRD-PARTY-NOTICES.md`](../THIRD-PARTY-NOTICES.md); [`anchors-dsh.json`](anchors-dsh.json); [`anchors-pi.json`](anchors-pi.json); [pi-dsh-sandbox](https://github.com/Frost-rA9/pi-dsh-sandbox) |
| **Audience**   | Maintainers of `pi-dsh-plan`, and anyone porting another dsh package to pi               |

## 1. Summary

`pi-dsh-plan` adds a session mode that asks the agent to explore and design before executing, without taking any tool away. Three substitutions separate it from dsh `@deepseek-ai/dsh-plan-mode`: state is one appended custom entry instead of a log-only event folded by a projection, the review uses `ctx.ui.select` instead of the user-questions seam, and a switch during a run reaches the model as a visible notice instead of a prompt section that dsh re-evaluates per request. Chapter 4 records the design points, each non-trivial choice in a Why & What box. Chapter 5 anchors every ported behavior to its dsh source and names the divergence.

## 2. Terms and grounding

**Mode** is the boolean plan state: on or off. It changes what the agent is asked to do, not what it may do; confinement is a separate extension.

**Anchor** is the dsh path and symbol a behavior was ported from. **Port result** uses one of five labels:

- **Ported**: the behavior matches dsh, with pi-specific plumbing where an API differs.
- **Ported verbatim**: strings or derivations copied without change.
- **Substituted**: the behavior is the same, the storage or channel is a pi equivalent.
- **Extended**: the port adds behavior dsh does not have at that anchor.
- **Not ported**: the dsh feature is absent here, and the table names the consequence.

The dsh anchors below were read from the `deepseek-harness` checkout at commit `5badb15009`. The pi behavior was verified against `pi-dsh-plan` at `8738c5d`. dsh paths are relative to the `deepseek-harness` root; pi paths are relative to this repository root. The dsh tree moves, so re-check a path and symbol before relying on it, and cite the commit when a divergence matters. Anchors for tooling live beside this document in [`anchors-dsh.json`](anchors-dsh.json) and [`anchors-pi.json`](anchors-pi.json); the table in chapter 5 is the readable view, and both are updated in the same change.

## 3. Goals and non-goals

The extension keeps dsh's policy decisions and replaces only the pi integration points.

Goals:

- Ask the agent to plan before executing, with wording the deployment owns.
- Keep the request tool catalog stable across mode transitions.
- Recover the mode from the active branch after resume or fork.
- Fail closed when no review channel exists.

Non-goals:

- Enforcement: the extension filters no tool. Confinement is `pi-dsh-sandbox`'s job.
- Feedback text on `Keep planning`; `ctx.ui.select` has no free-text field.
- A creation-time plan option; `--plan` covers startup.
- Todo and progress tracking, which dsh keeps in `packages/todo/tool-todo`.

## 4. Design points

### 4.1 Guidance, not enforcement

> **Why & What: the section guides, no tool is filtered**
>
> **What:** while plan mode is active, the extension contributes the `plan_policy` prompt section and changes no tool.
>
> **Why:** dsh states that plan mode guides rather than restricts, and that sandbox mode and approval policy are the enforcement axes. Filtering tools here would duplicate the sandbox's job and make the tool catalog churn on every switch. It does not stop a model that ignores the guidance; the deployment must configure `pi-dsh-sandbox` for that.
>
> **Alternatives considered:**
> - *Disable `edit` and `write` while planning:* the `examples/extensions/plan-mode/` extension shipped with pi does this, and it gives a guarantee without the sandbox. It still conflates planning with permissions, and a plan that needs a scratch file breaks.
>
> **Fallback:** `/plan off`, or a deployment that never enables plan mode.

The section is assembled once per user prompt and frozen for the run, which is why chapter 4.4 exists.

### 4.2 State is an appended entry

> **Why & What: `appendEntry` replaces the log-only event**
>
> **What:** each mode change appends one `dsh-plan-mode` custom entry, and `session_start` folds the active branch so the last entry wins.
>
> **Why:** dsh stores `plan/mode` as a log-only session event folded by a projection. pi exposes neither a log-only event type nor a projection registry to extensions, so the nearest durable, non-context store is a custom entry. It does not preserve dsh's projection-derived `pending` view, because pi has no command lifecycle to fold.
>
> **Alternatives considered:**
> - *In-process memory:* cheaper, but a resume or a fork loses the state, which is the case the store exists for.
> - *A JSON file outside the session:* durable, but invisible to branch navigation and fork, so an abandoned branch would leak into the next session.
>
> **Fallback:** no entry means inactive, so a missing or corrupt entry degrades to off instead of failing.

### 4.3 The reviewed exit

> **Why & What: the exit is always registered, the review is a select**
>
> **What:** `exit_plan_mode` stays in the tool catalog in both modes. On a valid plan it asks `Approve` or `Keep planning` through `ctx.ui.select`, and fails closed when no dialog channel exists.
>
> **Why:** dsh keeps the tool registered so entering or leaving plan mode changes only the prompt section, not the request tool catalog, and reviews through user-questions. A stable catalog avoids a transition that invalidates the cached prefix. `select` has no free-text field, so `Keep planning` cannot return feedback; that is the one interaction the port cannot reproduce.
>
> **Alternatives considered:**
> - *Unregister the tool outside plan mode:* the catalog then changes on every switch.
> - *A `ui.custom` plan card:* richer, but it is TUI-only and returns `undefined` in RPC, so it needs a second code path.
>
> **Fallback:** `/plan off` leaves plan mode without the tool, and a missing channel still leaves that escape.

### 4.4 Mid-run switches reach the model as a notice

> **Why & What: a visible notice covers the frozen section**
>
> **What:** every real mode change emits one custom message (`dsh-plan-notice`), displayed in the transcript and sent to the model. Entering plan mode while the agent is working also carries the guidance text.
>
> **Why:** pi builds prompt sections once per user prompt and freezes them for the run, so a switch during a run cannot change `plan_policy` until the next prompt. dsh re-evaluates its policy text on every request assembly, so it needs only a short narration. The notice carries the guidance whenever the frozen section cannot. A repeated selection and the startup flag stay silent.
>
> **Alternatives considered:**
> - *A request-local `context` transform:* model-visible and invisible to the user, which is what dsh's narration is not. The user needs to see the switch, and a transcript message matches dsh's logged notice.
>
> **Fallback:** the section corrects at the next prompt even if the notice is missed.

## 5. Porting results and dsh anchors

| Behavior | dsh anchor | pi anchor | Port result |
| --- | --- | --- | --- |
| Durable mode state | `packages/plan/plan-mode/src/index.ts` (`plan/mode`, `planProjectionDefinition`), `src/types.ts` (`PlanProjection`) | `src/state.ts` (`PlanState`, `MODE_ENTRY`) | Substituted: one `pi.appendEntry` per change, branch fold. dsh's log-only event and projection registry have no pi equivalent (ch. 4.2). |
| Plan guidance section | `packages/plan/plan-mode/src/index.ts` (`systemPrompt.section`, `plan:policy`) | `src/guidance.ts` (`PLAN_POLICY_SECTION`), `index.ts` (`before_agent_start`) | Ported; the key becomes `plan_policy` because pi renders section keys as XML tags. |
| `/plan` command | `packages/plan/plan-mode/src/index.ts` (`commands.register({ name: 'plan' })`) | `src/command.ts`, `index.ts` | Extended: bare `/plan` opens a picker and `on` is an explicit keyword. `/plan off` cannot reject attachments, because pi runs an extension command before attachment handling. |
| `exit_plan_mode` registration | `packages/plan/plan-mode/src/index.ts` (`EXIT_PLAN_MODE`) | `src/tool.ts` | Ported; the description is adapted (see `THIRD-PARTY-NOTICES.md`). |
| Plan validation | `packages/plan/plan-mode/src/index.ts` (`/^#\s+\S/`, `firstHeading`) | `src/plan.ts` (`validatePlan`, `firstHeading`) | Ported verbatim. |
| Review exchange | `packages/plan/plan-mode/src/index.ts` (user-questions, `Approve` / `Keep planning` / free text) | `src/exit.ts` (`runExitPlanMode`), `src/tool.ts` | Substituted: `ctx.ui.select` with the two labels. No free-text field, so `Keep planning` returns no feedback. |
| Switch narration | `packages/plan/plan-mode/src/index.ts` (`narration`, `activeAtLastHeader`) | `src/notice.ts` (`switchNotice`, `planNoticeText`) | Ported wording; delivery adapted to a visible custom message, and a mid-run entry carries the guidance text. |
| Config shape | `packages/plan/plan-mode/src/index.ts` (`resolveConfig`, `{ section }` only) | `src/config.ts` (`parseConfig`) | Ported strictness; validation moves from plugin load to `session_start`, because pi forbids action calls at load. |
| Pending selection across a step | `packages/plan/plan-mode/src/index.ts` (`pendingIntents`, `agent/pre-step`) | not ported | Divergence: pi commits at the command, because one provider request covers an assistant turn and the section is frozen per run. |
| Projection-derived `pending` | `packages/plan/plan-mode/src/types.ts` (`PlanProjection.pending`) | not ported | Divergence: pi has no command lifecycle to fold. |
| Todo plan tracking | `packages/todo/tool-todo` | not ported | Non-goal: the plan-step lifecycle belongs to a separate extension. |

## 6. Benefits and costs

Benefits:

- A stable tool catalog: entering or leaving plan mode changes the prompt section, not the request tool catalog.
- Deployment-owned wording, so the guidance follows the deployment rather than the extension.
- Recovery from the active branch, so resume and fork keep the mode without a live mirror.
- Fail-closed review: a missing dialog channel leaves plan mode on instead of approving silently.

Costs:

- The storage substitution drops dsh's projection-derived `pending` view, so no surface says a plan-mode change is still queued.
- The review cannot collect feedback text, so `Keep planning` always returns without direction.
- The frozen section needs a second delivery path, the notice, which dsh does not have.
- The mode is guidance only, so a model that ignores it still mutates files unless the sandbox is configured.

## 7. Open questions

- Should the review collect feedback through a second dialog after `Keep planning`? Owner: maintainer. A second dialog may cost more attention than the feedback is worth.
- Should plan mode offer a creation-time option? Owner: maintainer. dsh lists the absence as a limitation, and `--plan` covers the common case.
- Should the pending-selection semantics be restored if pi gains a per-step boundary? Owner: maintainer. The current commit-at-command behavior is observably equivalent for entering and leaving, and only the queued view is lost.

The design points and the anchors are facts checked at the commits named in chapter 2. The open questions are proposals, and input on them is welcome.
