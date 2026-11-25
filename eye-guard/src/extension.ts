import * as vscode from "vscode";
import {
  CONFIG_SECTION,
  type EyeGuardConfig,
  type ReminderKind,
  featureOf,
  onConfigChanged,
  readConfig,
} from "./config";
import { type PauseState, Scheduler } from "./scheduler";
import { ReminderPanel, type PanelHandlers, type ReminderPayload } from "./panel";

const PAUSE_STATE_KEY = "eyeGuard.pauseState";
const CLOSE_AFTER_DONE_MS = 2600;
const PAUSE_MENU_MINUTES = 30;

interface EffectChoice {
  kind: ReminderKind;
  id: string;
  label: string;
  description: string;
}

const EFFECT_CHOICES: EffectChoice[] = [
  { kind: "eye", id: "eyeball", label: "Nhãn cầu", description: "pixelfx · Eyeball — mắt pixel art đảo mắt, chớp mắt" },
  { kind: "eye", id: "halo", label: "Hào quang", description: "pixelfx · Halo — vòng sáng vàng trên đầu nhân vật" },
  { kind: "eye", id: "heal", label: "Chữa lành", description: "pixelfx · Heal — vòng sáng chữa lành, trái tim bay lên" },
  { kind: "water", id: "fountain", label: "Đài phun nước", description: "pixelfx · Fountain — đài phun nước pixel art" },
  { kind: "water", id: "potion", label: "Bình thuốc", description: "pixelfx · Potion — bình thuốc phát sáng, bong bóng nổi" },
  { kind: "water", id: "water-orb", label: "Quả cầu nước", description: "pixelfx · Water orb — quả cầu nước lơ lửng" },
  { kind: "walk", id: "frog", label: "Ếch nhảy", description: "pixelfx · Frog — chú ếch nhảy bắt ruồi" },
  { kind: "walk", id: "bird", label: "Chim sẻ", description: "pixelfx · Bird — chim sẻ vỗ cánh" },
  { kind: "walk", id: "butterfly", label: "Bướm", description: "pixelfx · Butterfly — bướm lượn lấp lánh" },
];

const KIND_LABEL: Record<ReminderKind, string> = {
  eye: "Nghỉ mắt",
  water: "Uống nước",
  walk: "Đi bộ",
};

const KIND_ICON: Record<ReminderKind, string> = {
  eye: "eye",
  water: "droplet",
  walk: "person",
};

interface MenuItem extends vscode.QuickPickItem {
  run?: () => unknown;
}

export function activate(context: vscode.ExtensionContext): void {
  const controller = new EyeGuardController(context);
  context.subscriptions.push(controller);
  controller.start();
}

export function deactivate(): void {
  // Nothing to do: the controller disposes its scheduler, status bar and timers.
}

class EyeGuardController implements vscode.Disposable {
  private config: EyeGuardConfig;
  private readonly scheduler: Scheduler;
  private readonly status: vscode.StatusBarItem;
  private closeTimer: ReturnType<typeof setTimeout> | undefined;
  private readonly disposables: vscode.Disposable[] = [];

  constructor(private readonly context: vscode.ExtensionContext) {
    this.config = readConfig();
    this.status = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Left, 100);
    this.status.name = "Eye Guard";
    this.status.command = "eyeGuard.menu";

