import * as vscode from "vscode";
import type { EyeGuardConfig, ReminderKind } from "./config";

export interface ReminderPayload {
  kind: ReminderKind;
  title: string;
  subtitle: string;
  tip: string;
  footer: string;
  badge: string;
  /** "clean" is the default minimal card; "pixel" opts into the pixelfx scene. */
  appearance: "clean" | "pixel";
  effect: string;
  /** 0 hides the countdown (used by the preview command). */
  durationMs: number;
  /** 0 hides the snooze button. */
  snoozeMinutes: number;
  actionLabel: string;
  doneTitle: string;
  doneSubtitle: string;
  sound: boolean;
  /** Global pause state at open time, so the pause button shows the right icon. */
  paused: boolean;
  /** Full healthGuard configuration for the built-in settings drawer. */
  settings: EyeGuardConfig;
  seed: number;
  preview: boolean;
}

export interface PanelHandlers {
  onDone(kind: ReminderKind): void;
  onSnooze(kind: ReminderKind, minutes: number): void;
  onPause(): void;
  onOpenSettings(): void;
  onConfig?(path: string, value: unknown): void;
  onClose?(kind: ReminderKind): void;
}

interface WebviewMessage {
  type?: string;
  minutes?: number;
  path?: string;
  value?: unknown;
  settings?: EyeGuardConfig;
}

/**
 * One reusable webview panel for reminders. The default look is a small, theme-native card; the optional
 * pixel-art scene comes from pixelfx (bundled into media/webview.js). The webview runs its own countdown
 * from `durationMs` and reports back when it ends.
 */
export class ReminderPanel {
  private static current: ReminderPanel | undefined;

  private readonly disposables: vscode.Disposable[] = [];
  private ready = false;
  private disposed = false;
  private payload: ReminderPayload;
  private handlers: PanelHandlers;

  static show(
    extensionUri: vscode.Uri,
    payload: ReminderPayload,
    handlers: PanelHandlers,
    preserveFocus: boolean
  ): ReminderPanel {
    const existing = ReminderPanel.current;
    if (existing && !existing.disposed) {
      existing.payload = payload;
      existing.handlers = handlers;
      existing.panel.title = payload.title;
      existing.panel.reveal(vscode.ViewColumn.Active, preserveFocus);
      existing.post();
      return existing;
    }

    const panel = vscode.window.createWebviewPanel(
      "healthGuard.reminder",
      payload.title,
      { viewColumn: vscode.ViewColumn.Active, preserveFocus },
      {
        enableScripts: true,
        retainContextWhenHidden: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, "media")],
      }
    );
    return (ReminderPanel.current = new ReminderPanel(panel, extensionUri, payload, handlers));
  }

  static get isOpen(): boolean {
    return !!ReminderPanel.current;
  }

  static close(): void {
    ReminderPanel.current?.panel.dispose();
  }

  static postPaused(paused: boolean): void {
    void ReminderPanel.current?.panel.webview.postMessage({ type: "paused", paused });
  }

  /** Push a fresh config snapshot so the settings drawer reflects clamped/saved values. */
  static postSettings(settings: EyeGuardConfig): void {
    void ReminderPanel.current?.panel.webview.postMessage({ type: "config", settings });
  }

  private constructor(
    private readonly panel: vscode.WebviewPanel,
    extensionUri: vscode.Uri,
    payload: ReminderPayload,
    handlers: PanelHandlers
  ) {
    this.payload = payload;
    this.handlers = handlers;

    panel.iconPath = vscode.Uri.joinPath(extensionUri, "media", "eye.svg");
    panel.webview.html = renderHtml(panel.webview, extensionUri);

    panel.webview.onDidReceiveMessage(
      (message: WebviewMessage) => this.onMessage(message),
      undefined,
      this.disposables
    );
    panel.onDidDispose(() => this.onDisposed(), undefined, this.disposables);
  }

  private onMessage(message: WebviewMessage): void {
    switch (message?.type) {
      case "ready":
        this.ready = true;
        this.post();
        break;
      case "done":
        this.handlers.onDone(this.payload.kind);
        break;
      case "snooze":
        this.handlers.onSnooze(this.payload.kind, this.payload.snoozeMinutes);
        break;
      case "pause":
        this.handlers.onPause();
        break;
      case "settings":
        this.handlers.onOpenSettings();
        break;
      case "setConfig":
        if (typeof message.path === "string") {
          this.handlers.onConfig?.(message.path, message.value);
        }
        break;
      case "close":
        this.panel.dispose();
        break;
    }
  }

  private post(): void {
    if (!this.ready) return;
    void this.panel.webview.postMessage({ type: "init", payload: this.payload });
  }

  private onDisposed(): void {
    this.disposed = true;
    if (ReminderPanel.current === this) ReminderPanel.current = undefined;
    for (const disposable of this.disposables) disposable.dispose();
    this.handlers.onClose?.(this.payload.kind);
  }
}

