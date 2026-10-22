# Design: pi-dsh-plan

**Plan mode for pi: deployment-owned guidance, a reviewed exit, and state folded from the session branch. The port substitutes the channels pi does not provide.**

|                |                                                                                          |
| -------------- | ---------------------------------------------------------------------------------------- |
| **Status**     | Implemented and open for comments                                                        |
| **Owner**      | Frost-rA9                                                                                |
| **Scope**      | This document records the design points of `pi-dsh-plan`, and the dsh anchor and port result for each ported behavior. |
| **Related**    | [`README.md`](../README.md), [`THIRD-PARTY-NOTICES.md`](../THIRD-PARTY-NOTICES.md), [`anchors-dsh.json`](anchors-dsh.json), [`anchors-pi.json`](anchors-pi.json), [pi-dsh-sandbox](https://github.com/Frost-rA9/pi-dsh-sandbox) |
| **Audience**   | Maintainers of `pi-dsh-plan`, and anyone porting another dsh package to pi               |

Out of scope:

- The implementation walkthrough, which the source headers own.
- The operational procedures, which `README.md` owns.
- dsh features left out on purpose, one row each in chapter 5.

## 1. Summary

`pi-dsh-plan` adds a session mode that asks the agent to explore and design before it executes, without taking any tool away. Three substitutions separate it from dsh `@deepseek-ai/dsh-plan-mode`.

State is one appended custom entry instead of a log-only event folded by a projection. The review uses `ctx.ui.select` instead of the user-questions seam. A switch during a run reaches the model as a visible notice instead of a prompt section that dsh re-evaluates per request.

## 2. Terms and grounding

**Mode** is the boolean plan state: on or off. It changes the guidance the agent receives, not the tools it may use. Confinement is a separate extension.

**Anchor** is the dsh path and symbol that a ported behavior came from. **Port result** uses one of five labels:

- **Ported**: the behavior matches dsh, with pi-specific plumbing where an API differs.
- **Ported verbatim**: strings or derivations copied without change.
- **Substituted**: the behavior is the same, and the storage or channel is a pi equivalent.
- **Extended**: the port adds behavior dsh does not have at that anchor.
- **Not ported**: the dsh feature is absent here, and the table names the consequence.

The dsh anchors below come from `deepseek-harness` at `687f282e86` (`0.2.1-rc.2`). The pi behavior refers to pi `1.4.0` in `anchors-pi.json`. dsh paths are relative to the harness root, and pi paths to this repository.

The dsh tree moves, so re-check a path and symbol before you rely on it, and cite the commit when a divergence matters. Tooling anchors live in `anchors-dsh.json` and `anchors-pi.json`. The chapter 5 table is the readable view, and both files change with it.

## 3. Goals and non-goals

The extension keeps dsh's policy decisions and replaces only the pi integration points.

Goals:

- Ask the agent to plan before executing, with wording the deployment owns.
- Keep the request tool catalog stable across mode transitions.
- Recover the mode from the active branch after resume or fork.
- Fail closed when no review channel exists.

Non-goals:

- Enforcement: the extension filters no tool. Confinement is `pi-dsh-sandbox`'s job.
- Feedback text on `Keep planning`: `ctx.ui.select` has no free-text field.
- A creation-time plan option: `--plan` covers startup.
- Todo and progress tracking, which dsh keeps in `packages/todo/tool-todo`.

## 4. Design points

### 4.1 Guidance, not enforcement

> **Why & What: guidance only, no tool filtering**
>
> **What:** while plan mode is active, the extension contributes the `plan_policy` prompt section and changes no tool.
>
> **Why:** dsh treats plan mode as guidance, with sandbox mode and approval policy as the enforcement axes. Filtering tools here would duplicate the sandbox and churn the tool catalog on every switch. The mode does not stop a model that ignores the guidance.
>
> **Alternatives considered:**
> - *Disable `edit` and `write` while planning:* guarantees the restriction without the sandbox, but conflates planning with permissions and breaks plans that need a scratch file.
>
> **Fallback:** `/plan off`.

### 4.2 State is an appended entry

> **Why & What: `appendEntry` replaces the log-only event**
>
> **What:** each mode change appends one `dsh-plan-mode` custom entry, and `session_start` folds the active branch so the last entry wins.
>
> **Why:** dsh stores `plan/mode` as a log-only session event folded by a projection. pi exposes no log-only event type and no projection registry to extensions, so the nearest durable store is a custom entry.
>
> **Alternatives considered:**
> - *In-process memory:* cheaper, but resume and fork lose the state.
> - *A JSON file outside the session:* durable, but branch navigation cannot see it, so an abandoned branch leaks into the next session.
>
> **Fallback:** no entry means inactive, so a missing or corrupt entry degrades to off.

### 4.3 The reviewed exit

> **Why & What: the exit is always registered, the review is a select**
>
> **What:** `exit_plan_mode` stays in the tool catalog in both modes. On a valid plan it asks `Approve` or `Keep planning` through `ctx.ui.select`, and fails closed without a dialog channel. A dismissed review returns a result, ends the turn, and leaves plan mode on.
>
> **Why:** dsh keeps the tool registered so entering or leaving plan mode changes only the prompt section, not the tool catalog. `select` has no free-text field, so `Keep planning` gives no feedback.
>
> dsh 0.2.1-rc.2 made dismissal a normal result. pi uses `terminate: true`, which ends the batch when all results agree.
>
> **Alternatives considered:**
> - *Unregister the tool outside plan mode:* the catalog changes on every switch.
> - *A `ui.custom` plan card:* richer, but TUI-only and returns `undefined` in RPC.
>
> **Fallback:** `/plan off` remains the escape.

### 4.4 Mid-run switches reach the model as a notice

> **Why & What: a visible notice covers the frozen section**
>
> **What:** every real mode change emits one custom message (`dsh-plan-notice`). It appears in the transcript, reaches the model, and carries the guidance text when the agent is working. A repeated selection and the startup flag stay silent.
>
> **Why:** pi builds prompt sections once per run and freezes them. A switch during a run cannot change `plan_policy` until the next run. dsh re-evaluates its policy per request, so it needs only a short narration.
>
> **Alternatives considered:**
> - *A request-local `context` transform:* model-visible and user-invisible, unlike dsh's visible narration.
>
> **Fallback:** the section corrects at the next run if the model misses the notice.

### 4.5 The submitted plan renders in the tool row

> **Why & What: read the plan while you review it**
>
> **What:** `exit_plan_mode` registers `renderCall`, which draws the plan as markdown in the tool row. The row shows the first `PLAN_PREVIEW_LINES` body lines and expands to the whole plan. `ctrl+O` and a left click in fullscreen toggle it.
>
> **Why:** dsh presents the plan as a `plan-review` card with a sidebar viewer. pi has no sidebar, and `ctx.ui.select` takes only a title, so the body cannot go in the dialog. The tool row is the nearest markdown surface shared by the TUI and the HTML export, and it stays out of model context.
>
> **Alternatives considered:**
> - *A custom message renderer:* draws in the message area, but enters model context again.
> - *`ctx.ui.custom` with a markdown viewer:* carries the plan, but is TUI-only and returns `undefined` in RPC.
>
> **Fallback:** RPC, print, and JSON clients read the raw `tool_execution_start` payload.

## 5. Porting results and dsh anchors

| Behavior | dsh anchor | pi anchor | Port result |
| --- | --- | --- | --- |
| Durable mode state | `packages/plan/plan-mode/src/index.ts` (`plan/mode`, `planProjectionDefinition`), `src/types.ts` (`PlanProjection`) | `src/state.ts` (`PlanState`, `MODE_ENTRY`) | Substituted: one `pi.appendEntry` per change, branch fold. dsh's log-only event and projection registry have no pi equivalent (ch. 4.2). |
| Plan guidance section | `packages/plan/plan-mode/src/index.ts` (`systemPrompt.section`, `plan:policy`) | `src/guidance.ts` (`PLAN_POLICY_SECTION`), `index.ts` (`before_agent_start`) | Ported. The key becomes `plan_policy` because pi renders section keys as XML tags. |
| `/plan` command | `packages/plan/plan-mode/src/index.ts` (`commands.register({ name: 'plan' })`) | `src/command.ts`, `index.ts` | Extended: bare `/plan` opens a picker, and `on` is an explicit keyword. `/plan off` cannot reject attachments, because pi runs an extension command before attachment handling. |
| `exit_plan_mode` registration | `packages/plan/plan-mode/src/index.ts` (`EXIT_PLAN_MODE`) | `src/tool.ts` | Ported. The port adapts the description (see `THIRD-PARTY-NOTICES.md`). |
| Plan validation | `packages/plan/plan-mode/src/index.ts` (`/^#\s+\S/`, `firstHeading`) | `src/plan.ts` (`validatePlan`, `firstHeading`) | Ported verbatim. |
| Review exchange | `packages/plan/plan-mode/src/index.ts` (user-questions, `Approve` / `Keep planning` / free text) | `src/exit.ts` (`runExitPlanMode`), `src/tool.ts` | Substituted: `ctx.ui.select` with the two labels. No free-text field, so `Keep planning` returns no feedback. A dismissed review returns a result and ends the tool batch with `terminate`. dsh concludes the turn directly. |
| Plan presentation and preview | `packages/plan/plan-mode/src/index.ts` (`presentCall`, `presentResult`, `plan-review`), `packages/client/ui-plan/src/client/PlanPreview.tsx` | `src/preview.ts` (`renderPlanPreview`), `src/tool.ts` (`renderCall`) | Substituted: markdown in the tool row, collapsed by default and expandable. It replaces the review card and sidebar viewer. TUI and HTML export only. |
| Switch narration | `packages/plan/plan-mode/src/index.ts` (`narration`, `activeAtLastHeader`) | `src/notice.ts` (`switchNotice`, `planNoticeText`) | Ported wording. The port delivers it as a visible custom message. A mid-run entry carries the guidance text. |
| Config shape | `packages/plan/plan-mode/src/index.ts` (`resolveConfig`, `{ section }` only) | `src/config.ts` (`parseConfig`) | Ported strictness. Validation moves from plugin load to `session_start`, because pi forbids action calls at load. |
| Pending selection across a step | `packages/plan/plan-mode/src/index.ts` (`pendingIntents`, `agent/pre-step`) | not ported | Divergence: pi commits at the command, because one provider request covers an assistant turn and the section is frozen per run. |
| Projection-derived `pending` | `packages/plan/plan-mode/src/types.ts` (`PlanProjection.pending`) | not ported | Divergence: pi has no command lifecycle to fold. |
| Todo plan tracking | `packages/todo/tool-todo` | not ported | Non-goal: the plan-step lifecycle belongs to a separate extension. |

## 6. Benefits and costs

Benefits:

- A stable tool catalog: entering or leaving plan mode changes the prompt section, not the request tool catalog.
- Deployment-owned wording, so the guidance follows the deployment rather than the extension.
- The submitted plan is readable in the transcript before approval, collapsed by default and expandable in place.
- Fail-closed review: a missing dialog channel leaves plan mode on instead of approving silently.

Costs:

- The storage substitution drops dsh's projection-derived `pending` view, so no surface says a plan-mode change is still queued.
- The frozen section needs a second delivery path, the notice, which dsh does not have.
- The mode is guidance only, so a model that ignores it still mutates files unless the deployment configures `pi-dsh-sandbox`.

## 7. Open questions

- Should the review collect feedback through a second dialog after `Keep planning`? Owner: maintainer. A second dialog may cost more attention than the feedback is worth.
- Should plan mode offer a creation-time option? Owner: maintainer. dsh lists the absence as a limitation, and `--plan` covers the common case.
- Should the pending-selection semantics be restored if pi gains a per-step boundary? Owner: maintainer. The current commit-at-command behavior is observably equivalent for entering and leaving, and only the queued view is lost.