    this.scheduler = new Scheduler(
      (kind) => this.onDue(kind),
      () => this.canFire(),
      () => this.updateStatusBar()
    );
  }

  start(): void {
    this.registerCommands();
    this.disposables.push(onConfigChanged(() => this.applyConfig(false)));
    this.applyConfig(true);

    this.scheduler.restorePause(this.context.globalState.get<PauseState>(PAUSE_STATE_KEY));
    if (this.config.startPaused) this.scheduler.pause();

    this.scheduler.start();
    this.status.show();
    this.updateStatusBar();
  }

  dispose(): void {
    if (this.closeTimer) clearTimeout(this.closeTimer);
    this.scheduler.dispose();
    this.status.dispose();
    for (const disposable of this.disposables) disposable.dispose();
    this.disposables.length = 0;
  }

  // ---- configuration

  private applyConfig(resetIntervals: boolean): void {
    this.config = readConfig();

    for (const kind of ["eye", "water", "walk"] as ReminderKind[]) {
      const feature = featureOf(this.config, kind);
      if (feature.enabled) {
        this.scheduler.configure(kind, feature.intervalMinutes * 60_000, resetIntervals);
      } else {
        this.scheduler.remove(kind);
      }
    }

    if (!this.config.enabled) ReminderPanel.close();
    ReminderPanel.postPaused(this.scheduler.isPaused);
    this.updateStatusBar();
  }

  private canFire(): boolean {
    if (!this.config.enabled) return false;
    if (ReminderPanel.isOpen) return false;
    if (this.config.onlyWhenFocused && !vscode.window.state.focused) return false;
    return true;
  }

  // ---- reminders

  private onDue(kind: ReminderKind): void {
    if (!this.config.enabled) return;
    const feature = featureOf(this.config, kind);
    if (!feature.enabled) return;

    if (kind === "eye" || this.config.popupStyle === "panel") {
      this.openPanel(this.payloadFor(kind));
    } else {
      void this.notify(kind);
    }
  }

  private openPanel(payload: ReminderPayload): void {
    if (this.closeTimer) {
      clearTimeout(this.closeTimer);
      this.closeTimer = undefined;
    }

    const handlers: PanelHandlers = {
      onDone: () => this.onPanelDone(payload),
      onSnooze: (_kind, minutes) => this.onPanelSnooze(payload, minutes),
      onPause: () => this.pause(PAUSE_MENU_MINUTES),
      onOpenSettings: () => this.openSettings(),
      onClose: () => this.updateStatusBar(),
    };

    ReminderPanel.show(
      this.context.extensionUri,
      payload,
      handlers,
      !this.config.focusOnReminder
    );
    this.updateStatusBar();
  }

  private onPanelDone(payload: ReminderPayload): void {
    if (payload.preview) {
      ReminderPanel.close();
      return;
    }

    if (payload.kind === "eye") {
      vscode.window.setStatusBarMessage("$(check) Mắt đã được nghỉ xong", 4000);
      // Leave the finished state on screen for a moment, then get out of the way.
      this.closeTimer = setTimeout(() => {
        this.closeTimer = undefined;
        ReminderPanel.close();
      }, CLOSE_AFTER_DONE_MS);
      return;
    }

    vscode.window.setStatusBarMessage(
      payload.kind === "water" ? "$(check) Đã uống nước" : "$(check) Đã vận động",
      4000
    );
    ReminderPanel.close();
  }

  private onPanelSnooze(payload: ReminderPayload, minutes: number): void {
    if (payload.preview) {
      ReminderPanel.close();
      return;
    }
    this.scheduler.snooze(payload.kind, minutes);
    ReminderPanel.close();
    vscode.window.setStatusBarMessage(`$(clock) Sẽ nhắc lại sau ${minutes} phút`, 4000);
  }

  private async notify(kind: ReminderKind): Promise<void> {
    const feature = featureOf(this.config, kind);
    const doneLabel = kind === "water" ? "Đã uống nước" : "Đã đi bộ";
    const snoozeLabel = `Nhắc lại sau ${this.config.snoozeMinutes} phút`;
    const openLabel = "Mở bảng nhắc nhở";
    const icon = kind === "water" ? "💧" : "🚶";

    const choice = await vscode.window.showInformationMessage(
      `${icon} ${feature.message}`,
      doneLabel,
      snoozeLabel,
      openLabel
    );

    if (choice === snoozeLabel) {
      this.scheduler.snooze(kind, this.config.snoozeMinutes);
      vscode.window.setStatusBarMessage(`$(clock) Sẽ nhắc lại sau ${this.config.snoozeMinutes} phút`, 4000);
    } else if (choice === openLabel) {
      this.openPanel(this.payloadFor(kind));
    } else if (choice === doneLabel) {
      vscode.window.setStatusBarMessage("$(check) Tuyệt vời!", 3000);
    }
  }

  private payloadFor(
    kind: ReminderKind,
    options: { preview?: boolean; effect?: string } = {}
  ): ReminderPayload {
    const config = this.config;
    const feature = featureOf(config, kind);
    const preview = !!options.preview;
    const effect = options.effect ?? feature.effect;

    const base = {
      kind,
      effect,
      preview,
      sound: config.sound,
      seed: Math.floor(Math.random() * 1000) + 1,
      appearance: config.appearance,
      footer: "Eye Guard · chỉnh thời gian, hiệu ứng và bật/tắt từng mục trong Settings",
      snoozeMinutes: preview ? 0 : config.snoozeMinutes,
      durationMs: 0,
    };

    if (preview) {
      const choice = EFFECT_CHOICES.find((c) => c.id === effect);
      return {
        ...base,
        // The preview command exists to show a pixelfx effect, whatever the normal appearance is.
        appearance: "pixel",
        title: "Xem thử hiệu ứng",
        subtitle: choice ? `${choice.label} — ${choice.description}` : effect,
        tip: "Đây chỉ là bản xem thử. Đóng tab này để quay lại công việc.",
        badge: "XEM THỬ",
        actionLabel: "Đóng",
        doneTitle: "Xem thử xong",
        doneSubtitle: "Chọn hiệu ứng khác trong Settings nếu bạn muốn.",
      };
    }

    if (kind === "eye") {
      return {
        ...base,
        title: "Nghỉ mắt 20-20-20",
        subtitle: feature.message,
        tip: "Thả lỏng vai, chớp mắt chậm và nhìn một vật ở xa khoảng 6 m. Đừng nhìn màn hình trong lúc đếm.",
        badge: "20 · 20 · 20",
        durationMs: config.eyeBreak.durationSeconds * 1000,
        actionLabel: "Đã nghỉ xong",
        doneTitle: "Mắt đã được nghỉ 💚",
        doneSubtitle: "Quay lại làm việc thôi. Hẹn gặp lại sau ít phút!",
      };
    }

    if (kind === "water") {
      return {
        ...base,
        title: "Uống nước",
        subtitle: feature.message,
        tip: "Đứng dậy lấy nước và uống từ từ 150–250 ml. Nước lọc là lựa chọn tốt nhất.",
        badge: "NƯỚC",
        actionLabel: "Đã uống nước",
        doneTitle: "Đã bổ sung nước 💧",
        doneSubtitle: "Cơ thể cảm ơn bạn đấy. Hẹn ly nước tiếp theo!",
      };
    }

    return {
      ...base,
      title: "Đứng dậy đi bộ",
      subtitle: feature.message,
      tip: "Đi lại 2–3 phút, vươn vai và nhìn ra xa. Tranh thủ đi vệ sinh nếu cần.",
      badge: "VẬN ĐỘNG",
      actionLabel: "Đã đi bộ",
      doneTitle: "Tuyệt! Cơ thể đã được vận động 🚶",
      doneSubtitle: "Vai, lưng và mắt đều dễ chịu hơn rồi.",
    };
  }

  // ---- pause / resume

  private pause(minutes?: number): void {
    this.scheduler.pause(minutes);
    void this.context.globalState.update(PAUSE_STATE_KEY, this.scheduler.pauseState);
    ReminderPanel.postPaused(true);
    ReminderPanel.close();
    const label = minutes ? `Tạm dừng ${minutes} phút` : "Đã tạm dừng nhắc nhở";
    vscode.window.setStatusBarMessage(`$(debug-pause) ${label}`, 4000);
    this.updateStatusBar();
  }

  private resume(): void {
    this.scheduler.resume(true);
    void this.context.globalState.update(PAUSE_STATE_KEY, this.scheduler.pauseState);
    ReminderPanel.postPaused(false);
    vscode.window.setStatusBarMessage("$(play) Đã tiếp tục nhắc nhở", 4000);
    this.updateStatusBar();
  }

  // ---- status bar

  private updateStatusBar(): void {
    const config = this.config;

    if (!config.enabled) {
      this.status.text = "$(circle-slash) Eye Guard: đang tắt";
      this.status.tooltip = "Eye Guard đang tắt. Bấm để mở menu và bật lại.";
      this.status.backgroundColor = undefined;
      return;
    }

    if (this.scheduler.isPaused) {
      const remaining = this.scheduler.pauseRemainingMs;
      this.status.text =
        remaining === Number.POSITIVE_INFINITY
          ? "$(debug-pause) Eye Guard: tạm dừng"
          : `$(debug-pause) Tạm dừng · ${formatClock(remaining)}`;
      this.status.tooltip = "Nhắc nhở đang tạm dừng. Bấm để tiếp tục hoặc mở cài đặt.";
      this.status.backgroundColor = new vscode.ThemeColor("statusBarItem.warningBackground");
      return;
    }

    this.status.backgroundColor = undefined;
    const next = this.scheduler.next();
    if (!next) {
      this.status.text = "$(eye) Eye Guard";
      this.status.tooltip = "Chưa bật chức năng nhắc nhở nào. Bấm để mở menu.";
      return;
    }

    const remaining = Math.max(0, next.nextAt - Date.now());
    this.status.text = `$(${KIND_ICON[next.kind]}) ${KIND_LABEL[next.kind]} · ${formatClock(remaining)}`;

    const lines = ["**Eye Guard**", ""];
    for (const kind of ["eye", "water", "walk"] as ReminderKind[]) {
      const feature = featureOf(config, kind);
      if (!feature.enabled) continue;
      const task = this.scheduler.get(kind);
      const when = task ? formatClock(Math.max(0, task.nextAt - Date.now())) : "—";
      const extra = kind === "eye" ? ` · nghỉ ${config.eyeBreak.durationSeconds}s` : "";
      lines.push(`- ${KIND_LABEL[kind]}: còn **${when}** (mỗi ${feature.intervalMinutes} phút${extra})`);
    }
    lines.push("", "Bấm để mở menu Eye Guard.");
    this.status.tooltip = lines.join("\n");
  }

  // ---- commands

  private registerCommands(): void {
    const register = (id: string, handler: (...args: unknown[]) => unknown) => {
      this.disposables.push(vscode.commands.registerCommand(id, handler));
    };

    register("eyeGuard.menu", () => this.showMenu());
    register("eyeGuard.startEyeBreak", () => this.trigger("eye"));
    register("eyeGuard.remindWater", () => this.trigger("water"));
    register("eyeGuard.remindWalk", () => this.trigger("walk"));
    register("eyeGuard.pause", () => this.pause(PAUSE_MENU_MINUTES));
    register("eyeGuard.resume", () => this.resume());
    register("eyeGuard.toggle", () => this.toggleEnabled());
    register("eyeGuard.openSettings", () => this.openSettings());
    register("eyeGuard.previewEffect", () => this.previewEffect());
  }

  private trigger(kind: ReminderKind): void {
    if (!this.config.enabled) {
      void vscode.window
        .showWarningMessage("Eye Guard đang tắt. Bật lên để dùng nhắc nhở.", "Bật Eye Guard")
        .then((choice) => {
          if (choice) void this.toggleEnabled();
        });
      return;
    }

    if (!featureOf(this.config, kind).enabled) {
      const key = `${kind === "eye" ? "eyeBreak" : kind}.enabled`;
      void vscode.window
        .showWarningMessage(`Chức năng “${KIND_LABEL[kind]}” đang tắt trong Settings.`, "Bật chức năng")
        .then((choice) => {
          if (choice) {
            void vscode.workspace
              .getConfiguration(CONFIG_SECTION)
              .update(key, true, vscode.ConfigurationTarget.Global);
          }
        });
      return;
    }

    const task = this.scheduler.get(kind);
    if (task) this.scheduler.triggerNow(kind);
    else this.onDue(kind);
  }

  private async toggleEnabled(): Promise<void> {
    const enabled = !this.config.enabled;
    await vscode.workspace
      .getConfiguration(CONFIG_SECTION)
      .update("enabled", enabled, vscode.ConfigurationTarget.Global);
    void vscode.window.showInformationMessage(
      enabled ? "Eye Guard đã bật. Nhắc nhở sẽ chạy theo cài đặt của bạn." : "Eye Guard đã tắt."
    );
  }

  private openSettings(): void {
    void vscode.commands.executeCommand("workbench.action.openSettings", "eyeGuard");
  }

  private async showMenu(): Promise<void> {
    const config = this.config;
    const paused = this.scheduler.isPaused;
    const items: MenuItem[] = [];

    if (config.enabled) {
      items.push(
        {
          label: "$(eye) Nghỉ mắt ngay",
          description: `mỗi ${config.eyeBreak.intervalMinutes} phút · nghỉ ${config.eyeBreak.durationSeconds}s`,
          run: () => this.trigger("eye"),
        },
        {
          label: "$(droplet) Nhắc uống nước ngay",
          description: `mỗi ${config.water.intervalMinutes} phút`,
          run: () => this.trigger("water"),
        },
        {
          label: "$(person) Nhắc đi bộ / đi vệ sinh",
          description: `mỗi ${config.walk.intervalMinutes} phút`,
          run: () => this.trigger("walk"),
        },
        { label: "Điều khiển", kind: vscode.QuickPickItemKind.Separator }
      );

      if (paused) {
        items.push({ label: "$(play) Tiếp tục nhắc nhở", run: () => this.resume() });
      } else {
        items.push(
          { label: `$(debug-pause) Tạm dừng ${PAUSE_MENU_MINUTES} phút`, run: () => this.pause(PAUSE_MENU_MINUTES) },
          { label: "$(debug-pause) Tạm dừng đến khi bật lại", run: () => this.pause() }
        );
      }
    } else {
      items.push({
        label: "$(check) Bật Eye Guard",
        description: "đang tắt",
        run: () => this.toggleEnabled(),
      });
    }

    items.push(
      { label: "Khác", kind: vscode.QuickPickItemKind.Separator },
      { label: "$(settings-gear) Cài đặt Eye Guard", run: () => this.openSettings() },
      { label: "$(sparkle) Xem thử hiệu ứng pixel art", run: () => this.previewEffect() },
      {
        label: config.enabled ? "$(circle-slash) Tắt Eye Guard" : "$(check) Bật Eye Guard",
        run: () => this.toggleEnabled(),
      }
    );

    const picked = await vscode.window.showQuickPick(items, {
      title: "Eye Guard",
      placeHolder: paused
        ? "Đang tạm dừng — chọn một hành động"
        : "Bảo vệ mắt: 20-20-20 · uống nước · vận động",
      matchOnDescription: true,
    });
    await picked?.run?.();
  }

  private async previewEffect(): Promise<void> {
    const items = EFFECT_CHOICES.map<MenuItem & { choice: EffectChoice }>((choice) => ({
      label: `$(${KIND_ICON[choice.kind]}) ${choice.label}`,
      description: KIND_LABEL[choice.kind],
      detail: choice.description,
      choice,
    }));

    const picked = await vscode.window.showQuickPick(items, {
      title: "Xem thử hiệu ứng — Eye Guard",
      placeHolder: "Chọn một hiệu ứng pixel art (nguồn: patch-gg/pixelfx)",
      matchOnDetail: true,
    });
    if (!picked) return;

    this.openPanel(
      this.payloadFor(picked.choice.kind, { preview: true, effect: picked.choice.id })
    );
  }
}

/** mm:ss, or h:mm:ss from an hour up. */
function formatClock(ms: number): string {
  const total = Math.max(0, Math.round(ms / 1000));
  const hours = Math.floor(total / 3600);
  const minutes = Math.floor((total % 3600) / 60);
  const seconds = total % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${pad(minutes)}:${pad(seconds)}`;
}