function renderHtml(webview: vscode.Webview, extensionUri: vscode.Uri): string {
  const media = (file: string) =>
    webview.asWebviewUri(vscode.Uri.joinPath(extensionUri, "media", file)).toString();
  const csp = webview.cspSource;

  return /* html */ `<!DOCTYPE html>
<html lang="vi">
<head>
  <meta charset="UTF-8" />
  <meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${csp} data:; style-src ${csp}; script-src ${csp};" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="stylesheet" href="${media("panel.css")}" />
  <title>Health Guard</title>
</head>
<body data-kind="eye" data-state="running" data-appearance="clean">
  <main class="card">
    <header class="top">
      <span class="chip" aria-hidden="true">
        <svg class="i-eye" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M2.5 12s3.6-6.5 9.5-6.5S21.5 12 21.5 12 17.9 18.5 12 18.5 2.5 12 2.5 12Z"/><circle cx="12" cy="12" r="2.8"/></svg>
        <svg class="i-water" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M12 3.2 7.6 8a6.2 6.2 0 1 0 8.8 0L12 3.2Z"/></svg>
        <svg class="i-walk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="5" r="1.5"/><path d="m9 20 3-6 3 6"/><path d="m6 8 6 2 6-2"/><path d="M12 10v4"/></svg>
      </span>
      <div class="heading">
        <span class="badge" id="badge">20 · 20 · 20</span>
        <h1 id="title">Nghỉ mắt 20-20-20</h1>
      </div>
      <div class="top-actions">
        <button class="icon-btn" id="btn-pause" title="Tạm dừng tất cả nhắc nhở" aria-label="Tạm dừng tất cả nhắc nhở">
          <svg class="i-pause" viewBox="0 0 24 24" fill="currentColor"><rect x="7" y="5" width="3.5" height="14" rx="1"/><rect x="13.5" y="5" width="3.5" height="14" rx="1"/></svg>
          <svg class="i-play" viewBox="0 0 24 24" fill="currentColor"><path d="M9 6.5v11l9-5.5-9-5.5Z"/></svg>
        </button>
        <button class="icon-btn" id="btn-settings" title="Cài đặt nhanh" aria-label="Cài đặt nhanh">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"><path d="M4 6h6M14 6h6M4 12h10M18 12h2M4 18h4M12 18h8"/><circle cx="12" cy="6" r="2"/><circle cx="16" cy="12" r="2"/><circle cx="10" cy="18" r="2"/></svg>
        </button>
      </div>
    </header>

    <p class="sub" id="subtitle"></p>

    <div class="stage">
      <canvas id="fx" width="240" height="160" aria-hidden="true"></canvas>
      <div class="scanlines" aria-hidden="true"></div>
    </div>

    <div class="countdown" id="countdown">
      <div class="clock" aria-live="polite"><span id="secs">20</span><span class="unit">giây</span></div>
      <div class="bar" role="progressbar" aria-label="Thời gian còn lại"><div class="fill" id="fill"></div></div>
    </div>

    <p class="tip" id="tip"></p>

    <div class="actions">
      <button class="btn ghost" id="btn-snooze">Nhắc lại sau 5 phút</button>
      <button class="btn primary" id="btn-done">Đã nghỉ xong</button>
    </div>

    <footer class="foot" id="foot"></footer>

    <section class="settings" id="settings" hidden>
      <div class="settings-scroll" id="settings-scroll"></div>
      <button class="btn ghost settings-full" id="btn-open-settings" type="button">
        Mở Settings đầy đủ
      </button>
    </section>
  </main>
  <script src="${media("webview.js")}"></script>
</body>
</html>`;
}
