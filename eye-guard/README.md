# Health Guard — Eye Protection for VS Code 👁

[Tiếng Việt](README.vi.md) | **English**

A small, lightweight extension that reminds you to:

- **20-20-20** — every 20 minutes, look at something about 6 m (20 feet) away for 20 seconds, with a **per-second countdown**.
- **Drink water** — reminds you to hydrate at a configurable interval (default 45 minutes).
- **Stand up & walk** — reminds you to move around or take a bathroom break (default 90 minutes).

The reminder panel defaults to a **minimal design that follows your VS Code theme** (works in both light and dark mode). If you prefer, set `healthGuard.appearance` to `pixel` to see an animated pixel-art scene rendered with [pixelfx](https://github.com/patch-gg/pixelfx) (MIT).

Everything is configurable in **Settings**, and each reminder type can be toggled independently.

It also **checks GitHub Releases for updates** (at most once every 24 hours) and can install a new `.vsix` in-place — see `healthGuard.checkUpdates` and the `Health Guard: Kiểm tra cập nhật` command.

---

## Installation

### Option 1: Install from `.vsix` (fastest)

```bash
code --install-extension health-guard-1.1.1.vsix
```

Or open VS Code → **Extensions** → `…` → **Install from VSIX…** → pick the file.
The latest vsix is attached to each [GitHub Release](https://github.com/mquand/health-guard/releases).

### Option 2: Run from source

```bash
cd health-guard
npm install
npm run build
```

Open this folder in VS Code and press **F5** (Run Extension) to open a test window.

---

## Daily use

Once installed, the extension runs automatically when VS Code starts. In the **status bar** (bottom-left) you'll see the next upcoming reminder, e.g.:

```
👁 Nghỉ mắt · 12:34
```

Click it to open the quick menu:

| Item | Action |
| --- | --- |
| Nghỉ mắt ngay | Opens the 20-20-20 panel with countdown |
| Nhắc uống nước ngay | Opens the water panel |
| Nhắc đi bộ / đi vệ sinh | Opens the movement panel |
| Tạm dừng 30 phút / đến khi bật lại | Pause reminders for meetings, presentations… |
| Cài đặt Health Guard | Opens filtered Settings |
| Kiểm tra cập nhật | Manually check GitHub Releases for a new version |
| Xem thử hiệu ứng pixel art | Preview all 21 effects (always in pixel mode) |

On the reminder panel you can:

- **Đã nghỉ xong / Đã uống nước / Đã đi bộ** — confirm and close.
- **Nhắc lại sau N phút** — snooze this one (N is configurable, default 5).
- **⛭ Settings gear** — opens a full settings drawer right inside the panel: toggle each reminder, change intervals, pick pixel effects, appearance, sounds — no need to open the Settings tab. **Mở Settings đầy đủ** at the bottom still jumps to native Settings.
- **Tạm dừng** — the two-bar icon at the top right pauses all reminders for 30 minutes.
- **Esc** — close the panel.

---

## Appearance

- **`clean` (default)** — a small reminder card using your VS Code theme colors, thin-stroke SVG icons for eye / water drop / walker. The eye break shows a large seconds counter and a slim progress bar.
- **`pixel`** — a 160×120 animated pixel-art scene with 21 pixelfx effects, gradient background + stars + drifting light motes. Enable via `healthGuard.appearance` in Settings; the **Xem thử hiệu ứng** command always opens in this mode.

---

## Settings (Settings → search `healthGuard`)

| Key | Default | Meaning |
| --- | --- | --- |
| `healthGuard.enabled` | `true` | Master on/off switch |
| `healthGuard.startPaused` | `false` | Start paused every time VS Code launches |
| `healthGuard.onlyWhenFocused` | `true` | Only remind while the VS Code window is focused |
| `healthGuard.sound` | `true` | Soft chime on open/complete (synthesized with WebAudio) |
| `healthGuard.focusOnReminder` | `true` | Auto-focus the reminder panel |
| `healthGuard.appearance` | `clean` | `clean` (minimal, theme-native) or `pixel` (pixelfx pixel art) |
| `healthGuard.popupStyle` | `panel` | `panel` (reminder panel) or `notification` (small toast) for water/walk |
| `healthGuard.snoozeMinutes` | `5` | Minutes for "Nhắc lại sau …" |
| `healthGuard.checkUpdates` | `true` | Auto-check GitHub Releases (max once per 24 h); manual check via command |
| `healthGuard.eyeBreak.enabled` | `true` | Enable 20-20-20 reminders |
| `healthGuard.eyeBreak.intervalMinutes` | `20` | Minutes between eye breaks |
| `healthGuard.eyeBreak.durationSeconds` | `20` | Countdown seconds per break |
| `healthGuard.eyeBreak.effect` | `eyeball` | `eyeball` / `halo` / `heal` / `fish-school` / `jellyfish` / `sleep` (pixel mode only) |
| `healthGuard.eyeBreak.message` | … | Reminder text shown on the panel |
| `healthGuard.water.enabled` | `true` | Enable water reminders |
| `healthGuard.water.intervalMinutes` | `45` | Minutes between reminders |
| `healthGuard.water.effect` | `water-orb` | `fountain` / `potion` / `water-orb` / `bubbles` / `waterfall` / `drip` / `rain-splash` (pixel mode only) |
| `healthGuard.water.message` | … | Water reminder text |
| `healthGuard.walk.enabled` | `true` | Enable walk/stretch reminders |
| `healthGuard.walk.intervalMinutes` | `90` | Minutes between reminders |
| `healthGuard.walk.effect` | `bird` | `frog` / `bird` / `butterfly` / `snake` / `slime` / `wisp` / `falling-leaves` / `healing-bloom` (pixel mode only) |
| `healthGuard.walk.message` | … | Walk reminder text |

Changes take effect immediately — no VS Code restart needed.

---

## Commands (Command Palette — `Ctrl/Cmd+Shift+P`)

Search for "Health Guard":

- `Health Guard: Menu`
- `Health Guard: Bắt đầu nghỉ mắt 20-20-20`
- `Health Guard: Nhắc uống nước ngay`
- `Health Guard: Nhắc đi bộ / đi vệ sinh`
- `Health Guard: Tạm dừng nhắc nhở` / `Tiếp tục nhắc nhở`
- `Health Guard: Bật / tắt Health Guard`
- `Health Guard: Mở cài đặt`
- `Health Guard: Xem thử hiệu ứng`
- `Health Guard: Kiểm tra cập nhật`

---

## How it works

```
src/extension.ts     lifecycle, commands, status bar, orchestration
src/updater.ts       GitHub Releases check + in-place .vsix install
src/scheduler.ts     1-second scheduler, pause/snooze, only fires while focused
src/panel.ts         webview panel + HTML/CSP, ready → init handshake
src/webview/main.js  panel DOM, countdown, buttons, WebAudio chime
src/webview/renderer.js  160×120 pixel scene (only loaded when appearance = pixel)
vendor/pixelfx/      trimmed pixelfx copy (core + 21 effects), MIT licensed
```

- The countdown runs on `setInterval`, independent of animation, so a break still ends on time even when the tab is hidden.
- If you leave the machine (VS Code window loses focus) and `onlyWhenFocused` is on, the reminder is postponed by 30 seconds instead of being dropped or stacked.
- The pause state is persisted via `globalState`, so it survives VS Code restarts.
- No data leaves your machine. No account, no telemetry.

## Development

```bash
npm install
npm run build      # dist/extension.js + media/webview.js
npm run watch      # rebuild on change
npm run typecheck  # tsc --noEmit
npm run smoke      # render every effect in Node (no VS Code needed)
npm run preview    # export PNGs into preview/ to inspect effects
npm run package    # build health-guard-<version>.vsix
```

Pushing to `main` (or a `v*` tag) triggers `.github/workflows/release.yml`, which builds the vsix and publishes a GitHub Release automatically — that's what the built-in updater checks.

## License & credits

- Extension code: MIT (see `LICENSE`).
- Pixel-art effects: [patch-gg/pixelfx](https://github.com/patch-gg/pixelfx), MIT.
  A trimmed copy lives in `vendor/pixelfx` with the original `LICENSE` and `NOTICE.md`.
  Some pixelfx effects are adapted from MIT-licensed works by Hugo Duprez and Hollow Crown —
  see `vendor/pixelfx/NOTICE.md`.
