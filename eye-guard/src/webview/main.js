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
  gear: $("btn-settings"),
  foot: $("foot"),
  canvas: $("fx"),
  settings: $("settings"),
  settingsScroll: $("settings-scroll"),
  openSettingsFull: $("btn-open-settings"),
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
  if (message.type === "config") applySettings(message.settings);
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

  applySettings(next.settings);

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
  el.subtitle.textContent = `Health Guard sẽ nhắc lại sau ${payload?.snoozeMinutes || 0} phút.`;
  el.countdown.hidden = true;
  el.done.disabled = true;
  el.snooze.disabled = true;
});

el.pause.addEventListener("click", () => post({ type: "pause" }));
el.gear.addEventListener("click", () => {
  const open = el.settings.hidden;
  el.settings.hidden = !open;
  el.settings.classList.toggle("open", open);
  el.gear.setAttribute("aria-expanded", String(open));
});
el.openSettingsFull?.addEventListener("click", () => post({ type: "settings" }));

// ---- settings drawer: the full healthGuard config, editable without leaving the panel ----

const EFFECT_OPTIONS = {
  eye: [
    ["eyeball", "Nhãn cầu"],
    ["halo", "Hào quang"],
    ["heal", "Chữa lành"],
    ["fish-school", "Đàn cá"],
    ["jellyfish", "Sứa"],
    ["sleep", "Ngủ say"],
  ],
  water: [
    ["fountain", "Đài phun nước"],
    ["potion", "Bình thuốc"],
    ["water-orb", "Quả cầu nước"],
    ["bubbles", "Bọt khí"],
    ["waterfall", "Thác nước"],
    ["drip", "Giọt nước"],
    ["rain-splash", "Mưa rơi"],
  ],
  walk: [
    ["frog", "Ếch nhảy"],
    ["bird", "Chim sẻ"],
    ["butterfly", "Bướm"],
    ["snake", "Rắn trườn"],
    ["slime", "Slime nhảy"],
    ["wisp", "Đom lửa"],
    ["falling-leaves", "Lá rơi"],
    ["healing-bloom", "Hoa nở"],
  ],
};

const SETTINGS_SCHEMA = [
  {
    group: "Chung",
    items: [
      { path: "enabled", label: "Bật Health Guard", type: "bool" },
      { path: "startPaused", label: "Khởi động ở trạng thái tạm dừng", type: "bool" },
      { path: "onlyWhenFocused", label: "Chỉ nhắc khi cửa sổ đang focus", type: "bool" },
      { path: "sound", label: "Chuông nhẹ khi mở / kết thúc", type: "bool" },
      { path: "focusOnReminder", label: "Tự focus bảng nhắc nhở", type: "bool" },
      {
        path: "appearance",
        label: "Giao diện bảng nhắc",
        type: "select",
        options: [
          ["clean", "Tối giản (theo theme)"],
          ["pixel", "Pixel art"],
        ],
      },
      {
        path: "popupStyle",
        label: "Kiểu nhắc nước / đi bộ",
        type: "select",
        options: [
          ["panel", "Bảng nhắc nhở"],
          ["notification", "Thông báo nhỏ"],
        ],
      },
      { path: "snoozeMinutes", label: "Hoãn nhắc lại (phút)", type: "number", min: 1, max: 120 },
      { path: "checkUpdates", label: "Tự kiểm tra cập nhật (tối đa 1 lần/24h)", type: "bool" },
    ],
  },
  {
    group: "Nghỉ mắt 20-20-20",
    items: [
      { path: "eyeBreak.enabled", label: "Bật nhắc nghỉ mắt", type: "bool" },
      { path: "eyeBreak.intervalMinutes", label: "Cứ mỗi (phút)", type: "number", min: 1, max: 480 },
      { path: "eyeBreak.durationSeconds", label: "Thời gian nghỉ (giây)", type: "number", min: 5, max: 300 },
      { path: "eyeBreak.effect", label: "Hiệu ứng pixel", type: "select", options: EFFECT_OPTIONS.eye },
      { path: "eyeBreak.message", label: "Lời nhắc", type: "text" },
    ],
  },
  {
    group: "Uống nước",
    items: [
      { path: "water.enabled", label: "Bật nhắc uống nước", type: "bool" },
      { path: "water.intervalMinutes", label: "Cứ mỗi (phút)", type: "number", min: 1, max: 480 },
      { path: "water.effect", label: "Hiệu ứng pixel", type: "select", options: EFFECT_OPTIONS.water },
      { path: "water.message", label: "Lời nhắc", type: "text" },
    ],
  },
  {
    group: "Đi bộ / vận động",
    items: [
      { path: "walk.enabled", label: "Bật nhắc đi bộ", type: "bool" },
      { path: "walk.intervalMinutes", label: "Cứ mỗi (phút)", type: "number", min: 1, max: 480 },
      { path: "walk.effect", label: "Hiệu ứng pixel", type: "select", options: EFFECT_OPTIONS.walk },
      { path: "walk.message", label: "Lời nhắc", type: "text" },
    ],
  },
];

const settingControls = new Map(); // path -> input element

function getPath(obj, path) {
  return path.split(".").reduce((o, k) => (o == null ? o : o[k]), obj);
}

function buildSettings() {
  if (!el.settingsScroll || el.settingsScroll.childElementCount) return;
  for (const group of SETTINGS_SCHEMA) {
    const section = document.createElement("section");
    section.className = "s-group";
    const title = document.createElement("h2");
    title.className = "s-group-title";
    title.textContent = group.group;
    section.appendChild(title);

    for (const item of group.items) {
      const row = document.createElement("label");
      row.className = "s-row";
      const caption = document.createElement("span");
      caption.className = "s-label";
      caption.textContent = item.label;
      row.appendChild(caption);

      let input;
      if (item.type === "bool") {
        input = document.createElement("input");
        input.type = "checkbox";
        input.className = "s-check";
      } else if (item.type === "select") {
        input = document.createElement("select");
        input.className = "s-input";
        for (const [value, label] of item.options) {
          const option = document.createElement("option");
          option.value = value;
          option.textContent = label;
          input.appendChild(option);
        }
      } else {
        input = document.createElement("input");
        input.type = item.type === "number" ? "number" : "text";
        input.className = "s-input";
        if (item.type === "number") {
          input.min = item.min;
          input.max = item.max;
        }
      }
      input.dataset.path = item.path;
      input.addEventListener("change", () => {
        const value =
          item.type === "bool"
            ? input.checked
            : item.type === "number"
              ? Number(input.value)
              : input.value;
        post({ type: "setConfig", path: item.path, value });
      });
      settingControls.set(item.path, input);
      row.appendChild(input);
      section.appendChild(row);
    }
    el.settingsScroll.appendChild(section);
  }
}

function applySettings(settings) {
  if (!settings) return;
  buildSettings();
  for (const [path, input] of settingControls) {
    const value = getPath(settings, path);
    if (value === undefined) continue;
    if (input.type === "checkbox") input.checked = !!value;
    else input.value = String(value);
  }
}

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
