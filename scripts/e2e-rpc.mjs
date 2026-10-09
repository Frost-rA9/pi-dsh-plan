/**
 * End-to-end checks for pi-dsh-plan over pi's RPC mode. No model call.
 *
 * `/plan` is an extension command, so `prompt` executes it immediately and no
 * run starts. This verifies the parts that need a real pi process:
 *
 *   - the extension loads and `/plan` is discoverable through `get_commands`;
 *   - `/plan on` and `/plan off` append one `dsh-plan-mode` custom entry each,
 *     and the entry reaches the client as `entry_appended` and through
 *     `get_entries`;
 *   - a repeated `/plan on` is a no-op;
 *   - bare `/plan` opens the select picker, and answering it applies the mode;
 *   - `--plan` enters plan mode at session start, and `/plan off` clears it;
 *   - a crafted session holding one `exit_plan_mode` call exports through
 *     `export_html` with the real tool renderer, so the collapsed preview and
 *     its expand hint are checked against pi, not only the pure excerpt.
 *
 * The reviewed `exit_plan_mode` exchange needs a real user (or an RPC client
 * that answers `extension_ui_request`) plus a model to call the tool, so it
 * stays a manual check. The export check above reaches the renderer without a
 * model, by loading a hand-written session fixture.
 *
 * Usage: node scripts/e2e-rpc.mjs [extensionDir]
 *
 * @module pi-dsh-plan/scripts/e2e-rpc
 */

import { spawn } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";
import readline from "node:readline";

const here = dirname(fileURLToPath(import.meta.url));
const extensionDir = process.argv[2] ?? resolve(here, "..");
const MODE_ENTRY = "dsh-plan-mode";

const rows = [];
const record = (name, ok, detail = "") => rows.push([ok ? "PASS" : "FAIL", name, detail]);

/** Start one pi RPC process and expose command sending, events, and UI replies. */
function startPi(extraArgs = [], options = {}) {
  const sessionArgs = options.session === undefined ? ["--no-session"] : ["--session", options.session];
  const child = spawn("pi", ["--mode", "rpc", "-e", extensionDir, ...sessionArgs, ...extraArgs], {
    cwd: process.cwd(),
    stdio: ["pipe", "pipe", "pipe"],
  });

  let stderr = "";
  child.stderr.on("data", (data) => {
    stderr += data;
  });

  const pending = new Map();
  const events = [];
  const waiters = [];

  readline.createInterface({ input: child.stdout }).on("line", (line) => {
    let message;
    try {
      message = JSON.parse(line);
    } catch {
      return;
    }
    if (message.type === "response" && message.id && pending.has(message.id)) {
      pending.get(message.id)(message);
      pending.delete(message.id);
      return;
    }
    events.push(message);
    for (const waiter of [...waiters]) {
      if (waiter.predicate(message)) {
        waiters.splice(waiters.indexOf(waiter), 1);
        waiter.resolve(message);
      }
    }
  });

  function send(command, timeoutMs = 30_000) {
    return new Promise((resolvePromise, reject) => {
      const id = `req-${Math.random().toString(36).slice(2)}`;
      pending.set(id, resolvePromise);
      child.stdin.write(`${JSON.stringify({ ...command, id })}\n`);
      setTimeout(() => {
        if (pending.delete(id)) reject(new Error(`timeout: ${JSON.stringify(command)}`));
      }, timeoutMs);
    });
  }

  function waitForEvent(predicate, timeoutMs = 5000) {
    const seen = events.find(predicate);
    if (seen) return Promise.resolve(seen);
    return new Promise((resolvePromise, reject) => {
      const waiter = { predicate, resolve: resolvePromise };
      waiters.push(waiter);
      setTimeout(() => {
        const index = waiters.indexOf(waiter);
        if (index !== -1) {
          waiters.splice(index, 1);
          reject(new Error("timeout waiting for event"));
        }
      }, timeoutMs);
    });
  }

  /** Answer a dialog request (`select`, `confirm`, `input`, `editor`). */
  function respond(id, value) {
    child.stdin.write(`${JSON.stringify({ type: "extension_ui_response", id, value })}\n`);
  }

  const planEntries = (response) =>
    (response.data?.entries ?? []).filter(
      (entry) => entry.type === "custom" && entry.customType === MODE_ENTRY,
    );

  const close = () => {
    child.stdin.end();
    child.kill("SIGKILL");
  };

  return { send, waitForEvent, respond, planEntries, close, stderr: () => stderr };
}

