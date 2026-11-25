// Scheduler behaviour: due tasks fire once, unfocused windows postpone instead of dropping, pause/snooze work.
import { build } from "esbuild";
import { resolve } from "node:path";
import { pathToFileURL } from "node:url";

const root = resolve(import.meta.dirname, "..");
const tmp = resolve(root, ".tmp", "scheduler.mjs");

await build({
  entryPoints: [resolve(root, "src/scheduler.ts")],
  outfile: tmp,
  bundle: true,
  format: "esm",
  platform: "node",
  logLevel: "silent",
});

const { Scheduler } = await import(pathToFileURL(tmp).href);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const failures = [];
const check = (label, ok) => {
  if (!ok) failures.push(label);
  console.log(`${ok ? "ok  " : "FAIL"} ${label}`);
};

const fired = [];
let canFire = false;
const scheduler = new Scheduler(
  (kind) => fired.push(kind),
  () => canFire,
  () => {}
);

scheduler.configure("eye", 60_000);
scheduler.configure("water", 60_000);
scheduler.start();

// A due reminder while the window is unfocused must be postponed, not fired and not lost.
scheduler.get("eye").nextAt = Date.now() - 1;
await sleep(1300);
check("unfocused window postpones instead of firing", fired.length === 0);
check("postponed task is still scheduled soon", scheduler.get("eye").nextAt - Date.now() > 20_000);

// Focused: it fires exactly once and reschedules a full interval out.
canFire = true;
scheduler.get("eye").nextAt = Date.now() - 1;
await sleep(1300);
check("focused window fires the reminder", fired.join(",") === "eye");
check("next fire is a full interval away", scheduler.get("eye").nextAt - Date.now() > 55_000);

// Snooze pushes a task out by the requested time.
scheduler.snooze("water", 5);
check("snooze moves the task ~5 minutes out", scheduler.get("water").nextAt - Date.now() > 4.9 * 60_000);

// Manual trigger fires right away even if the task is far out.
fired.length = 0;
scheduler.triggerNow("water");
check("triggerNow fires immediately", fired.join(",") === "water");

// Pausing blocks reminders and resumes automatically when the pause expires.
fired.length = 0;
scheduler.pause(1 / 30); // ~2 seconds
scheduler.get("eye").nextAt = Date.now() - 1;
await sleep(1200);
check("paused scheduler does not fire", fired.length === 0);
await sleep(1600);
check("pause expires on its own", !scheduler.isPaused);

// Resume resets intervals so a long pause doesn't produce a burst.
scheduler.pause();
scheduler.resume(true);
check("resume clears the pause", !scheduler.isPaused);
check("resume resets every interval", scheduler.list().every((t) => t.nextAt - Date.now() > 55_000));

scheduler.dispose();

if (failures.length) {
  console.error("\nFAILED:\n - " + failures.join("\n - "));
  process.exit(1);
}
console.log("\nScheduler looks good.");
