// Extension-host smoke test: activate the real controller against a fake VS Code API, then walk through
// the panel handshake, snooze, notifications, pause/resume, config changes, preview and toggle.
import { build } from "esbuild";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const tmp = resolve(root, ".tmp", "extension.test.mjs");

await build({
  entryPoints: [resolve(root, "scripts/extension-entry.mjs")],
  outfile: tmp,
  bundle: true,
  format: "esm",
  platform: "node",
  alias: { vscode: resolve(root, "scripts/mocks/vscode.mjs") },
  logLevel: "silent",
});

const { ext, mock } = await import(pathToFileURL(tmp).href);
const { testState, testHelpers, Uri } = mock;

const failures = [];
const check = (label, ok, extra) => {
  if (!ok) failures.push(label + (extra ? ` — ${extra}` : ""));
  console.log(`${ok ? "ok  " : "FAIL"} ${label}${ok || !extra ? "" : ` — ${extra}`}`);
};

testHelpers.reset();

const stored = new Map();
const context = {
  subscriptions: [],
  extensionUri: Uri.file("/extension"),
  globalState: {
    get: (key) => stored.get(key),
    update: (key, value) => {
      stored.set(key, value);
      return Promise.resolve();
    },
  },
};

ext.activate(context);

check("registers the 9 commands", testState.commands.size === 9, [...testState.commands.keys()].join(","));
check("creates the status bar item", testState.statusItems.length === 1);
const status = testState.statusItems[0];
check("status bar shows the next eye break", status.text === "$(eye) Nghỉ mắt · 20:00", status.text);

// ---- the 20-20-20 panel
await mock.commands.executeCommand("eyeGuard.startEyeBreak");
check("opens a webview panel", testState.panels.length === 1);
const panel = testState.panels[0];
check("panel title", panel.title === "Nghỉ mắt 20-20-20", panel.title);
check(
  "html carries CSP + media",
  panel.webview.html.includes("Content-Security-Policy") &&
    panel.webview.html.includes("panel.css") &&
    panel.webview.html.includes("webview.js")
);
check("html has no undefined interpolations", !panel.webview.html.includes("undefined"));

panel.webview.receive({ type: "ready" });
const init = panel.webview.sent.at(-1);
check("handshake sends init", init?.type === "init");
check("init is an eye break", init?.payload.kind === "eye");
check("init counts 20 seconds", init?.payload.durationMs === 20000, String(init?.payload.durationMs));
check("init uses the eyeball effect", init?.payload.effect === "eyeball");
check("init defaults to the clean appearance", init?.payload.appearance === "clean");
check("init has a snooze button", init?.payload.snoozeMinutes === 5);

panel.webview.receive({ type: "snooze", minutes: 5 });
check("snooze closes the panel", panel.disposed === true);
check(
  "snooze leaves a status message",
  testState.statusMessages.some((m) => m.includes("5 phút")),
  testState.statusMessages.join(" | ")
);

// ---- water panel
await mock.commands.executeCommand("eyeGuard.remindWater");
const waterPanel = testState.panels.at(-1);
waterPanel.webview.receive({ type: "ready" });
const waterInit = waterPanel.webview.sent.at(-1);
check(
  "water panel has no countdown",
  waterInit?.payload.kind === "water" && waterInit?.payload.durationMs === 0
);
check("water uses the water orb", waterInit?.payload.effect === "water-orb");
waterPanel.webview.receive({ type: "done" });
check("water done closes the panel", waterPanel.disposed === true);

// ---- notification style
testHelpers.setConfig("eyeGuard.popupStyle", "notification");
await mock.commands.executeCommand("eyeGuard.remindWalk");
check(
  "notification style shows a message",
  testState.infoCalls.length === 1 && testState.infoCalls[0].message.includes("Đứng dậy"),
  JSON.stringify(testState.infoCalls)
);
check("notification style opens no panel", testState.panels.every((p) => p.disposed));

// ---- pause / resume
await mock.commands.executeCommand("eyeGuard.pause");
check("pause updates the status bar", status.text.includes("Tạm dừng"), status.text);
check("pause is persisted", stored.get("eyeGuard.pauseState")?.paused === true);
await mock.commands.executeCommand("eyeGuard.resume");
check("resume clears the pause", !status.text.includes("Tạm dừng"), status.text);

// ---- live config changes
testHelpers.setConfig("eyeGuard.walk.enabled", false);
check("disabled feature leaves the tooltip", !status.tooltip.includes("Đi bộ"), status.tooltip);

// ---- preview command
testState.quickPickQueue.push({
  label: "Bình thuốc",
  choice: { kind: "water", id: "potion", label: "Bình thuốc", description: "" },
});
await mock.commands.executeCommand("eyeGuard.previewEffect");
const previewPanel = testState.panels.at(-1);
previewPanel.webview.receive({ type: "ready" });
const previewInit = previewPanel.webview.sent.at(-1);
check(
  "preview payload is a preview of the chosen effect",
  previewInit?.payload.preview === true &&
    previewInit?.payload.effect === "potion" &&
    previewInit?.payload.durationMs === 0
);
check("preview always uses the pixel appearance", previewInit?.payload.appearance === "pixel");
previewPanel.webview.receive({ type: "done" });
check("preview done just closes", previewPanel.disposed === true);

// ---- master switch
await mock.commands.executeCommand("eyeGuard.toggle");
check("toggle writes the global setting", testState.config["eyeGuard.enabled"] === false);
check("status bar shows the disabled state", status.text.includes("đang tắt"), status.text);

// ---- cleanup
for (const disposable of context.subscriptions) disposable.dispose();
check("dispose removes the status bar", status.disposed === true);

if (failures.length) {
  console.error("\nFAILED:\n - " + failures.join("\n - "));
  process.exit(1);
}
console.log("\nExtension host flow looks good.");
