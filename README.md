# pi-dsh-plan

English | [中文](README.zh.md)

Plan mode for [pi](https://github.com/earendil-works/pi): the agent explores and designs before executing. Your deployment owns the guidance text, and every tool stays available.

Plan mode guides while [pi-dsh-sandbox](https://github.com/Frost-rA9/pi-dsh-sandbox) confines. The two keep separate state.

The code lives in `index.ts`, with one module per concern under `src/`.

## Install

Install from GitHub:

```bash
pi install git:github.com/Frost-rA9/pi-dsh-plan
```

To install a local checkout instead, run `pi install ./pi-dsh-plan` from the directory that contains it.

The package ships no runtime dependencies, because pi aliases `@earendil-works/pi-coding-agent` and `typebox` at load time.

## Use

Use `/plan` to change modes. The footer shows the current state as `[plan mode::on]` or `[plan mode::off]`.

Without a dialog channel, such as print mode, the picker prints the state and the explicit forms instead.

| Command | Effect |
|---|---|
| `/plan` | Open the on/off picker |
| `/plan on` | Enter plan mode |
| `/plan off` | Leave plan mode |
| `/plan <message>` | Enter plan mode and send the message as your next user message |

The `--plan` flag enters plan mode at startup and overrides the state restored from the session log.

## The reviewed exit

When the agent has a complete plan, it calls `exit_plan_mode` with markdown that starts with a `#` heading. The tool call shows the plan, and pi asks you to choose:

- `Approve`: plan mode ends, and the tool result tells the model to execute the plan
- `Keep planning`: the call fails, and the model revises the plan
- Dismissed dialog: the call fails, and the model waits for your message
- No dialog channel: the call fails closed, and `/plan off` remains the manual escape

The tool stays registered while plan mode is off. A transition therefore changes only the prompt section, not the tool catalog.

Calling the tool outside plan mode fails.

## Guidance timing

pi builds the `plan_policy` section once per user prompt and freezes it for the whole run. A switch while the agent is working cannot change the section until your next prompt.

The extension sends a notice instead: one custom message per change, shown in the transcript and sent to the model as a user message.

Entering plan mode while the agent is working carries the guidance text, because the frozen section has none. Leaving sends a withdrawal.

A repeated selection, or `--plan` at startup, sends nothing.

## Session state

Each mode change appends one `dsh-plan-mode` entry to the session. At startup the extension folds the active branch, and the last entry wins.

Entries never enter the model context.

## Configuration

Set the guidance text in `pi-dsh-plan.json` in `<your_agent_dir>/extensions/`. `<your_agent_dir>` defaults to `~/.pi/agent`, and a project file at `.pi/dsh-plan.json` overrides the global one.

```json
{
  "section": "You are in plan mode. Explore before proposing changes."
}
```

`section` is the only accepted key. An unknown key or a non-string value is reported at startup, and plan mode then contributes no guidance.

Without a section, plan mode still works but stays silent, and the session tells you once when plan mode starts.

## Limitations

Plan mode has these limits:

- **Guidance, not enforcement**: every tool stays callable, so use pi-dsh-sandbox for confinement
- **Frozen sections**: the section updates at your next prompt, and the notice covers the requests in between
- **No feedback on keep-planning**: the `select` dialog has no free-text field
- **Attachments never reach the command**: pi runs an extension command before attachment handling, so `/plan off` cannot reject images and `/plan <message>` cannot carry them
- **No plan option at creation**: a forked session inherits the logged state, and a new session starts off unless you pass `--plan`

## Tests

Run the checks from the checkout:

```bash
npm test
npm run check
npm run e2e
```

`npm test` runs the unit tests in Node 24. `npm run check` symlinks the host pi package, `typebox`, and `@types/node` into a gitignored `node_modules`, then runs the compiler.

`PI_PACKAGE_ROOT` and `PI_TSC` override the resolution.

`npm run e2e` drives `/plan`, `/plan off`, and `--plan` over the remote procedure call (RPC) mode of pi. It needs `pi` on `PATH`.

## License

MIT. The `exit_plan_mode` description is adapted from the DeepSeek harness, and `THIRD-PARTY-NOTICES.md` carries the notice.
