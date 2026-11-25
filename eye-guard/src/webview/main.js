// Webview entry: wires the panel DOM and the countdown. The pixel-art scene is only created when the
// payload asks for the "pixel" appearance.
// Messages: in { type: "init", payload } / { type: "paused", paused }; out: ready, done, snooze,
// pause, settings, close.

import { Scene } from "./renderer.js";

const vscode = typeof acquireVsCodeApi === "function" ? acquireVsCodeApi() : null;
const post = (message) => {
  try {
    vscode?.postMessage(message);
  } catch {
    /* the panel can be disposed while a frame is in flight */
  }
};
const $ = (id) => document.getElementById(id);

const el = {
  badge: $("badge"),
  title: $("title"),
  subtitle: $("subtitle"),
  tip: $("tip"),
  secs: $("secs"),
  fill: $("fill"),
  countdown: $("countdown"),
  done: $("btn-done"),
  snooze: $("btn-snooze"),
  pause: $("btn-pause"),
  settings: $("btn-settings"),
  foot: $("foot"),
  canvas: $("fx"),
};

const ctx = el.canvas.getContext("2d", { alpha: false });

let scene = null;
let imageData = null;
let payload = null;
let durationMs = 0;
let endsAt = 0;
let finished = false;
let rafId = 0;
let clockId = 0;
let lastFrame = 0;
let acc = 0;
let lastSecs = -1;
let lastWidth = -1;
let audio = null;

window.addEventListener("message", (event) => {
  const message = event.data;
  if (!message || typeof message !== "object") return;
  if (message.type === "init") init(message.payload);
  if (message.type === "paused") setPaused(message.paused);
});

function setPaused(paused) {
  el.pause.classList.toggle("paused", !!paused);
  el.pause.title = paused ? "Tiếp tục nhắc nhở" : "Tạm dừng tất cả nhắc nhở";
  el.pause.setAttribute("aria-label", el.pause.title);
}

function init(next) {
  payload = next;
  finished = false;
  lastSecs = -1;
  lastWidth = -1;
  durationMs = Math.max(0, next.durationMs || 0);
  endsAt = performance.now() + durationMs;

  const pixel = next.appearance === "pixel";

  document.body.dataset.kind = next.kind;
  document.body.dataset.state = "running";
  document.body.dataset.appearance = pixel ? "pixel" : "clean";

  el.badge.textContent = next.badge;
  el.title.textContent = next.title;
  el.subtitle.textContent = next.subtitle;
  el.tip.textContent = next.tip;
  el.foot.textContent = next.footer;
  el.done.textContent = next.actionLabel;
  el.done.disabled = false;
  setPaused(!!next.paused);

  el.snooze.hidden = !next.snoozeMinutes;
  el.snooze.disabled = false;
  if (next.snoozeMinutes) el.snooze.textContent = `Nhắc lại sau ${next.snoozeMinutes} phút`;

  el.countdown.hidden = durationMs <= 0;
  if (durationMs > 0) {
    el.secs.textContent = String(Math.ceil(durationMs / 1000));
    el.fill.style.width = "100%";
  }

  stopLoop();
  if (pixel) {
    scene = new Scene({ kind: next.kind, effect: next.effect, seed: next.seed });
    el.canvas.width = scene.w;
    el.canvas.height = scene.h;
    ctx.imageSmoothingEnabled = false;
    imageData = new ImageData(scene.out, scene.w, scene.h);
    drawFrame();
    startLoop();
  } else {
    scene = null;
    imageData = null;
  }

  updateClock(performance.now());
  startClock();

  if (next.sound) chime(false);
}

// The countdown runs on a timer, not on requestAnimationFrame: a background panel stops painting but the
// break still has to finish (and report back) on time.
function startClock() {
  if (clockId) clearInterval(clockId);
  clockId = setInterval(() => updateClock(performance.now()), 200);
}

function stopClock() {
  if (clockId) clearInterval(clockId);
  clockId = 0;
}

function startLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  lastFrame = performance.now();
  acc = 0;
  rafId = requestAnimationFrame(loop);
}

function stopLoop() {
  if (rafId) cancelAnimationFrame(rafId);
  rafId = 0;
  scene = null;
  imageData = null;
}

function loop(now) {
  rafId = requestAnimationFrame(loop);
  if (!scene) return;

  const dt = Math.min(0.1, Math.max(0, (now - lastFrame) / 1000));
  lastFrame = now;
  acc += dt;
  if (acc >= 1 / 30) {
    scene.update(acc);
    acc = 0;
    drawFrame();
  }
}

function drawFrame() {
  if (!scene || !imageData) return;
  scene.draw();
  ctx.putImageData(imageData, 0, 0);
}

function updateClock(now) {
  if (!durationMs) return;

  const remaining = Math.max(0, endsAt - now);
  const secs = Math.ceil(remaining / 1000);
  if (secs !== lastSecs) {
    lastSecs = secs;
    el.secs.textContent = String(secs);
  }

  const width = Math.round((remaining / durationMs) * 200) / 2;
  if (width !== lastWidth) {
    lastWidth = width;
    el.fill.style.width = `${width}%`;
  }

  if (remaining <= 0 && !finished) finish();
}

function finish() {
  finished = true;
  stopClock();
  document.body.dataset.state = "done";
  el.title.textContent = payload?.doneTitle || "Xong!";
  el.subtitle.textContent = payload?.doneSubtitle || "";
  el.tip.textContent = "Bấm Đóng để quay lại công việc.";
  el.countdown.hidden = true;
  el.snooze.hidden = true;
  el.done.textContent = "Đóng";
  if (payload?.sound) chime(true);
  post({ type: "done" });
}

el.done.addEventListener("click", () => {
  if (finished || payload?.preview) {
    post({ type: "close" });
    return;
  }
  finish();
});

el.snooze.addEventListener("click", () => {
  stopClock();
  post({ type: "snooze", minutes: payload?.snoozeMinutes || 0 });
  document.body.dataset.state = "snoozed";
  el.title.textContent = "Đã hoãn nhắc nhở";
  el.subtitle.textContent = `Eye Guard sẽ nhắc lại sau ${payload?.snoozeMinutes || 0} phút.`;
  el.countdown.hidden = true;
  el.done.disabled = true;
  el.snooze.disabled = true;
});

el.pause.addEventListener("click", () => post({ type: "pause" }));
el.settings.addEventListener("click", () => post({ type: "settings" }));

window.addEventListener("keydown", (event) => {
  if (event.key === "Escape") post({ type: "close" });
});

// A soft two/three-note chime, synthesised so the extension ships no audio files.
function chime(done) {
  try {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    audio ??= new AudioCtor();
    if (audio.state === "suspended") void audio.resume();
    const now = audio.currentTime;
    const notes = done ? [523.25, 659.25, 783.99] : [659.25, 987.77];
    notes.forEach((frequency, index) => {
      const osc = audio.createOscillator();
      const gain = audio.createGain();
      const start = now + index * 0.13;
      osc.type = "triangle";
      osc.frequency.value = frequency;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.06, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.6);
      osc.connect(gain).connect(audio.destination);
      osc.start(start);
      osc.stop(start + 0.65);
    });
  } catch {
    /* audio is a nicety, never a requirement */
  }
}

post({ type: "ready" });