/** Scenario A: a fresh session, explicit entry and exit, then the picker. */
async function freshSession() {
  const pi = startPi();
  try {
    const state = await pi.send({ type: "get_state" });
    record("RPC ready", state.success === true);

    const commands = await pi.send({ type: "get_commands" });
    const plan = (commands.data?.commands ?? []).find((command) => command.name === "plan");
    record("/plan is a discoverable extension command", plan?.source === "extension");

    const on = await pi.send({ type: "prompt", message: "/plan on" });
    record("/plan on is handled without a run", on.success === true && on.data?.disposition === "handled");
    const appended = await pi.waitForEvent(
      (event) => event.type === "entry_appended" && event.entry?.customType === MODE_ENTRY,
    );
    record("/plan on emits entry_appended { active: true }", appended.entry?.data?.active === true);
    record("get_entries carries the plan entry", pi.planEntries(await pi.send({ type: "get_entries" })).length === 1);

    const onNotice = await pi.waitForEvent(
      (event) => event.type === "message_end" && event.message?.customType === "dsh-plan-notice",
    );
    record(
      "/plan on shows the switch notice",
      onNotice.message?.content === "The user switched this session to plan mode.",
      JSON.stringify(onNotice.message?.content).slice(0, 60),
    );

    await pi.send({ type: "prompt", message: "/plan on" });
    record("a repeated /plan on is a no-op", pi.planEntries(await pi.send({ type: "get_entries" })).length === 1);

    const off = await pi.send({ type: "prompt", message: "/plan off" });
    record("/plan off is handled", off.success === true && off.data?.disposition === "handled");
    await pi.waitForEvent(
      (event) =>
        event.type === "entry_appended" &&
        event.entry?.customType === MODE_ENTRY &&
        event.entry?.data?.active === false,
    );
    const afterOff = pi.planEntries(await pi.send({ type: "get_entries" }));
    record("the branch folds to inactive", afterOff.length === 2 && afterOff[1].data?.active === false);

    const offNotice = await pi.waitForEvent(
      (event) =>
        event.type === "message_end" &&
        event.message?.customType === "dsh-plan-notice" &&
        event.message?.content === "The user switched this session back to the default mode.",
    );
    record("/plan off shows the withdrawal notice", offNotice.message?.content !== undefined);

    // Bare `/plan` blocks on the picker. Answer it and check the entry appears.
    const picker = pi.send({ type: "prompt", message: "/plan" });
    const request = await pi.waitForEvent(
      (event) => event.type === "extension_ui_request" && event.method === "select",
    );
    record(
      "bare /plan opens a picker with on and off",
      Array.isArray(request.options) && request.options.some((o) => o.startsWith("on")) && request.options.some((o) => o.startsWith("off")),
    );
    pi.respond(request.id, request.options.find((option) => option.startsWith("on")));
    record("the picker prompt resolves after an answer", (await picker).success === true);
    const afterPicker = pi.planEntries(await pi.send({ type: "get_entries" }));
    record("picking on applies plan mode", afterPicker.length === 3 && afterPicker[2].data?.active === true);
  } finally {
    pi.close();
  }
}

/** Scenario B: `--plan` enters at session start; `/plan off` clears it. */
async function flagSession() {
  const pi = startPi(["--plan"]);
  try {
    await pi.send({ type: "get_state" });
    const initial = pi.planEntries(await pi.send({ type: "get_entries" }));
    record(
      "--plan enters plan mode at session start",
      initial.length === 1 && initial[0].data?.active === true,
      `count=${initial.length}`,
    );

    await pi.send({ type: "prompt", message: "/plan on" });
    record("--plan plus /plan on is a no-op", pi.planEntries(await pi.send({ type: "get_entries" })).length === 1);

    await pi.send({ type: "prompt", message: "/plan off" });
    const afterOff = pi.planEntries(await pi.send({ type: "get_entries" }));
    record(
      "/plan off clears the --plan entry",
      afterOff.length === 2 && afterOff[1].data?.active === false,
    );
  } finally {
    pi.close();
  }
}

