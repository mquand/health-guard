import type { ReminderKind } from "./config";

export interface ScheduledTask {
  kind: ReminderKind;
  intervalMs: number;
  nextAt: number;
}

export interface PauseState {
  paused: boolean;
  /** Epoch ms when the pause ends; 0 means "until resumed by hand". */
  until: number;
}

/**
 * A tiny scheduler with one repeating task per reminder kind. It ticks once a second, fires at most one
 * reminder per tick and postpones a due reminder while `canFire()` says no (window unfocused, a panel open…).
 */
export class Scheduler {
  private readonly tasks = new Map<ReminderKind, ScheduledTask>();
  private timer: ReturnType<typeof setInterval> | undefined;
  private paused = false;
  private pausedUntil = 0;

  constructor(
    private readonly onDue: (kind: ReminderKind) => void,
    private readonly canFire: () => boolean,
    private readonly onTick: () => void
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.tick(), 1000);
  }

  dispose(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = undefined;
    }
  }

  /** Add or update a repeating task. `reset` pushes the next fire a full interval away. */
  configure(kind: ReminderKind, intervalMs: number, reset = true): void {
    const existing = this.tasks.get(kind);
    if (existing) {
      const intervalChanged = existing.intervalMs !== intervalMs;
      existing.intervalMs = intervalMs;
      if (reset || intervalChanged) existing.nextAt = Date.now() + intervalMs;
      return;
    }
    this.tasks.set(kind, { kind, intervalMs, nextAt: Date.now() + intervalMs });
  }

  remove(kind: ReminderKind): void {
    this.tasks.delete(kind);
  }

  get(kind: ReminderKind): ScheduledTask | undefined {
    return this.tasks.get(kind);
  }

  list(): ScheduledTask[] {
    return [...this.tasks.values()];
  }

  /** The task that will fire first, if any. */
  next(): ScheduledTask | undefined {
    return this.list().sort((a, b) => a.nextAt - b.nextAt)[0];
  }

  pause(minutes?: number): void {
    this.paused = true;
    this.pausedUntil = minutes ? Date.now() + minutes * 60_000 : 0;
    this.onTick();
  }

  resume(resetIntervals = true): void {
    this.paused = false;
    this.pausedUntil = 0;
    if (resetIntervals) {
      const now = Date.now();
      for (const task of this.tasks.values()) task.nextAt = now + task.intervalMs;
    }
    this.onTick();
  }

  snooze(kind: ReminderKind, minutes: number): void {
    const task = this.tasks.get(kind);
    if (task) task.nextAt = Date.now() + minutes * 60_000;
    this.onTick();
  }

  /** Fire a reminder right now (manual command) and keep its regular rhythm from here. */
  triggerNow(kind: ReminderKind): void {
    const task = this.tasks.get(kind);
    if (task) task.nextAt = Date.now() + task.intervalMs;
    this.onDue(kind);
    this.onTick();
  }

  get isPaused(): boolean {
    return this.paused;
  }

  get pauseState(): PauseState {
    return { paused: this.paused, until: this.pausedUntil };
  }

  get pauseRemainingMs(): number {
    if (!this.paused) return 0;
    return this.pausedUntil ? Math.max(0, this.pausedUntil - Date.now()) : Number.POSITIVE_INFINITY;
  }

  restorePause(state: PauseState | undefined): void {
    if (!state?.paused) return;
    if (state.until && Date.now() >= state.until) return;
    this.paused = true;
    this.pausedUntil = state.until || 0;
  }

  private tick(): void {
    const now = Date.now();

    if (this.paused) {
      if (this.pausedUntil && now >= this.pausedUntil) {
        this.resume(true);
        return;
      }
      this.onTick();
      return;
    }

    for (const task of this.list().sort((a, b) => a.nextAt - b.nextAt)) {
      if (now < task.nextAt) break;
      if (!this.canFire()) {
        // Try again shortly instead of dropping the reminder.
        task.nextAt = now + 30_000;
        continue;
      }
      task.nextAt = now + task.intervalMs;
      this.onDue(task.kind);
      break; // one reminder at a time
    }

    this.onTick();
  }
}