/** Scenario C: a session fixture with one `exit_plan_mode` call exports the real preview. */
async function previewExport() {
  const dir = mkdtempSync(join(tmpdir(), "pi-dsh-plan-e2e-"));
  try {
    const sessionFile = join(dir, "preview.jsonl");
    writeSessionFixture(sessionFile);
    const pi = startPi([], { session: sessionFile });
    try {
      const state = await pi.send({ type: "get_state" });
      record("the preview session fixture loads", state.success === true);

      const outputPath = join(dir, "preview.html");
      const exported = await pi.send({ type: "export_html", outputPath });
      record(
        "export_html writes the session",
        exported.success === true && exported.data?.path === outputPath,
        exported.error ?? "",
      );

      const callHtml = renderedCallHtml(readFileSync(outputPath, "utf8"), "call_plan_fixture");
      record(
        "the exported preview renders the tool title and plan heading",
        callHtml.includes("exit_plan_mode") && callHtml.includes("Preview export fixture"),
      );
      record(
        "the exported preview shows the collapsed excerpt and expand hint",
        callHtml.includes("Intro line one.") && /\(\d+ more lines/.test(callHtml) && callHtml.includes("to expand"),
      );
      record("the exported preview starts collapsed", !callHtml.includes("step 12"));
    } finally {
      pi.close();
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
}

/** The fixture plan: a heading, an intro, and enough steps to overflow the excerpt. */
const PREVIEW_PLAN = [
  "# Preview export fixture",
  "",
  "Intro line one.",
  "",
  ...Array.from({ length: 12 }, (_, index) => `${index + 1}. step ${index + 1}`),
].join("\n");

/** Write a minimal v3 session holding one `exit_plan_mode` call and its result. */
function writeSessionFixture(path) {
  const now = Date.now();
  const iso = (offset) => new Date(now + offset).toISOString();
  const lines = [
    { type: "session", version: 3, id: "01abcdef-0000-7000-8000-000000000001", timestamp: iso(0), cwd: process.cwd() },
    { type: "message", id: "a0000001", parentId: null, timestamp: iso(1), message: { role: "user", content: "Present the plan.", timestamp: now + 1 } },
    {
      type: "message",
      id: "a0000002",
      parentId: "a0000001",
      timestamp: iso(2),
      message: {
        role: "assistant",
        content: [{ type: "toolCall", id: "call_plan_fixture", name: "exit_plan_mode", arguments: { plan: PREVIEW_PLAN } }],
        api: "openai-completions",
        provider: "fixture",
        model: "fixture",
        usage: { input: 1, output: 1, totalTokens: 2 },
        stopReason: "toolUse",
        timestamp: now + 2,
      },
    },
    {
      type: "message",
      id: "a0000003",
      parentId: "a0000002",
      timestamp: iso(3),
      message: {
        role: "toolResult",
        toolCallId: "call_plan_fixture",
        toolName: "exit_plan_mode",
        content: [{ type: "text", text: "Plan approved: plan mode exited; carry out the plan starting with your next step." }],
        isError: false,
        timestamp: now + 3,
      },
    },
  ];
  writeFileSync(path, `${lines.map((line) => JSON.stringify(line)).join("\n")}\n`);
}

/** Decode the export's embedded session data and return one pre-rendered call. */
function renderedCallHtml(html, toolCallId) {
  const base64 = /<script id="session-data" type="application\/json">([^<]+)<\/script>/.exec(html)?.[1];
  if (base64 === undefined) return "";
  const data = JSON.parse(Buffer.from(base64, "base64").toString("utf8"));
  return data.renderedTools?.[toolCallId]?.callHtml ?? "";
}

try {
  await freshSession();
  await flagSession();
  await previewExport();
} catch (error) {
  record("unexpected failure", false, String(error));
}

for (const [status, name, detail] of rows) {
  console.log(`${status}  ${name}${detail === "" ? "" : `  (${detail})`}`);
}
if (rows.some(([status]) => status === "FAIL")) process.exit(1);
